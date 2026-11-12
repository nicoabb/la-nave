import { useEffect, useState, useSyncExternalStore } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { Session } from '@supabase/supabase-js'
import { db, TABLAS_DATOS } from '../db/esquema'
import { supabase } from './cliente'
import { contarPendientes, leerEstado, suscribirEstado } from './motor'

export function useEstadoSync() {
  return useSyncExternalStore(suscribirEstado, leerEstado)
}

/** undefined = cargando · null = sin sesión */
export function useSesion(): Session | null | undefined {
  const [sesion, setSesion] = useState<Session | null | undefined>(supabase ? undefined : null)
  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => setSesion(data.session))
    const { data } = supabase.auth.onAuthStateChange((_evento, s) => setSesion(s))
    return () => data.subscription.unsubscribe()
  }, [])
  return sesion
}

/** Se recalcula cada vez que cambia algo en la base local. */
export function usePendientesSync(): number {
  return useLiveQuery(
    async () => {
      // Se leen las tablas para que liveQuery se suscriba a sus cambios
      await Promise.all([...TABLAS_DATOS.map((t) => db[t].count()), db.meta.count(), db.fotos.count(), db.comprobantes_cola.count()])
      return contarPendientes()
    },
    [],
    0,
  )
}
