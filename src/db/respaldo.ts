// Respaldo manual en JSON (SPEC.md §11). También sirve para cargar el archivo
// que genera la importación (fase 6), que puede traer fotos y comprobantes.
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

/** Archivo incrustado en el JSON (base64): foto de producto o comprobante. */
interface ArchivoIncrustado {
  bucket: 'fotos' | 'comprobantes'
  path: string
  mime: string
  base64: string
}

function aBlob({ base64, mime }: ArchivoIncrustado): Blob {
  const binario = atob(base64)
  const bytes = new Uint8Array(binario.length)
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

/**
 * Fusiona el archivo: entra cada registro que no exista o que sea más nuevo.
 * Los que entran se marcan con la hora actual para que la sincronización los suba.
 */
export async function restaurar(archivo: File): Promise<number> {
  const datos = JSON.parse(await archivo.text())
  if (datos?.app !== 'la-nave') throw new Error('Este archivo no es un respaldo de La Nave.')
  const ahora = new Date().toISOString()
  let n = 0
  await db.transaction('rw', [...TABLAS_DATOS.map((t) => db[t]), db.fotos, db.comprobantes_cola], async () => {
    for (const nombre of TABLAS_DATOS) {
      const tabla = db[nombre] as unknown as Table<Base, string>
      for (const r of (datos[nombre] ?? []) as Base[]) {
        const actual = await tabla.get(r.id)
        if (!actual || actual.updated_at < r.updated_at) {
          await tabla.put({ ...r, updated_at: ahora > r.updated_at ? ahora : r.updated_at })
          n++
        }
      }
    }
    for (const a of (datos.archivos ?? []) as ArchivoIncrustado[]) {
      if (a.bucket === 'fotos') await db.fotos.put({ path: a.path, blob: aBlob(a), subida: false })
      else await db.comprobantes_cola.put({ path: a.path, blob: aBlob(a) })
    }
  })
  return n
}
