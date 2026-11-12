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

/** De dónde salió la tasa: a mano, de Wallet, estimada (fila en Bs más cercana) o de un comprobante. */
export type TasaOrigen = 'manual' | 'wallet' | 'estimada' | 'comprobante'

export interface CargaGasolina extends Base {
  vehicle_id: string
  fecha: string
  /** null = carga importada sin km: cuenta como gasto, no para rendimiento */
  km_recorridos: number | null
  litros: number
  /** true = full · false = no fue full · null = desconocido */
  full: boolean | null
  monto: number | null
  moneda: Moneda | null
  tasa_ves_usd: number | null
  tasa_origen: TasaOrigen | null
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
  /** Estimado manual en USD, cuando aún no hay historial de costos */
  costo_estimado_usd: number | null
}

export interface VisitaTaller extends Base {
  vehicle_id: string
  fecha: string
  km: number | null
  titulo: string
  taller: string
  /** Tienda donde se compraron repuestos (p. ej. una tienda en línea) */
  proveedor: string
  afecta_rendimiento: boolean
  moneda: Moneda
  tasa_ves_usd: number | null
  tasa_origen: TasaOrigen | null
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

export type Posicion = 'DI' | 'DD' | 'TI' | 'TD' | 'REP'

export interface Caucho extends Base {
  vehicle_id: string
  marca: string
  medida: string
  dot_semana: number | null
  dot_anio: number | null
  fecha_montaje: string | null
  km_montaje: number | null
  posicion: Posicion
  estado: 'montado' | 'retirado'
  nota: string
}

export type TipoEventoCaucho = 'montaje' | 'rotacion' | 'balanceo' | 'alineacion' | 'presion' | 'retiro'

export interface EventoCaucho extends Base {
  vehicle_id: string
  fecha: string
  km: number | null
  tipo: TipoEventoCaucho
  /** rotación: { tire_id: nueva_posicion } · alineación: { eje } · montaje/retiro: { tire_id } */
  detalle: Record<string, string> | null
  visit_id: string | null
  /** Lo pagado (p. ej. por el aire): suma a Gastos en el sistema Cauchos */
  monto: number | null
  moneda: Moneda | null
  tasa_ves_usd: number | null
  tasa_origen: TasaOrigen | null
  monto_usd: number | null
}

export type Prioridad = 'rojo' | 'amarillo' | 'verde'

export interface Deseo extends Base {
  vehicle_id: string
  titulo: string
  prioridad: Prioridad
  costo_estimado_usd: number | null
  nota: string
  hecho: boolean
  fecha_hecho: string | null
  visit_id: string | null
}

/**
 * Comprobante (PDF o imagen) adjunto a una visita. El archivo vive solo en el
 * bucket privado comprobantes (ruta user_id/path); aquí van los metadatos.
 */
export interface Comprobante extends Base {
  visit_id: string
  nombre: string
  mime: string
  bytes: number
  path: string // "visit_id/uuid.ext"
}

/** Archivo de comprobante esperando subir (se borra del teléfono al subirse). */
export interface ComprobanteEnCola {
  path: string
  blob: Blob
}

/** Lo que no es gasolina ni taller: precio de compra, traspaso, seguro, otros. */
export interface Gasto extends Base {
  vehicle_id: string
  fecha: string
  categoria: 'compra_papeles' | 'seguro' | 'otro'
  descripcion: string
  /** Tarea periódica que completa este pago (p. ej. la renovación del seguro) */
  task_id: string | null
  monto: number
  moneda: Moneda
  tasa_ves_usd: number | null
  tasa_origen: TasaOrigen | null
  monto_usd: number | null
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
  tires: Table<Caucho, string>
  tire_events: Table<EventoCaucho, string>
  wishlist_items: Table<Deseo, string>
  expenses: Table<Gasto, string>
  visit_receipts: Table<Comprobante, string>
  meta: Table<Meta, string>
  comprobantes_cola: Table<ComprobanteEnCola, string>
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

db.version(3).stores({
  tires: 'id, vehicle_id, updated_at',
  tire_events: 'id, vehicle_id, updated_at',
  wishlist_items: 'id, vehicle_id, updated_at',
})

db.version(4).stores({
  expenses: 'id, vehicle_id, updated_at',
})

// v5: tasa_origen, proveedor y montos en eventos de cauchos. Sin índices nuevos:
// solo se completan los registros existentes (no cambia updated_at).
db.version(5)
  .stores({})
  .upgrade(async (tx) => {
    const conTasa = (r: { tasa_ves_usd?: number | null; tasa_origen?: string | null }) => {
      if (r.tasa_origen === undefined) r.tasa_origen = r.tasa_ves_usd ? 'manual' : null
    }
    await tx.table('fuel_logs').toCollection().modify(conTasa)
    await tx.table('expenses').toCollection().modify(conTasa)
    await tx.table('service_visits').toCollection().modify((v) => {
      conTasa(v)
      if (v.proveedor === undefined) v.proveedor = ''
    })
    await tx.table('tire_events').toCollection().modify((e) => {
      for (const k of ['monto', 'moneda', 'tasa_ves_usd', 'tasa_origen', 'monto_usd']) if (e[k] === undefined) e[k] = null
    })
  })

db.version(6).stores({
  visit_receipts: 'id, visit_id, updated_at',
  comprobantes_cola: 'path',
})

// v7: estimado manual en tareas y gastos vinculados a una tarea
db.version(7)
  .stores({})
  .upgrade(async (tx) => {
    await tx.table('maintenance_tasks').toCollection().modify((t) => {
      if (t.costo_estimado_usd === undefined) t.costo_estimado_usd = null
    })
    await tx.table('expenses').toCollection().modify((g) => {
      if (g.task_id === undefined) g.task_id = null
    })
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
  'tires',
  'tire_events',
  'wishlist_items',
  'expenses',
  'visit_receipts',
] as const
