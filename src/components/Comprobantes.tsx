import { useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { FileText, Image, Paperclip, Trash2 } from 'lucide-react'
import { db, type Comprobante } from '../db/esquema'
import { borrar, crear, uuid } from '../db/repo'
import { comprimirFoto } from '../lib/fotos'
import { numero } from '../lib/formato'
import { useEnLinea } from '../lib/useEnLinea'
import { useSesion } from '../sync/hooks'
import { urlComprobante } from '../sync/motor'
import { useAviso } from './Aviso'

const MAX_PDF = 5 * 1024 * 1024

const tamano = (b: number) => (b >= 1024 * 1024 ? `${numero(b / 1024 / 1024, 1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`)

/** Comprobantes (PDF/imagen) de una visita: se abren bajo demanda con URL firmada. */
export function ComprobantesVisita({ visitId }: { visitId: string }) {
  const avisar = useAviso()
  const enLinea = useEnLinea()
  const sesion = useSesion()
  const entrada = useRef<HTMLInputElement>(null)
  const [subiendo, setSubiendo] = useState(false)

  const datos = useLiveQuery(async () => {
    const lista = (await db.visit_receipts.where('visit_id').equals(visitId).toArray())
      .filter((c) => !c.deleted)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
    const enCola = new Set((await db.comprobantes_cola.bulkGet(lista.map((c) => c.path))).filter(Boolean).map((c) => c!.path))
    return { lista, enCola }
  }, [visitId])

  async function adjuntar(archivo: File | undefined) {
    if (!archivo) return
    try {
      setSubiendo(true)
      let blob: Blob = archivo
      let ext = archivo.name.split('.').pop()?.toLowerCase() || 'pdf'
      if (archivo.type.startsWith('image/')) {
        blob = await comprimirFoto(archivo) // igual que las fotos de productos
        ext = 'webp'
      } else if (archivo.type !== 'application/pdf') {
        return avisar('Formato no admitido', 'Usa un PDF, JPG o PNG.', 'info')
      } else if (archivo.size > MAX_PDF) {
        return avisar('PDF muy pesado', 'El máximo es 5 MB.', 'info')
      }
      const path = `${visitId}/${uuid()}.${ext}`
      await db.transaction('rw', db.visit_receipts, db.comprobantes_cola, async () => {
        await db.comprobantes_cola.put({ path, blob })
        await crear(db.visit_receipts, { visit_id: visitId, nombre: archivo.name, mime: blob.type || archivo.type, bytes: blob.size, path })
      })
      avisar('Comprobante adjuntado', sesion ? 'Se sube a tu cuenta en cuanto haya conexión.' : 'Se guarda en este teléfono.')
    } catch {
      avisar('No se pudo adjuntar', 'Intenta con otro archivo.', 'info')
    } finally {
      setSubiendo(false)
      if (entrada.current) entrada.current.value = ''
    }
  }

  async function ver(c: Comprobante) {
    // Aún en el teléfono (no se ha subido): se abre localmente, incluso sin conexión
    const local = await db.comprobantes_cola.get(c.path)
    if (local) {
      const url = URL.createObjectURL(local.blob)
      window.open(url, '_blank')
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
      return
    }
    // La ventana se abre ya (gesto del usuario) y luego recibe la URL firmada
    const ventana = window.open('', '_blank')
    try {
      const url = await urlComprobante(c.path)
      if (ventana) ventana.location.href = url
      else window.location.href = url
    } catch (e) {
      ventana?.close()
      avisar('No se pudo abrir', e instanceof Error ? e.message : 'Intenta de nuevo.', 'info')
    }
  }

  async function quitar(c: Comprobante) {
    if (!window.confirm(`¿Quitar "${c.nombre}" de esta visita?`)) return
    await db.transaction('rw', db.visit_receipts, db.comprobantes_cola, async () => {
      await db.comprobantes_cola.delete(c.path)
      await borrar(db.visit_receipts, c.id)
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {datos?.lista.map((c) => {
        const local = datos.enCola.has(c.path)
        const disponible = local || (enLinea && Boolean(sesion))
        const Icono = c.mime.startsWith('image/') ? Image : FileText
        return (
          <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button className="btn" style={{ flex: 1, justifyContent: 'flex-start', minWidth: 0 }} disabled={!disponible} onClick={() => ver(c)}>
              <Icono size={16} strokeWidth={1.8} style={{ flexShrink: 0 }} />
              <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 0 }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>Ver comprobante</span>
                <span className="muted mini" style={{ fontWeight: 400 }}>
                  {disponible ? `${c.nombre} · ${tamano(c.bytes)}${local ? ' · por subir' : ''}` : 'Disponible con conexión'}
                </span>
              </span>
            </button>
            <button className="icono-btn" aria-label={`Quitar ${c.nombre}`} onClick={() => quitar(c)}>
              <Trash2 size={16} strokeWidth={1.8} />
            </button>
          </div>
        )
      })}
      <input ref={entrada} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" hidden onChange={(e) => adjuntar(e.target.files?.[0])} />
      <button className="enlace mini" style={{ alignSelf: 'flex-start', minHeight: 32 }} disabled={subiendo} onClick={() => entrada.current?.click()}>
        <Paperclip size={14} strokeWidth={1.8} style={{ verticalAlign: -2 }} /> {subiendo ? 'Procesando…' : 'Adjuntar comprobante (PDF o foto)'}
      </button>
    </div>
  )
}
