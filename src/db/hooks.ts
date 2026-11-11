import { createContext, useContext, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Vehiculo } from './esquema'
import { analizar, calcularTramos, kmPorDia, ordenar } from '../lib/gasolina'
import { kmActual } from '../lib/kilometraje'

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
  return useMemo(() => {
    const cs = cargas ?? []
    const { tramos, pendiente } = calcularTramos(cs)
    return {
      cargando: cargas === undefined,
      cargas: cs,
      tramos,
      pendiente,
      analisis: analizar(tramos),
      kmDia: kmPorDia(cs),
    }
  }, [cargas])
}

export function useKilometraje(vehiculoId: string): number | null | undefined {
  const correcciones = useCorrecciones(vehiculoId)
  const cargas = useCargas(vehiculoId)
  if (!correcciones || !cargas) return undefined
  return kmActual(correcciones, cargas)
}
