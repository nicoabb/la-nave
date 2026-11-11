import { createContext, useContext, useEffect, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type ItemTaller, type TareaMantenimiento, type Vehiculo, type VisitaTaller } from './esquema'
import { analizar, calcularTramos, kmPorDia, ordenar } from '../lib/gasolina'
import { kmActual } from '../lib/kilometraje'
import { hoyISO } from '../lib/fechas'
import { estimarCosto, evaluarTarea, ordenarPorPrioridad, UMBRAL_PRONTO, type EstadoTarea, type Hecho } from '../lib/tareas'

/** undefined = cargando · null = no hay vehículo configurado */
export function useVehiculo() {
  return useLiveQuery(async () => {
    const activos = (await db.vehicles.toArray()).filter((v) => !v.deleted && v.activo)
    return activos.sort((a, b) => a.created_at.localeCompare(b.created_at))[0] ?? null
  })
}

export const VehiculoContexto = createContext<Vehiculo | null>(null)

export function useVehiculoActivo(): Vehiculo {
  const v = useContext(VehiculoContexto)
  if (!v) throw new Error('No hay vehículo activo')
  return v
}

export function descripcionVehiculo(v: Vehiculo): string {
  const nombre = [v.marca, v.modelo, v.anio].filter(Boolean).join(' ')
  const tecnico = [v.motor, v.transmision].filter(Boolean).join(' ')
  return tecnico ? `${nombre} · ${tecnico}` : nombre
}

export function useCargas(vehiculoId: string) {
  return useLiveQuery(
    async () => ordenar((await db.fuel_logs.where('vehicle_id').equals(vehiculoId).toArray()).filter((c) => !c.deleted)),
    [vehiculoId],
  )
}

export function useCorrecciones(vehiculoId: string) {
  return useLiveQuery(
    async () =>
      ordenar((await db.odometer_corrections.where('vehicle_id').equals(vehiculoId).toArray()).filter((c) => !c.deleted)),
    [vehiculoId],
  )
}

export function useGasolina(vehiculoId: string) {
  const cargas = useCargas(vehiculoId)
  // Una visita que "afecta el rendimiento" reinicia la referencia (SPEC §5.1)
  const reinicio = useLiveQuery(
    async () => {
      const fechas = (await db.service_visits.where('vehicle_id').equals(vehiculoId).toArray())
        .filter((v) => !v.deleted && v.afecta_rendimiento)
        .map((v) => v.fecha)
        .sort()
      return fechas.at(-1) ?? null
    },
    [vehiculoId],
  )
  return useMemo(() => {
    const cs = cargas ?? []
    const { tramos, pendiente } = calcularTramos(cs)
    return {
      cargando: cargas === undefined,
      cargas: cs,
      tramos,
      pendiente,
      reinicio: reinicio ?? null,
      analisis: analizar(tramos, reinicio ?? null),
      kmDia: kmPorDia(cs),
    }
  }, [cargas, reinicio])
}

export function useKilometraje(vehiculoId: string): number | null | undefined {
  const correcciones = useCorrecciones(vehiculoId)
  const cargas = useCargas(vehiculoId)
  if (!correcciones || !cargas) return undefined
  return kmActual(correcciones, cargas)
}

export function useUmbralPronto(): number {
  return useLiveQuery(async () => (await db.meta.get('umbral_pronto'))?.valor as number | undefined) ?? UMBRAL_PRONTO
}

export interface DatosMantenimiento {
  tareas: TareaMantenimiento[]
  visitas: VisitaTaller[]
  items: ItemTaller[]
  estados: EstadoTarea<TareaMantenimiento>[]
  costo: (taskId: string) => { usd: number; veces: number } | null
}

/** Tareas con su semáforo, visitas e ítems. undefined mientras carga. */
export function useMantenimiento(vehiculoId: string): DatosMantenimiento | undefined {
  const datos = useLiveQuery(async () => {
    const [tareas, visitas, revisiones] = await Promise.all([
      db.maintenance_tasks.where('vehicle_id').equals(vehiculoId).toArray(),
      db.service_visits.where('vehicle_id').equals(vehiculoId).toArray(),
      db.inspections.where('vehicle_id').equals(vehiculoId).toArray(),
    ])
    const vs = visitas.filter((v) => !v.deleted)
    const items = (await db.service_items.where('visit_id').anyOf(vs.map((v) => v.id)).toArray()).filter((i) => !i.deleted)
    return {
      tareas: tareas.filter((t) => !t.deleted).sort((a, b) => a.created_at.localeCompare(b.created_at)),
      visitas: vs.sort((a, b) => b.fecha.localeCompare(a.fecha) || b.created_at.localeCompare(a.created_at)),
      items: items.sort((a, b) => a.created_at.localeCompare(b.created_at)),
      revisiones: revisiones.filter((r) => !r.deleted),
    }
  }, [vehiculoId])
  const kmTotal = useKilometraje(vehiculoId)
  const umbral = useUmbralPronto()

  return useMemo(() => {
    if (!datos || kmTotal === undefined) return undefined
    const visitaPorId = new Map(datos.visitas.map((v) => [v.id, v]))
    const hechos: Hecho[] = []
    for (const i of datos.items) {
      const v = visitaPorId.get(i.visit_id)
      if (i.task_id && v) hechos.push({ task_id: i.task_id, fecha: v.fecha, km: v.km })
    }
    for (const r of datos.revisiones) if (r.task_id) hechos.push({ task_id: r.task_id, fecha: r.fecha, km: r.km })

    const hoy = hoyISO()
    const estados = ordenarPorPrioridad(
      datos.tareas.filter((t) => t.activa).map((t) => evaluarTarea(t, hechos, kmTotal, hoy, umbral)),
    )
    return {
      tareas: datos.tareas,
      visitas: datos.visitas,
      items: datos.items,
      estados,
      costo: (taskId: string) => estimarCosto(taskId, datos.items, datos.visitas),
    }
  }, [datos, kmTotal, umbral])
}

/** URL temporal de una foto guardada en el teléfono. */
export function useFotoUrl(path: string | null) {
  const foto = useLiveQuery(async () => (path ? db.fotos.get(path) : undefined), [path])
  const url = useMemo(() => (foto ? URL.createObjectURL(foto.blob) : null), [foto])
  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url)
  }, [url])
  return url
}
