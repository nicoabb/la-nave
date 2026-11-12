import { db, type Vehiculo } from './esquema'
import { crear } from './repo'
import { PLANTILLA_TAREAS } from '../lib/catalogos'

/** Precarga las tareas periódicas del vehículo una sola vez (SPEC §7). */
export async function asegurarTareas(v: Vehiculo) {
  const clave = `tareas_sembradas_${v.id}`
  await db.transaction('rw', db.meta, db.maintenance_tasks, async () => {
    if (await db.meta.get(clave)) return
    const existentes = await db.maintenance_tasks.where('vehicle_id').equals(v.id).count()
    if (existentes === 0) {
      for (const p of PLANTILLA_TAREAS) {
        if (p.soloAutomatico && v.transmision !== 'automático') continue
        await crear(db.maintenance_tasks, {
          vehicle_id: v.id,
          clave: p.clave,
          nombre: p.nombre,
          sistema: p.sistema,
          intervalo_km: p.intervalo_km,
          intervalo_dias: p.intervalo_dias,
          ultima_km_inicial: null,
          ultima_fecha_inicial: null,
          activa: true,
          notas: p.notas,
          es_revision: p.es_revision,
          fuente: p.fuente,
          costo_estimado_usd: null,
        })
      }
    }
    await db.meta.put({ clave, valor: true })
  })
}
