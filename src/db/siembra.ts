import { db, type Vehiculo } from './esquema'
import { actualizar, borrar, crear } from './repo'
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

/**
 * Balanceo y rotación se hacen juntos: una sola tarea. En vehículos creados
 * antes de este cambio se elimina "Rotación de cauchos" y se renombra
 * "Balanceo". Una vez por dispositivo; no hace nada si ya está aplicado.
 */
export async function unirBalanceoYRotacion(vehiculoId: string) {
  const clave = `balanceo_rotacion_unidos_${vehiculoId}`
  await db.transaction('rw', db.meta, db.maintenance_tasks, async () => {
    if (await db.meta.get(clave)) return
    const tareas = (await db.maintenance_tasks.where('vehicle_id').equals(vehiculoId).toArray()).filter((t) => !t.deleted)
    const rotacion = tareas.find((t) => t.clave === 'rotacion')
    const balanceo = tareas.find((t) => t.clave === 'balanceo')
    if (rotacion) await borrar(db.maintenance_tasks, rotacion.id)
    if (balanceo && balanceo.nombre === 'Balanceo') {
      await actualizar(db.maintenance_tasks, balanceo.id, { nombre: 'Balanceo y rotación', notas: balanceo.notas || 'Se hacen juntos.' })
    }
    await db.meta.put({ clave, valor: true })
  })
}