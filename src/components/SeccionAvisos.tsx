import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Bell, BellOff } from 'lucide-react'
import { db } from '../db/esquema'
import { guardarMeta } from '../db/repo'
import { PREFERENCIAS_INICIALES, type PreferenciasAvisos } from '../lib/avisos'
import { activarAvisos, avisosSoportados, desactivarAvisos } from '../sync/avisos'
import { useSesion } from '../sync/hooks'
import { useAviso } from './Aviso'

/** Configuración de las notificaciones (fase 7). */
export function SeccionAvisos() {
  const avisar = useAviso()
  const sesion = useSesion()
  const prefs = useLiveQuery(async () => ({ ...PREFERENCIAS_INICIALES, ...((await db.meta.get('avisos'))?.valor as PreferenciasAvisos | undefined) }))
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState('')

  if (!prefs) return null
  if (!avisosSoportados()) return <span className="muted mini">Este navegador no admite notificaciones.</span>
  if (!sesion) return <span className="muted mini">Inicia sesión para activar los avisos.</span>

  async function alternar() {
    setOcupado(true)
    setError('')
    try {
      if (prefs!.activos) {
        await desactivarAvisos()
        avisar('Avisos desactivados')
      } else {
        await activarAvisos(prefs!)
        avisar('Avisos activados', 'Te avisaremos solo cuando una tarea pase a Pronto o Urgente, a las 9 a. m.')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setOcupado(false)
    }
  }

  const cambiar = (k: 'aire' | 'revisionSemanal', v: boolean) => guardarMeta('avisos', { ...prefs, [k]: v })

  return (
    <>
      <span className="muted mini">
        Un aviso cuando una tarea pasa a Pronto y otro si llega a Urgente, una sola vez y a las 9 a. m. Nunca por tareas
        «Sin registro» ni por las que estén pospuestas.
      </span>
      {prefs.activos && (
        <>
          <label className="check">
            <input type="checkbox" checked={prefs.aire} onChange={(e) => cambiar('aire', e.target.checked)} />
            Incluir la presión de aire (cada 2 semanas)
          </label>
          <label className="check">
            <input type="checkbox" checked={prefs.revisionSemanal} onChange={(e) => cambiar('revisionSemanal', e.target.checked)} />
            Incluir la revisión semanal del capó
          </label>
        </>
      )}
      {error && <p className="error" role="alert">{error}</p>}
      <button className={`btn btn--bloque${prefs.activos ? '' : ' btn--primario'}`} disabled={ocupado} onClick={alternar}>
        {prefs.activos ? <BellOff size={18} strokeWidth={1.8} /> : <Bell size={18} strokeWidth={1.8} />}
        {ocupado ? 'Un momento…' : prefs.activos ? 'Desactivar avisos en este dispositivo' : 'Activar avisos en este dispositivo'}
      </button>
    </>
  )
}
