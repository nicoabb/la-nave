// Tareas periódicas, semáforo y estimados — SPEC.md §5.3 y §5.4. Funciones puras.
import { diaNum } from './fechas'
import { km, numero } from './formato'

export type Estado = 'urgente' | 'pronto' | 'en-orden'

export const UMBRAL_PRONTO = 0.85

export interface TareaDatos {
  id: string
  intervalo_km: number | null
  intervalo_dias: number | null
  ultima_km_inicial: number | null
  ultima_fecha_inicial: string | null
}

/** Una vez que se hizo la tarea: ítem de taller o revisión vinculados. */
export interface Hecho {
  task_id: string
  fecha: string
  km: number | null
}

export interface EstadoTarea<T extends TareaDatos = TareaDatos> {
  tarea: T
  ultimaFecha: string | null
  ultimaKm: number | null
  pctKm: number | null
  pctTiempo: number | null
  restanteKm: number | null
  restanteDias: number | null
  progreso: number
  estado: Estado
  texto: string
  desconocida: boolean
}

export function estadoDe(progreso: number, umbral = UMBRAL_PRONTO): Estado {
  if (progreso >= 1) return 'urgente'
  if (progreso >= umbral) return 'pronto'
  return 'en-orden'
}

/** 7 → "7 días" ; 182 → "6 meses" ; 730 → "2 años" */
export function duracion(dias: number): string {
  const d = Math.round(Math.abs(dias))
  if (d >= 365) {
    const a = Math.round((d / 365) * 10) / 10
    return `${numero(a, 0, 1)} ${a === 1 ? 'año' : 'años'}`
  }
  if (d >= 60) return `${Math.round(d / 30.44)} meses`
  return `${d} ${d === 1 ? 'día' : 'días'}`
}

export function describirIntervalo(t: { intervalo_km: number | null; intervalo_dias: number | null }): string {
  const partes = [t.intervalo_km ? km(t.intervalo_km) : null, t.intervalo_dias ? duracion(t.intervalo_dias) : null].filter(Boolean)
  return partes.length ? `Cada ${partes.join(' o ')}` : 'Sin intervalo'
}

const textoKm = (r: number) => (r > 0 ? `Faltan ${km(r)}` : r === 0 ? 'Vence ahora' : `Vencida hace ${km(-r)}`)
const textoDias = (r: number) => (r > 0 ? `Faltan ${duracion(r)}` : r === 0 ? 'Vence hoy' : `Vencida hace ${duracion(-r)}`)

export function evaluarTarea<T extends TareaDatos>(
  t: T,
  hechos: readonly Hecho[],
  kmActual: number | null,
  hoy: string,
  umbral = UMBRAL_PRONTO,
): EstadoTarea<T> {
  const propios = hechos.filter((h) => h.task_id === t.id)
  const fechas = propios.map((h) => h.fecha)
  if (t.ultima_fecha_inicial) fechas.push(t.ultima_fecha_inicial)
  const kms = propios.map((h) => h.km).filter((k): k is number => k != null)
  if (t.ultima_km_inicial != null) kms.push(t.ultima_km_inicial)

  const ultimaFecha = fechas.length ? fechas.reduce((a, b) => (a > b ? a : b)) : null
  const ultimaKm = kms.length ? Math.max(...kms) : null

  const restanteKm =
    t.intervalo_km && ultimaKm != null && kmActual != null
      ? Math.round(t.intervalo_km - Math.max(0, kmActual - ultimaKm))
      : null
  const restanteDias =
    t.intervalo_dias && ultimaFecha ? t.intervalo_dias - Math.max(0, diaNum(hoy) - diaNum(ultimaFecha)) : null
  const pctKm = restanteKm != null ? 1 - restanteKm / t.intervalo_km! : null
  const pctTiempo = restanteDias != null ? 1 - restanteDias / t.intervalo_dias! : null

  const base = { tarea: t, ultimaFecha, ultimaKm, pctKm, pctTiempo, restanteKm, restanteDias }
  if (pctKm === null && pctTiempo === null) {
    return { ...base, progreso: 1, estado: 'urgente', texto: 'Sin registro: verificar', desconocida: true }
  }
  // Vence lo que ocurra primero
  const usaKm = pctKm !== null && (pctTiempo === null || pctKm >= pctTiempo)
  const progreso = usaKm ? pctKm! : pctTiempo!
  return {
    ...base,
    progreso,
    estado: estadoDe(progreso, umbral),
    texto: usaKm ? textoKm(restanteKm!) : textoDias(restanteDias!),
    desconocida: false,
  }
}

const RANGO: Record<Estado, number> = { urgente: 2, pronto: 1, 'en-orden': 0 }

export function ordenarPorPrioridad<T extends { estado: Estado; progreso: number }>(xs: T[]): T[] {
  return xs.sort((a, b) => RANGO[b.estado] - RANGO[a.estado] || b.progreso - a.progreso)
}

/** Promedio en USD de las últimas 3 veces que se hizo (ítems vinculados por visita). */
export function estimarCosto(
  taskId: string,
  items: readonly { task_id: string | null; visit_id: string; monto_usd: number | null }[],
  visitas: readonly { id: string; fecha: string }[],
  n = 3,
): { usd: number; veces: number } | null {
  const porVisita = new Map<string, number>()
  for (const i of items) {
    if (i.task_id === taskId && i.monto_usd != null) porVisita.set(i.visit_id, (porVisita.get(i.visit_id) ?? 0) + i.monto_usd)
  }
  const ultimas = visitas
    .filter((v) => (porVisita.get(v.id) ?? 0) > 0)
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
    .slice(0, n)
  if (!ultimas.length) return null
  return { usd: ultimas.reduce((s, v) => s + porVisita.get(v.id)!, 0) / ultimas.length, veces: ultimas.length }
}
