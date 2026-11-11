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

export interface TareaMantenimiento extends Base {
  vehicle_id: string
  clave: string | null // identifica las tareas precargadas (p. ej. 'aceite_motor')
  nombre: string
  sistema: string
  intervalo_km: number | null
  intervalo_dias: number | null
  ultima_km_inicial: number | null
  ultima_fecha_inicial: string | null
  activa: boolean
  notas: string
  es_revision: boolean
  fuente: string // 'Manual' | 'Usuario' | 'Sugerido' | ''
}

export interface VisitaTaller extends Base {
  vehicle_id: string
  fecha: string
  km: number | null
  titulo: string
  taller: string
  afecta_rendimiento: boolean
  moneda: Moneda
  tasa_ves_usd: number | null
  nota: string
}

export type TipoItem = 'repuesto' | 'servicio' | 'mano_obra'

export interface ItemTaller extends Base {
  visit_id: string
  descripcion: string
  tipo: TipoItem
  sistema: string
  task_id: string | null
  product_id: string | null
  cantidad: number | null
  monto: number | null // en la moneda de la visita; 0 = sin costo
  monto_usd: number | null
}

export interface Producto extends Base {
  tipo: string
  marca: string
  especificacion: string
  presentacion: string
  en_uso: boolean
  nota: string
  foto_path: string | null
}

export type TipoRevision = 'semanal_capo' | 'bateria' | 'presion_cauchos' | 'otra'

export interface Revision extends Base {
  vehicle_id: string
  fecha: string
  km: number | null
  tipo: TipoRevision
  checklist: Record<string, 'ok' | 'revisar'> | null
  mediciones: Record<string, string> | null
  task_id: string | null
  nota: string
}

/** Valores sueltos del dispositivo (última tasa usada, etc.). No se sincroniza. */
export interface Meta {
  clave: string
  valor: unknown
}

/** Fotos comprimidas guardadas en el teléfono; se suben al sincronizar (fase 5). */
export interface Foto {
  path: string
  blob: Blob
  subida: boolean
}

export const db = new Dexie('la-nave') as Dexie & {
  vehicles: Table<Vehiculo, string>
  odometer_corrections: Table<CorreccionOdometro, string>
  fuel_logs: Table<CargaGasolina, string>
  maintenance_tasks: Table<TareaMantenimiento, string>
  service_visits: Table<VisitaTaller, string>
  service_items: Table<ItemTaller, string>
  products: Table<Producto, string>
  inspections: Table<Revision, string>
  meta: Table<Meta, string>
  fotos: Table<Foto, string>
}

db.version(1).stores({
  vehicles: 'id, updated_at',
  odometer_corrections: 'id, vehicle_id, updated_at',
  fuel_logs: 'id, vehicle_id, fecha, updated_at',
  meta: 'clave',
})

db.version(2).stores({
  maintenance_tasks: 'id, vehicle_id, updated_at',
  service_visits: 'id, vehicle_id, fecha, updated_at',
  service_items: 'id, visit_id, task_id, updated_at',
  products: 'id, updated_at',
  inspections: 'id, vehicle_id, task_id, updated_at',
  fotos: 'path',
})

export const TABLAS_DATOS = [
  'vehicles',
  'odometer_corrections',
  'fuel_logs',
  'maintenance_tasks',
  'service_visits',
  'service_items',
  'products',
  'inspections',
] as const
