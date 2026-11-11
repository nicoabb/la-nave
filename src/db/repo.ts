import type { Table } from 'dexie'
import { db, type Base } from './esquema'

export type Nuevo<T extends Base> = Omit<T, keyof Base>

/** uuid v4; con respaldo para contextos sin HTTPS (p. ej. probar por la red local). */
export function uuid(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

export async function crear<T extends Base>(tabla: Table<T, string>, datos: Nuevo<T>): Promise<T> {
  const ahora = new Date().toISOString()
  const reg = { ...datos, id: uuid(), user_id: null, created_at: ahora, updated_at: ahora, deleted: false } as T
  await tabla.add(reg)
  return reg
}

export async function actualizar<T extends Base>(tabla: Table<T, string>, id: string, cambios: Partial<Nuevo<T>>) {
  await tabla.update(id, { ...cambios, updated_at: new Date().toISOString() } as never)
}

/** Borrado lógico, para que el borrado también se sincronice. */
export async function borrar<T extends Base>(tabla: Table<T, string>, id: string) {
  await tabla.update(id, { deleted: true, updated_at: new Date().toISOString() } as never)
}

export async function leerMeta<T>(clave: string): Promise<T | undefined> {
  return (await db.meta.get(clave))?.valor as T | undefined
}

export async function guardarMeta(clave: string, valor: unknown) {
  await db.meta.put({ clave, valor })
}
