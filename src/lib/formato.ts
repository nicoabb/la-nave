// Convenciones de formato es-VE — SPEC.md §2.

const LOCALE = 'es-VE'

/** 214380 → "214.380" ; 11.9 → "11,9" */
export function numero(valor: number, decimales = 0): string {
  return new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
    useGrouping: true,
  })
    .format(valor)
    // Algunos motores no agrupan números de 4 cifras en es; forzamos el punto.
    .replace(/^(-?\d)(\d{3})(,|$)/, '$1.$2$3')
}

export const km = (v: number) => `${numero(v)} km`
export const litros = (v: number) => `${numero(v, 1)} L`
export const kmPorLitro = (v: number) => `${numero(v, 1)} km/L`

/** dd/mm/aaaa para formularios y listas */
export function fecha(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${d.getFullYear()}`
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** "11 nov 2026" para tarjetas */
export function fechaCorta(d: Date): string {
  return `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}`
}

/** Acepta "34,6", "34.6" o "1.234,5" y devuelve número (o null). */
export function leerNumero(texto: string): number | null {
  const t = texto.trim().replace(/\s/g, '')
  if (!t) return null
  let normal: string
  if (t.includes(',') && t.includes('.')) {
    // El último separador es el decimal
    normal = t.lastIndexOf(',') > t.lastIndexOf('.')
      ? t.replace(/\./g, '').replace(',', '.')
      : t.replace(/,/g, '')
  } else {
    normal = t.replace(',', '.')
  }
  const n = Number(normal)
  return Number.isFinite(n) ? n : null
}
