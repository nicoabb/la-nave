// Respaldo manual en JSON (SPEC.md §11). Mientras no haya sincronización,
// es la única copia fuera del teléfono.
import type { Table } from 'dexie'
import { db, TABLAS_DATOS, type Base } from './esquema'
import { hoyISO } from '../lib/fechas'

export async function exportar() {
  const datos: Record<string, unknown> = { app: 'la-nave', version: 1, exportado: new Date().toISOString() }
  for (const t of TABLAS_DATOS) datos[t] = await db[t].toArray()
  const blob = new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `la-nave-respaldo-${hoyISO()}.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

/** Fusiona el respaldo: gana el registro con `updated_at` más reciente. */
export async function restaurar(archivo: File): Promise<number> {
  const datos = JSON.parse(await archivo.text())
  if (datos?.app !== 'la-nave') throw new Error('Este archivo no es un respaldo de La Nave.')
  let n = 0
  await db.transaction('rw', TABLAS_DATOS.map((t) => db[t]), async () => {
    for (const nombre of TABLAS_DATOS) {
      const tabla = db[nombre] as unknown as Table<Base, string>
      for (const r of (datos[nombre] ?? []) as Base[]) {
        const actual = await tabla.get(r.id)
        if (!actual || actual.updated_at < r.updated_at) {
          await tabla.put(r)
          n++
        }
      }
    }
  })
  return n
}
