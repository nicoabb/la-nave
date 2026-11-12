// Notificaciones push (fase 7). Se carga dentro del service worker de la PWA.
self.addEventListener('push', (evento) => {
  let datos = {}
  try {
    datos = evento.data ? evento.data.json() : {}
  } catch {
    datos = { titulo: 'La Nave', cuerpo: evento.data ? evento.data.text() : '' }
  }
  evento.waitUntil(
    self.registration.showNotification(datos.titulo || 'La Nave', {
      body: datos.cuerpo || '',
      icon: 'pwa-192x192.png',
      badge: 'pwa-64x64.png',
      tag: datos.tag || 'la-nave',
      data: { url: datos.url || './#/pendientes' },
    }),
  )
})

self.addEventListener('notificationclick', (evento) => {
  evento.notification.close()
  const url = new URL(evento.notification.data?.url || './', self.registration.scope).href
  evento.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((ventanas) => {
      for (const v of ventanas) {
        if ('focus' in v) {
          v.navigate?.(url)
          return v.focus()
        }
      }
      return self.clients.openWindow(url)
    }),
  )
})
