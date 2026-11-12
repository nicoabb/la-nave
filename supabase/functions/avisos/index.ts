// La Nave — función diaria de avisos (fase 7).
// La app ya calculó qué avisar y cuándo (tabla avisos_programados); esta
// función solo envía lo que toca hoy y lo marca como enviado.
//
// Secretos (Edge Functions → Secrets): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY,
// AVISOS_SECRETO. SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY ya vienen.
// "Verify JWT" desactivado: se protege con el encabezado x-avisos-secreto.
import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'npm:@supabase/supabase-js@2'

const hoyCaracas = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Caracas', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())

Deno.serve(async (req) => {
  if (req.headers.get('x-avisos-secreto') !== Deno.env.get('AVISOS_SECRETO')) {
    return new Response('No autorizado', { status: 401 })
  }

  webpush.setVapidDetails('https://nicoabb.github.io/la-nave/', Deno.env.get('VAPID_PUBLIC_KEY')!, Deno.env.get('VAPID_PRIVATE_KEY')!)
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const { data: avisos, error } = await sb
    .from('avisos_programados')
    .select('id, user_id, titulo, cuerpo')
    .eq('enviado', false)
    .lte('fecha_envio', hoyCaracas())
  if (error) return new Response(error.message, { status: 500 })

  // Agrupados por persona: si hay varios el mismo día, va una sola notificación
  const porUsuario = new Map<string, typeof avisos>()
  for (const a of avisos ?? []) porUsuario.set(a.user_id, [...(porUsuario.get(a.user_id) ?? []), a])

  let enviados = 0
  for (const [userId, lista] of porUsuario) {
    const { data: subs } = await sb.from('push_subscriptions').select('id, endpoint, p256dh, auth').eq('user_id', userId)
    const mensaje =
      lista.length === 1
        ? { titulo: lista[0].titulo, cuerpo: lista[0].cuerpo }
        : { titulo: `${lista.length} tareas cambiaron de estado`, cuerpo: lista.map((a) => a.titulo).join(' · ') }
    for (const s of subs ?? []) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({ ...mensaje, url: './#/pendientes', tag: 'la-nave-tareas' }),
        )
        enviados++
      } catch (e) {
        // Suscripción vencida (desinstalaron la app o quitaron el permiso): se borra
        const codigo = (e as { statusCode?: number }).statusCode
        if (codigo === 404 || codigo === 410) await sb.from('push_subscriptions').delete().eq('id', s.id)
      }
    }
    await sb.from('avisos_programados').update({ enviado: true }).in('id', lista.map((a) => a.id))
  }

  return Response.json({ avisos: avisos?.length ?? 0, enviados })
})
