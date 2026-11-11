// Lógica de gasolina y rendimiento — SPEC.md §5.1. Funciones puras.
import { diaNum } from './fechas'

export interface CargaBase {
  id: string
  fecha: string
  created_at: string
  km_recorridos: number
  litros: number
  full: boolean
}

/** Un tramo va de un full al siguiente: suma las cargas no full que haya en medio. */
export interface Tramo {
  id: string // id de la carga full que lo cierra
  fecha: string
  km: number
  litros: number
  kmL: number
  cargas: number
}

export const AJUSTES = {
  ventana: 3, // cargas evaluadas juntas
  referencia: 6, // cargas full anteriores a la ventana
  referenciaMin: 3, // mínimo para que la referencia tenga sentido
  suave: 0.15,
  fuerte: 0.25,
  positiva: 0.15,
  anomalo: 0.25, // una barra suelta se pinta en coral si cae ≥25 % bajo la referencia
  grafico: 10,
}

export function ordenar<T extends { fecha: string; created_at: string }>(xs: readonly T[]): T[] {
  return [...xs].sort((a, b) => a.fecha.localeCompare(b.fecha) || a.created_at.localeCompare(b.created_at))
}

export function calcularTramos(cargas: readonly CargaBase[]) {
  const tramos: Tramo[] = []
  let km = 0
  let litros = 0
  let n = 0
  for (const c of ordenar(cargas)) {
    km += c.km_recorridos
    litros += c.litros
    n++
    if (c.full) {
      if (litros > 0) tramos.push({ id: c.id, fecha: c.fecha, km, litros, kmL: km / litros, cargas: n })
      km = 0
      litros = 0
      n = 0
    }
  }
  return { tramos, pendiente: { km, litros, cargas: n } }
}

/** Σkm / Σlitros — nunca el promedio de los km/L individuales. */
export function rendimiento(ts: readonly Tramo[]): number | null {
  const l = ts.reduce((s, t) => s + t.litros, 0)
  return l > 0 ? ts.reduce((s, t) => s + t.km, 0) / l : null
}

interface Evaluacion {
  ventana: number
  referencia: number
  razon: number
}

/** Evalúa la ventana que termina en `fin` (exclusivo) contra las 6 cargas anteriores. */
function evaluar(ts: readonly Tramo[], fin: number): Evaluacion | null {
  const ini = fin - AJUSTES.ventana
  if (ini < 0) return null
  const ref = ts.slice(Math.max(0, ini - AJUSTES.referencia), ini)
  if (ref.length < AJUSTES.referenciaMin) return null
  const v = rendimiento(ts.slice(ini, fin))
  const r = rendimiento(ref)
  if (v === null || r === null) return null
  return { ventana: v, referencia: r, razon: v / r }
}

export type Alerta = 'suave' | 'fuerte' | 'positiva' | null

export interface Analisis {
  promedio: number | null
  ultima: Tramo | null
  recientes: Tramo[]
  referencia: number | null
  ventana: number | null
  alerta: Alerta
  anomalos: Set<string>
}

/**
 * @param reinicio fecha de una visita que "afecta el rendimiento": la referencia
 * solo usa cargas posteriores (las visitas llegan en la fase 2).
 */
export function analizar(todos: readonly Tramo[], reinicio: string | null = null): Analisis {
  const ts = reinicio ? todos.filter((t) => t.fecha > reinicio) : [...todos]

  // Se recorre la historia carga por carga. Mientras una ventana esté bajo el
  // umbral, la referencia queda congelada: si no, las cargas malas entrarían a
  // la referencia y "esconderían" un problema que se repite.
  let actual: Evaluacion | null = null
  let previaBaja = false
  let anteriorBaja = false
  let congelada: number | null = null
  for (let fin = AJUSTES.ventana; fin <= ts.length; fin++) {
    let e: Evaluacion | null = evaluar(ts, fin)
    if (!e) continue
    if (congelada !== null) e = { ventana: e.ventana, referencia: congelada, razon: e.ventana / congelada }
    const baja: boolean = e.razon <= 1 - AJUSTES.suave
    actual = e
    previaBaja = anteriorBaja
    anteriorBaja = baja
    congelada = baja ? e.referencia : null
  }

  let alerta: Alerta = null
  if (actual) {
    if (actual.razon <= 1 - AJUSTES.suave) {
      alerta = actual.razon <= 1 - AJUSTES.fuerte || previaBaja ? 'fuerte' : 'suave'
    } else if (actual.razon >= 1 + AJUSTES.positiva) {
      alerta = 'positiva'
    }
  }

  const recientes = todos.slice(-AJUSTES.grafico)
  const referencia = actual?.referencia ?? null
  const anomalos = new Set(
    referencia === null ? [] : recientes.filter((t) => t.kmL <= referencia * (1 - AJUSTES.anomalo)).map((t) => t.id),
  )

  return {
    promedio: rendimiento(recientes),
    ultima: todos.at(-1) ?? null,
    recientes,
    referencia,
    ventana: actual?.ventana ?? null,
    alerta,
    anomalos,
  }
}

/**
 * Km por día de los últimos `dias` días hasta la última carga. Los km de cada
 * carga se reparten entre los días transcurridos desde la carga anterior.
 */
export function kmPorDia(cargas: readonly CargaBase[], dias = 7): number | null {
  const cs = ordenar(cargas)
  if (cs.length < 2) return null
  const fin = diaNum(cs[cs.length - 1].fecha)
  const inicio = fin - dias // exclusivo
  let total = 0
  for (let i = 1; i < cs.length; i++) {
    const b = diaNum(cs[i].fecha)
    const largo = Math.max(1, b - diaNum(cs[i - 1].fecha))
    const solape = Math.max(0, b - Math.max(b - largo, inicio))
    total += (cs[i].km_recorridos * solape) / largo
  }
  const cubiertos = Math.min(dias, Math.max(1, fin - diaNum(cs[0].fecha)))
  return total / cubiertos
}
