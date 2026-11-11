// Base de datos local (IndexedDB vía Dexie) — SPEC.md §1 y §6.
// Mismo esquema que tendrá Supabase. La interfaz solo lee y escribe aquí.
import Dexie, { type Table } from 'dexie'

export interface Base {
  id: string
  user_id: string | null // se asigna al iniciar sesión (fase 5)
  created_at: string
  updated_at: string
  deleted: boolean
}

export type Transmision = 'automático' | 'sincrónico'

export interface Vehiculo extends Base {
  marca: string
  modelo: string
  anio: number | null
  motor: string
  transmision: Transmision
  alias: string
  fecha_compra: string | null
  activo: boolean
}

export interface CorreccionOdometro extends Base {
  vehicle_id: string
  fecha: string
  km_total: number
  nota: string
}

export type Moneda = 'USD' | 'VES'

export interface CargaGasolina extends Base {
  vehicle_id: string
  fecha: string
  km_recorridos: number
  litros: number
  full: boolean
  monto: number | null
  moneda: Moneda | null
  tasa_ves_usd: number | null
  monto_usd: number | null
  nota: string
  origen: 'manual' | 'importado'
}

/** Valores sueltos del dispositivo (última tasa usada, etc.). No se sincroniza. */
export interface Meta {
  clave: string
  valor: unknown
}

export const db = new Dexie('la-nave') as Dexie & {
  vehicles: Table<Vehiculo, string>
  odometer_corrections: Table<CorreccionOdometro, string>
  fuel_logs: Table<CargaGasolina, string>
  meta: Table<Meta, string>
}

db.version(1).stores({
  vehicles: 'id, updated_at',
  odometer_corrections: 'id, vehicle_id, updated_at',
  fuel_logs: 'id, vehicle_id, fecha, updated_at',
  meta: 'clave',
})

export const TABLAS_DATOS = ['vehicles', 'odometer_corrections', 'fuel_logs'] as const
