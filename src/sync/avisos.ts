// Notificaciones push (fase 7): suscripción del dispositivo y avisos programados.
import { leerMeta, guardarMeta } from '../db/repo'
import type { AvisoProgramado, PreferenciasAvisos } from '../lib/avisos'
import { PREFERENCIAS_INICIALES } from '../lib/avisos'
import { supabase } from './cliente'

/** Clave pública VAPID (no es secreta: identifica a la app ante el servicio de notificaciones). */
const VAPID_PUBLICA = 'BCLa8hpPGAdkQ281AE4bSFlxzBXNWlM7wLQqFQkT-dvY_YEmuou98nJpPs4LQHZnI2Cpj2_hJOe_5vdk_aY9GGs'

export const avisosSoportados = () =>
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && Boolean(supabase)

export async function leerPreferencias(): Promise<PreferenciasAvisos> {
  return { ...PREFERENCIAS_INICIALES, ...((await leerMeta<PreferenciasAvisos>('avisos')) ?? {}) }
}

function aBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const b64 = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64)
  const bytes = new Uint8Array(new ArrayBuffer(bin.length))
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

/** Pide permiso, suscribe este dispositivo y lo registra en la cuenta. */
export async function activarAvisos(prefs: PreferenciasAvisos) {
  if (!supabase) throw new Error('La sincronización no está configurada.')
  if (!navigator.onLine) throw new Error('Necesitas conexión para activar los avisos.')
  const permiso = await Notification.requestPermission()
  if (permiso !== 'granted') throw new Error('No diste permiso de notificaciones. Puedes darlo en los ajustes del navegador.')
  const registro = await navigator.serviceWorker.ready
  const sub =
    (await registro.pushManager.getSubscription()) ??
    (await registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: aBytes(VAPID_PUBLICA) }))
  const json = sub.toJSON()
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert({ endpoint: sub.endpoint, p256dh: json.keys!.p256dh, auth: json.keys!.auth }, { onConflict: 'endpoint' })
  if (error) throw new Error(error.message)
  await guardarMeta('avisos', { ...prefs, activos: true })
}

export async function desactivarAvisos() {
  await guardarMeta('avisos', { ...(await leerPreferencias()), activos: false })
  const registro = await navigator.serviceWorker.ready
  const sub = await registro.pushManager.getSubscription()
  if (sub) {
    await supabase?.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
    await sub.unsubscribe()
  }
}

/**
 * Sincroniza los avisos programados con lo calculado: agrega los nuevos (sin
 * tocar los ya enviados) y quita los pendientes que ya no aplican.
 */
export async function programarAvisos(avisos: AvisoProgramado[]) {
  if (!supabase || !navigator.onLine) return
  const { data } = await supabase.auth.getSession()
  if (!data.session) return
  if (avisos.length) {
    // Actualiza fecha y texto de los pendientes; 'enviado' no se toca
    const { error } = await supabase.from('avisos_programados').upsert(avisos, { onConflict: 'user_id,clave' })
    if (error) throw new Error(error.message)
  }
  let borrar = supabase.from('avisos_programados').delete().eq('enviado', false)
  if (avisos.length) borrar = borrar.not('clave', 'in', `(${avisos.map((a) => `"${a.clave}"`).join(',')})`)
  const { error } = await borrar
  if (error) throw new Error(error.message)
}
