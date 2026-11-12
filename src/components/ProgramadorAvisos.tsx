import { useEffect, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/esquema'
import { useGasolina, useKilometraje, useMantenimiento, useUmbralPronto, useVehiculoActivo } from '../db/hooks'
import { PREFERENCIAS_INICIALES, proyectarAvisos, type PreferenciasAvisos } from '../lib/avisos'
import { useEnLinea } from '../lib/useEnLinea'
import { programarAvisos } from '../sync/avisos'
import { useSesion } from '../sync/hooks'

/**
 * Recalcula cuándo avisar de cada tarea y lo deja programado en la cuenta.
 * Solo corre en dispositivos con los avisos activados.
 */
export function ProgramadorAvisos() {
  const vehiculo = useVehiculoActivo()
  const mant = useMantenimiento(vehiculo.id)
  const { kmDia } = useGasolina(vehiculo.id)
  const kmTotal = useKilometraje(vehiculo.id)
  const umbral = useUmbralPronto()
  const sesion = useSesion()
  const enLinea = useEnLinea()
  const prefs = useLiveQuery(async () => ({ ...PREFERENCIAS_INICIALES, ...((await db.meta.get('avisos'))?.valor as PreferenciasAvisos | undefined) }))

  const avisos = useMemo(() => {
    if (!mant || kmTotal === undefined || !prefs?.activos) return null
    return mant.estados
      .filter((e) => (e.tarea.clave === 'presion_cauchos' ? prefs.aire : e.tarea.clave === 'revision_semanal' ? prefs.revisionSemanal : true))
      .flatMap((e) => proyectarAvisos(e, kmTotal, kmDia, umbral))
  }, [mant, kmTotal, kmDia, umbral, prefs])

  const firma = avisos?.map((a) => `${a.clave}@${a.fecha_envio}`).sort().join(';')
  useEffect(() => {
    if (!avisos || !sesion || !enLinea) return
    const t = window.setTimeout(() => programarAvisos(avisos).catch((e) => console.warn('Avisos', e)), 4000)
    return () => window.clearTimeout(t)
  }, [firma, sesion, enLinea]) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
