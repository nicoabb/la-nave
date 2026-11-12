import { createContext, useContext, useEffect, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  db,
  type Caucho,
  type Deseo,
  type ItemTaller,
  type Posicion,
  type Prioridad,
  type TareaMantenimiento,
  type Vehiculo,
  type VisitaTaller,
} from './esquema'
import { evaluarCaucho, TAREA_DE_EVENTO, VIDA_UTIL_KM, type EstadoCaucho } from '../lib/cauchos'
import type { Estado } from '../lib/tareas'
import { analizar, calcularTramos, kmPorDia, ordenar } from '../lib/gasolina'
import { estimarKmEnFecha, kmActual } from '../lib/kilometraje'
import { hoyISO } from '../lib/fechas'
import { estimarCosto, evaluarTarea, ordenarPorPrioridad, UMBRAL_PRONTO, type EstadoTarea, type Hecho, type PagoTarea } from '../lib/tareas'

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
    const [tareas, visitas, revisiones, eventos, gastos, correcciones, cargas] = await Promise.all([
      db.maintenance_tasks.where('vehicle_id').equals(vehiculoId).toArray(),
      db.service_visits.where('vehicle_id').equals(vehiculoId).toArray(),
      db.inspections.where('vehicle_id').equals(vehiculoId).toArray(),
      db.tire_events.where('vehicle_id').equals(vehiculoId).toArray(),
      db.expenses.where('vehicle_id').equals(vehiculoId).toArray(),
      db.odometer_corrections.where('vehicle_id').equals(vehiculoId).toArray(),
      db.fuel_logs.where('vehicle_id').equals(vehiculoId).toArray(),
    ])
    const vs = visitas.filter((v) => !v.deleted)
    const items = (await db.service_items.where('visit_id').anyOf(vs.map((v) => v.id)).toArray()).filter((i) => !i.deleted)
    return {
      tareas: tareas.filter((t) => !t.deleted).sort((a, b) => a.created_at.localeCompare(b.created_at)),
      visitas: vs.sort((a, b) => b.fecha.localeCompare(a.fecha) || b.created_at.localeCompare(a.created_at)),
      items: items.sort((a, b) => a.created_at.localeCompare(b.created_at)),
      revisiones: revisiones.filter((r) => !r.deleted),
      eventos: eventos.filter((e) => !e.deleted),
      gastos: gastos.filter((g) => !g.deleted),
      correcciones: correcciones.filter((c) => !c.deleted),
      cargas: cargas.filter((c) => !c.deleted),
    }
  }, [vehiculoId])
  const kmTotal = useKilometraje(vehiculoId)
  const umbral = useUmbralPronto()

  return useMemo(() => {
    if (!datos || kmTotal === undefined) return undefined
    const visitaPorId = new Map(datos.visitas.map((v) => [v.id, v]))
    // Si un registro no trae km, se estima con las lecturas del tablero
    const kmDe = (fecha: string, km: number | null) => km ?? estimarKmEnFecha(datos.correcciones, datos.cargas, fecha)
    const hechos: Hecho[] = []
    const pagos: PagoTarea[] = []
    for (const i of datos.items) {
      const v = visitaPorId.get(i.visit_id)
      if (!i.task_id || !v) continue
      hechos.push({ task_id: i.task_id, fecha: v.fecha, km: kmDe(v.fecha, v.km) })
      pagos.push({ task_id: i.task_id, grupo: v.id, fecha: v.fecha, monto_usd: i.monto_usd })
    }
    for (const r of datos.revisiones) if (r.task_id) hechos.push({ task_id: r.task_id, fecha: r.fecha, km: kmDe(r.fecha, r.km) })
    // Los eventos de cauchos (rotación, balanceo, alineación, presión) completan su tarea, y lo pagado cuenta
    const tareaPorClave = new Map(datos.tareas.filter((t) => t.clave).map((t) => [t.clave!, t.id]))
    for (const ev of datos.eventos) {
      const taskId = tareaPorClave.get(TAREA_DE_EVENTO[ev.tipo] ?? '')
      if (!taskId) continue
      hechos.push({ task_id: taskId, fecha: ev.fecha, km: kmDe(ev.fecha, ev.km) })
      pagos.push({ task_id: taskId, grupo: ev.id, fecha: ev.fecha, monto_usd: ev.monto_usd })
    }
    // Un gasto vinculado (p. ej. el pago del seguro) también completa su tarea
    for (const g of datos.gastos) {
      if (!g.task_id) continue
      hechos.push({ task_id: g.task_id, fecha: g.fecha, km: kmDe(g.fecha, null) })
      pagos.push({ task_id: g.task_id, grupo: g.id, fecha: g.fecha, monto_usd: g.monto_usd })
    }

    const hoy = hoyISO()
    const estados = ordenarPorPrioridad(
      datos.tareas.filter((t) => t.activa).map((t) => evaluarTarea(t, hechos, kmTotal, hoy, umbral)),
    )
    const tareaPorId = new Map(datos.tareas.map((t) => [t.id, t]))
    return {
      tareas: datos.tareas,
      visitas: datos.visitas,
      items: datos.items,
      estados,
      // Historial (promedio de las últimas 3) y, si no hay, el estimado manual de la tarea
      costo: (taskId: string) => {
        const h = estimarCosto(taskId, pagos)
        if (h) return h
        const manual = tareaPorId.get(taskId)?.costo_estimado_usd
        return manual != null ? { usd: manual, veces: 0 } : null
      },
    }
  }, [datos, kmTotal, umbral])
}

export function useVidaUtilCauchos(): number {
  return useLiveQuery(async () => (await db.meta.get('vida_util_cauchos'))?.valor as number | undefined) ?? VIDA_UTIL_KM
}

const PEOR: Record<Estado, number> = { urgente: 2, pronto: 1, 'en-orden': 0 }
export const peorEstado = (xs: Estado[]): Estado => xs.reduce<Estado>((a, b) => (PEOR[b] > PEOR[a] ? b : a), 'en-orden')

/** Cauchos montados con su estado, y los servicios periódicos de cauchos. */
export function useCauchos(vehiculoId: string) {
  const cauchos = useLiveQuery(
    async () => (await db.tires.where('vehicle_id').equals(vehiculoId).toArray()).filter((c) => !c.deleted && c.estado === 'montado'),
    [vehiculoId],
  )
  const kmTotal = useKilometraje(vehiculoId)
  const mant = useMantenimiento(vehiculoId)
  const vidaUtil = useVidaUtilCauchos()
  const umbral = useUmbralPronto()

  return useMemo(() => {
    if (!cauchos || kmTotal === undefined || !mant) return undefined
    const hoy = hoyISO()
    const porPosicion = new Map<Posicion, { caucho: Caucho; estado: EstadoCaucho }>()
    for (const c of cauchos) porPosicion.set(c.posicion, { caucho: c, estado: evaluarCaucho(c, kmTotal, hoy, vidaUtil, umbral) })
    const servicio = (clave: string) => mant.estados.find((e) => e.tarea.clave === clave)
    const servicios = {
      presion: servicio('presion_cauchos'),
      rotacion: servicio('rotacion'),
      balanceo: servicio('balanceo'),
      alineacion: servicio('alineacion'),
    }

    // Resumen para la fila de Taller ("Repuesto por cambiar · aire en 2 días")
    const partes: string[] = []
    const rep = porPosicion.get('REP')
    const rodando = [...porPosicion.values()].filter((x) => x.caucho.posicion !== 'REP')
    if (rep?.estado.estado === 'urgente') partes.push('Repuesto por cambiar')
    const malos = rodando.filter((x) => x.estado.estado === 'urgente').length
    if (malos) partes.push(`${malos} ${malos === 1 ? 'caucho' : 'cauchos'} por cambiar`)
    const p = servicios.presion
    if (p && !p.desconocida && p.restanteDias != null) {
      partes.push(p.restanteDias === p.tarea.intervalo_dias ? 'aire revisado hoy' : p.restanteDias > 0 ? `aire en ${p.restanteDias} ${p.restanteDias === 1 ? 'día' : 'días'}` : p.restanteDias === 0 ? 'aire hoy' : 'aire vencido')
    } else if (p?.desconocida) partes.push('aire sin registro')
    if (!cauchos.length) partes.unshift('Agrega tus cauchos')

    const estados = [...porPosicion.values()].map((x) => x.estado.estado)
    for (const s of Object.values(servicios)) if (s) estados.push(s.estado)

    return {
      porPosicion,
      servicios,
      vidaUtil,
      resumen: { texto: partes.join(' · ') || 'Todo en orden', estado: peorEstado(estados) },
    }
  }, [cauchos, kmTotal, mant, vidaUtil, umbral])
}

export interface ItemPendiente {
  clave: string
  tipo: 'periodico' | 'puntual'
  titulo: string
  detalle: string
  estado: Estado
  progreso: number
  costoUsd: number | null
  tarea?: TareaMantenimiento
  estadoTarea?: EstadoTarea<TareaMantenimiento>
  deseo?: Deseo
}

const ESTADO_PRIORIDAD: Record<Prioridad, Estado> = { rojo: 'urgente', amarillo: 'pronto', verde: 'en-orden' }

/** Tareas periódicas + pendientes puntuales, ordenados por prioridad. */
export function usePendientes(vehiculoId: string) {
  const mant = useMantenimiento(vehiculoId)
  const umbral = useUmbralPronto()
  const deseos = useLiveQuery(
    async () =>
      (await db.wishlist_items.where('vehicle_id').equals(vehiculoId).toArray())
        .filter((d) => !d.deleted)
        .sort((a, b) => a.created_at.localeCompare(b.created_at)),
    [vehiculoId],
  )

  return useMemo(() => {
    if (!mant || !deseos) return undefined
    const periodicos: ItemPendiente[] = mant.estados.map((e) => ({
      clave: e.tarea.id,
      tipo: 'periodico',
      titulo: e.tarea.nombre,
      detalle: e.texto,
      estado: e.estado,
      progreso: e.progreso,
      costoUsd: mant.costo(e.tarea.id)?.usd ?? null,
      tarea: e.tarea,
      estadoTarea: e,
    }))
    const PROGRESO: Record<Prioridad, number> = { rojo: 1, amarillo: umbral, verde: 0 }
    const puntuales: ItemPendiente[] = deseos
      .filter((d) => !d.hecho)
      .map((d) => ({
        clave: d.id,
        tipo: 'puntual',
        titulo: d.titulo,
        detalle: d.nota,
        estado: ESTADO_PRIORIDAD[d.prioridad],
        progreso: PROGRESO[d.prioridad],
        costoUsd: d.costo_estimado_usd,
        deseo: d,
      }))
    return {
      items: ordenarPorPrioridad([...periodicos, ...puntuales]),
      hechos: deseos.filter((d) => d.hecho).sort((a, b) => (b.fecha_hecho ?? '').localeCompare(a.fecha_hecho ?? '')),
    }
  }, [mant, deseos, umbral])
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
