// Motor de sincronización — SPEC.md §1 (Local-first y sincronización).
// La interfaz solo usa Dexie; esto sube y baja cambios en segundo plano.
import type { Table } from 'dexie'
import { db, TABLAS_DATOS, type Base } from '../db/esquema'
import { guardarMeta, leerMeta } from '../db/repo'
import { supabase } from './cliente'

export type EstadoSync = 'sin-config' | 'sin-sesion' | 'sin-conexion' | 'sincronizando' | 'listo' | 'error'

// ---------- Estado observable (para el indicador) ----------
let estado: EstadoSync = supabase ? 'sin-sesion' : 'sin-config'
let ultimoError = ''
const oyentes = new Set<() => void>()

function fijarEstado(e: EstadoSync, error = '') {
  estado = e
  ultimoError = error
  oyentes.forEach((f) => f())
}

export const leerEstado = () => estado
export const leerError = () => ultimoError
export function suscribirEstado(f: () => void) {
  oyentes.add(f)
  return () => oyentes.delete(f)
}

const LOTE = 500
const tabla = (t: string) => db[t as (typeof TABLAS_DATOS)[number]] as unknown as Table<Base & Record<string, unknown>, string>

/** Hora ISO uniforme (Postgres devuelve "+00:00" y microsegundos; Dexie usa "Z"). */
const normalizarHora = (v: unknown) => (typeof v === 'string' ? new Date(v).toISOString() : v)

// ---------- Sincronizar ----------
let enCurso: Promise<void> | null = null
let otraVez = false

/** Sube lo pendiente y baja lo nuevo. Si ya hay una en curso, encadena otra al terminar. */
export function sincronizar(): Promise<void> {
  if (enCurso) {
    otraVez = true
    return enCurso
  }
  enCurso = (async () => {
    try {
      do {
        otraVez = false
        await ejecutar()
      } while (otraVez)
    } finally {
      enCurso = null
    }
  })()
  return enCurso
}

async function ejecutar() {
  if (!supabase) return fijarEstado('sin-config')
  const { data } = await supabase.auth.getSession()
  const sesion = data.session
  if (!sesion) return fijarEstado('sin-sesion')
  if (!navigator.onLine) return fijarEstado('sin-conexion')

  fijarEstado('sincronizando')
  try {
    await subir(sesion.user.id)
    await bajar(sesion.user.id)
    fijarEstado('listo')
  } catch (e) {
    console.error('Sincronización', e)
    fijarEstado(navigator.onLine ? 'error' : 'sin-conexion', e instanceof Error ? e.message : String(e))
  }
}

async function subir(uid: string) {
  const inicio = new Date().toISOString()
  const ultimoEnvio = await leerMeta<string>('sync_ultimo_envio')
  for (const t of TABLAS_DATOS) {
    const pendientes = ultimoEnvio ? await tabla(t).where('updated_at').above(ultimoEnvio).toArray() : await tabla(t).toArray()
    for (let i = 0; i < pendientes.length; i += LOTE) {
      const filas = pendientes.slice(i, i + LOTE).map((r) => {
        const { server_updated_at: _, ...resto } = r
        return { ...resto, user_id: uid }
      })
      const { error } = await supabase!.from(t).upsert(filas)
      if (error) throw new Error(`${t}: ${error.message}`)
      // Comprobantes borrados: también se quita el archivo del bucket
      if (t === 'visit_receipts') {
        const borrados = pendientes.slice(i, i + LOTE).filter((r) => r.deleted).map((r) => `${uid}/${r.path}`)
        if (borrados.length) await supabase!.storage.from('comprobantes').remove(borrados)
      }
    }
  }
  await subirFotos(uid)
  await subirComprobantes(uid)
  await guardarMeta('sync_ultimo_envio', inicio)
}

async function bajar(uid: string) {
  const desde = (await leerMeta<string>('sync_ultima_descarga')) ?? '1970-01-01T00:00:00+00:00'
  let maximo = desde
  const recibidos: Record<string, Record<string, unknown>[]> = {}

  for (const t of TABLAS_DATOS) {
    recibidos[t] = []
    for (let i = 0; ; i += 1000) {
      const { data, error } = await supabase!
        .from(t)
        .select('*')
        .gt('server_updated_at', desde)
        .order('server_updated_at')
        .range(i, i + 999)
      if (error) throw new Error(`${t}: ${error.message}`)
      recibidos[t].push(...data)
      for (const r of data) if ((r.server_updated_at as string) > maximo) maximo = r.server_updated_at as string
      if (data.length < 1000) break
    }
  }

  // Todo en una sola transacción: el vehículo y sus tareas llegan juntos.
  await db.transaction('rw', TABLAS_DATOS.map((t) => db[t]), async () => {
    for (const t of TABLAS_DATOS) {
      for (const remoto of recibidos[t]) {
        const r = { ...remoto } as Base & Record<string, unknown>
        delete r.server_updated_at
        r.created_at = normalizarHora(r.created_at) as string
        r.updated_at = normalizarHora(r.updated_at) as string
        const local = await tabla(t).get(r.id)
        // Gana el último que escribió
        if (!local || local.updated_at <= r.updated_at) await tabla(t).put(r)
      }
    }
  })
  await guardarMeta('sync_ultima_descarga', maximo)
  await bajarFotos(uid)
}

// ---------- Fotos ----------
async function subirFotos(uid: string) {
  const pendientes = await db.fotos.filter((f) => !f.subida).toArray()
  for (const f of pendientes) {
    const { error } = await supabase!.storage
      .from('fotos')
      .upload(`${uid}/${f.path}`, f.blob, { upsert: true, contentType: 'image/webp' })
    if (error) throw new Error(`fotos: ${error.message}`)
    await db.fotos.update(f.path, { subida: true })
  }
}

async function bajarFotos(uid: string) {
  const productos = (await db.products.toArray()).filter((p) => !p.deleted && p.foto_path)
  for (const p of productos) {
    if (await db.fotos.get(p.foto_path!)) continue
    const { data, error } = await supabase!.storage.from('fotos').download(`${uid}/${p.foto_path}`)
    if (!error && data) await db.fotos.put({ path: p.foto_path!, blob: data, subida: true })
  }
}

// ---------- Comprobantes ----------
/** Sube la cola y libera el espacio en el teléfono (se abren luego con URL firmada). */
async function subirComprobantes(uid: string) {
  for (const c of await db.comprobantes_cola.toArray()) {
    const { error } = await supabase!.storage
      .from('comprobantes')
      .upload(`${uid}/${c.path}`, c.blob, { upsert: true, contentType: c.blob.type || undefined })
    if (error) throw new Error(`comprobantes: ${error.message}`)
    await db.comprobantes_cola.delete(c.path)
  }
}

/** URL temporal (5 min) para abrir un comprobante ya subido. */
export async function urlComprobante(path: string): Promise<string> {
  if (!supabase) throw new Error('Sin sincronización configurada')
  const { data: s } = await supabase.auth.getSession()
  if (!s.session) throw new Error('Inicia sesión para ver los comprobantes')
  const { data, error } = await supabase.storage.from('comprobantes').createSignedUrl(`${s.session.user.id}/${path}`, 300)
  if (error) throw new Error(error.message)
  return data.signedUrl
}

// ---------- Sesión ----------

/** Borra todo lo local (al cambiar de cuenta o cerrar sesión). */
export async function borrarDatosLocales() {
  await db.transaction('rw', [...TABLAS_DATOS.map((t) => db[t]), db.meta, db.fotos, db.comprobantes_cola], async () => {
    for (const t of TABLAS_DATOS) await db[t].clear()
    await db.meta.clear()
    await db.fotos.clear()
    await db.comprobantes_cola.clear()
  })
}

/**
 * Tras iniciar sesión: si este dispositivo era de otra cuenta, se limpia. Si ya
 * tenía datos y la cuenta también, se pregunta cuáles conservar.
 */
export async function alIniciarSesion(uid: string) {
  const previo = await leerMeta<string>('usuario_local')
  if (previo && previo !== uid) {
    await borrarDatosLocales()
  } else if (!previo && (await db.vehicles.count()) > 0) {
    const { count } = await supabase!.from('vehicles').select('id', { count: 'exact', head: true })
    if (
      count &&
      window.confirm(
        'Tu cuenta ya tiene datos guardados.\n\n' +
          'Aceptar: usar los de la cuenta y descartar los de este dispositivo (recomendado).\n' +
          'Cancelar: juntar ambos.',
      )
    ) {
      await borrarDatosLocales()
    }
  }
  await guardarMeta('usuario_local', uid)
  await sincronizar()
}

/** Cuántos registros locales faltan por subir. */
export async function contarPendientes(): Promise<number> {
  const ultimoEnvio = await leerMeta<string>('sync_ultimo_envio')
  let n = 0
  for (const t of TABLAS_DATOS) {
    n += ultimoEnvio ? await tabla(t).where('updated_at').above(ultimoEnvio).count() : await tabla(t).count()
  }
  return n + (await db.fotos.filter((f) => !f.subida).count()) + (await db.comprobantes_cola.count())
}

export async function cerrarSesion(): Promise<boolean> {
  if (!supabase) return false
  await sincronizar()
  const pendientes = await contarPendientes()
  if (
    pendientes > 0 &&
    !window.confirm(`Hay ${pendientes} cambios sin subir que se perderán. ¿Cerrar sesión de todas formas?`)
  ) {
    return false
  }
  if (pendientes === 0 && !window.confirm('Al cerrar sesión se borran los datos de este dispositivo (siguen en tu cuenta). ¿Continuar?')) {
    return false
  }
  await supabase.auth.signOut()
  await borrarDatosLocales()
  return true
}
