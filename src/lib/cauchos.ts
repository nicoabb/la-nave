// Cauchos — SPEC.md §5.6. Funciones puras.
import { diaNum } from './fechas'
import type { Estado } from './tareas'

export type Posicion = 'DI' | 'DD' | 'TI' | 'TD' | 'REP'

export const POSICIONES: readonly { valor: Posicion; texto: string }[] = [
  { valor: 'DI', texto: 'Del. izquierdo' },
  { valor: 'DD', texto: 'Del. derecho' },
  { valor: 'TI', texto: 'Tras. izquierdo' },
  { valor: 'TD', texto: 'Tras. derecho' },
  { valor: 'REP', texto: 'Repuesto' },
]

export const textoPosicion = (p: Posicion) => POSICIONES.find((x) => x.valor === p)!.texto

export const VIDA_UTIL_KM = 30000
export const EDAD_PRONTO = 6
export const EDAD_URGENTE = 10

/** Tipo de evento → clave de la tarea periódica que completa. */
export const TAREA_DE_EVENTO: Record<string, string> = {
  rotacion: 'rotacion',
  balanceo: 'balanceo',
  alineacion: 'alineacion',
  presion: 'presion_cauchos',
}

/** Edad en años según el DOT (semana y año). Sin semana se asume mitad de año. */
export function edadAnios(dotAnio: number | null, dotSemana: number | null, hoy: string): number | null {
  if (!dotAnio) return null
  const fabricacion = Date.UTC(dotAnio, 0, 1) / 86_400_000 + ((dotSemana ?? 26) - 1) * 7
  return Math.max(0, (diaNum(hoy) - fabricacion) / 365.25)
}

export function textoEdad(edad: number): string {
  const a = Math.floor(edad)
  if (a < 1) return 'menos de 1 año'
  return `${a} ${a === 1 ? 'año' : 'años'}`
}

interface CauchoDatos {
  dot_anio: number | null
  dot_semana: number | null
  km_montaje: number | null
  posicion: Posicion
}

export interface EstadoCaucho {
  estado: Estado
  motivo: string
  edad: number | null
  kmUso: number | null
}

export function evaluarCaucho(
  c: CauchoDatos,
  kmActual: number | null,
  hoy: string,
  vidaUtil = VIDA_UTIL_KM,
  umbral = 0.85,
): EstadoCaucho {
  const edad = edadAnios(c.dot_anio, c.dot_semana, hoy)
  // El repuesto no rueda: solo cuenta su edad
  const kmUso = c.posicion !== 'REP' && c.km_montaje != null && kmActual != null ? Math.max(0, kmActual - c.km_montaje) : null

  if (edad !== null && edad >= EDAD_URGENTE) return { estado: 'urgente', motivo: `Tiene ${textoEdad(edad)}`, edad, kmUso }
  if (kmUso !== null && kmUso >= vidaUtil) return { estado: 'urgente', motivo: 'Llegó a su vida útil en km', edad, kmUso }
  if (edad !== null && edad >= EDAD_PRONTO) return { estado: 'pronto', motivo: `Tiene ${textoEdad(edad)}`, edad, kmUso }
  if (kmUso !== null && kmUso >= vidaUtil * umbral) return { estado: 'pronto', motivo: 'Cerca de su vida útil en km', edad, kmUso }
  return { estado: 'en-orden', motivo: '', edad, kmUso }
}

/** Valida un mapeo de rotación: ninguna posición repetida. */
export function rotacionValida(mapa: Record<string, Posicion>): boolean {
  const ps = Object.values(mapa)
  return new Set(ps).size === ps.length
}
