import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useSesion, useEstadoSync, usePendientesSync } from '../sync/hooks'
import { sincronizar } from '../sync/motor'
import { useEnLinea } from '../lib/useEnLinea'

/**
 * Dispara la sincronización: al abrir la app, al recuperar conexión, al volver
 * a la app y después de cada guardado (con espera de 3 s).
 */
export function Sincronizador() {
  const sesion = useSesion()
  const pendientes = usePendientesSync()
  const enLinea = useEnLinea()
  const conSesion = Boolean(sesion)

  useEffect(() => {
    if (conSesion && enLinea) sincronizar()
  }, [conSesion, enLinea])

  useEffect(() => {
    if (!conSesion) return
    const alVolver = () => document.visibilityState === 'visible' && sincronizar()
    document.addEventListener('visibilitychange', alVolver)
    return () => document.removeEventListener('visibilitychange', alVolver)
  }, [conSesion])

  useEffect(() => {
    if (!conSesion || !enLinea || pendientes === 0) return
    const t = window.setTimeout(() => sincronizar(), 3000)
    return () => window.clearTimeout(t)
  }, [conSesion, enLinea, pendientes])

  return null
}

/** Indicador discreto: "Sincronizado", "Pendiente de sincronizar" o "Sin conexión". */
export function IndicadorSync() {
  const estado = useEstadoSync()
  const pendientes = usePendientesSync()
  const enLinea = useEnLinea()
  const sesion = useSesion()

  let texto: string
  let color: string
  if (!sesion) {
    texto = 'Solo en este teléfono'
    color = 'var(--text-muted)'
  } else if (!enLinea || estado === 'sin-conexion') {
    texto = 'Sin conexión'
    color = 'var(--mantequilla)'
  } else if (estado === 'error') {
    texto = 'Error al sincronizar'
    color = 'var(--coral)'
  } else if (estado === 'sincronizando') {
    texto = 'Sincronizando…'
    color = 'var(--cielo)'
  } else if (pendientes > 0) {
    texto = 'Pendiente de sincronizar'
    color = 'var(--mantequilla)'
  } else {
    texto = 'Sincronizado'
    color = 'var(--menta)'
  }

  return (
    <Link to="/configuracion" className="estado-red" role="status" aria-label={`${texto}. Abrir configuración`}>
      <span className="punto" style={{ background: color }} />
      {texto}
    </Link>
  )
}
