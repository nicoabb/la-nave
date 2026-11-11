import { useSyncExternalStore } from 'react'

function suscribir(cb: () => void) {
  window.addEventListener('online', cb)
  window.addEventListener('offline', cb)
  return () => {
    window.removeEventListener('online', cb)
    window.removeEventListener('offline', cb)
  }
}

export function useEnLinea() {
  return useSyncExternalStore(suscribir, () => navigator.onLine)
}
