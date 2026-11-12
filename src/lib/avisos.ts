// Avisos de tareas (fase 7). Funciones puras: calculan CUÁNDO una tarea pasa
// a Pronto o Urgente, para que el servidor solo tenga que enviar.
import { diaNum, hoyISO } from './fechas'
import { km as kmTexto } from './formato'
import { duracion, type EstadoTarea, type TareaDatos } from './tareas'

export interface PreferenciasAvisos {
  activos: boolean
  /** Recordatorio de la presión de aire (cada 2 semanas) */
  aire: boolean
  /** Recordatorio de la revisión semanal del capó */
  revisionSemanal: boolean
}

export const PREFERENCIAS_INICIALES: PreferenciasAvisos = { activos: false, aire: false, revisionSemanal: false }

export interface AvisoProgramado {
  clave: string
  titulo: string
  cuerpo: string
  fecha_envio: string
}

interface TareaAviso extends TareaDatos {
  nombre: string
  clave: string | null
  pospuesta_hasta?: string | null
}

const sumarDias = (iso: string, dias: number) => {
  const [y, m, d] = iso.split('-').map(Number)
  const f = new Date(Date.UTC(y, m - 1, d + dias))
  return f.toISOString().slice(0, 10)
}
const masTarde = (a: string, b: string) => (a > b ? a : b)

/** ¿La tarea está pospuesta hoy? */
export const estaPospuesta = (t: { pospuesta_hasta?: string | null }, hoy = hoyISO()) =>
  Boolean(t.pospuesta_hasta && t.pospuesta_hasta > hoy)

/**
 * Para una tarea, los avisos de "Pronto" y "Urgente" con la fecha en que
 * ocurrirán (o hoy, si ya ocurrieron). La clave cambia cuando la tarea se
 * vuelve a hacer, así que cada aviso sale una sola vez por ciclo.
 */
export function proyectarAvisos<T extends TareaAviso>(
  e: EstadoTarea<T>,
  kmActual: number | null,
  kmDia: number | null,
  umbral: number,
  hoy = hoyISO(),
): AvisoProgramado[] {
  const t = e.tarea
  if (e.desconocida) return [] // "Sin registro": no es un vencimiento, no se avisa
  const salida: AvisoProgramado[] = []

  for (const [estado, objetivo] of [
    ['pronto', umbral],
    ['urgente', 1],
  ] as const) {
    if (estado === 'pronto' && e.estado === 'urgente') continue // ya pasó de largo
    let fecha: string | null = null
    let porKm = false
    if (t.intervalo_dias && e.ultimaFecha) {
      fecha = sumarDias(e.ultimaFecha, Math.ceil(t.intervalo_dias * objetivo))
    }
    if (t.intervalo_km && e.ultimaKm != null && kmActual != null) {
      const faltan = e.ultimaKm + t.intervalo_km * objetivo - kmActual
      const dias = faltan <= 0 ? 0 : kmDia && kmDia > 0 ? Math.ceil(faltan / kmDia) : null
      if (dias !== null) {
        const f = sumarDias(hoy, dias)
        if (!fecha || f < fecha) {
          fecha = f
          porKm = true
        }
      }
    }
    if (!fecha) continue
    // Si está pospuesta, el aviso espera a que termine la posposición
    fecha = masTarde(fecha, hoy)
    if (t.pospuesta_hasta) fecha = masTarde(fecha, t.pospuesta_hasta)

    const resto = porKm ? kmTexto(Math.round((t.intervalo_km! * (1 - objetivo)) / 50) * 50) : duracion(t.intervalo_dias! * (1 - objetivo))
    salida.push({
      clave: [t.id, estado, e.ultimaFecha ?? '', e.ultimaKm ?? ''].join('|'),
      titulo: estado === 'urgente' ? `Ya toca: ${t.nombre}` : `Se acerca: ${t.nombre}`,
      cuerpo: estado === 'urgente' ? 'Pasó a Urgente.' : `Pasó a Pronto: faltan unos ${resto}.`,
      fecha_envio: fecha,
    })
  }
  return salida
}

/** Días hasta una fecha (para mostrar "en N días"). */
export const diasHasta = (fecha: string, hoy = hoyISO()) => diaNum(fecha) - diaNum(hoy)
