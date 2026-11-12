// Kilometraje total — SPEC.md §5.2
import { ordenar } from './gasolina'

interface Correccion {
  fecha: string
  created_at: string
  km_total: number
}

interface Carga {
  fecha: string
  created_at: string
  km_recorridos: number | null
}

/**
 * Momento aproximado de un registro: su fecha con la hora en que se anotó, si
 * se anotó ese mismo día; si no, el mediodía de esa fecha.
 */
export function momento(r: { fecha: string; created_at: string }): number {
  const c = new Date(r.created_at)
  const dia = `${c.getFullYear()}-${String(c.getMonth() + 1).padStart(2, '0')}-${String(c.getDate()).padStart(2, '0')}`
  return dia === r.fecha ? c.getTime() : new Date(`${r.fecha}T12:00:00`).getTime()
}

/**
 * Última corrección + km de las cargas posteriores.
 *
 * Los km de una carga son los recorridos desde la carga anterior, así que la
 * primera carga después de una lectura del tablero ya está en parte dentro de
 * esa lectura: de ella solo se cuenta la fracción del tiempo posterior a la
 * lectura. Las siguientes cuentan completas.
 */
export function kmActual(correcciones: readonly Correccion[], cargas: readonly Carga[]): number | null {
  const base = ordenar(correcciones).at(-1)
  if (!base) return null
  const mBase = momento(base)
  const todas = ordenar(cargas).map((c) => ({ c, m: momento(c) }))
  let total = base.km_total
  let primera = true
  for (let i = 0; i < todas.length; i++) {
    const { c, m } = todas[i]
    if (m <= mBase) continue
    const km = c.km_recorridos ?? 0
    if (primera) {
      primera = false
      const anterior = todas.slice(0, i).filter((x) => x.m < m).at(-1)
      if (anterior && m > anterior.m) {
        total += km * Math.min(1, Math.max(0, (m - mBase) / (m - anterior.m)))
        continue
      }
    }
    total += km
  }
  return total
}
