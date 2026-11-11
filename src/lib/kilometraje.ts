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
  km_recorridos: number
}

/** Última corrección + Σ km de las cargas posteriores a ella. */
export function kmActual(correcciones: readonly Correccion[], cargas: readonly Carga[]): number | null {
  const base = ordenar(correcciones).at(-1)
  if (!base) return null
  const posteriores = cargas.filter(
    (c) => c.fecha > base.fecha || (c.fecha === base.fecha && c.created_at > base.created_at),
  )
  return base.km_total + posteriores.reduce((s, c) => s + c.km_recorridos, 0)
}
