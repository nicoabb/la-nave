// Convenciones de formato es-VE — SPEC.md §2.
import { aFecha } from './fechas'

const LOCALE = 'es-VE'

/** 214380 → "214.380" ; numero(11.94, 1) → "11,9" ; numero(25.46, 0, 2) → "25,46" */
export function numero(valor: number, decimales = 0, maxDecimales = decimales): string {
  return new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: decimales,
    maximumFractionDigits: maxDecimales,
    useGrouping: true,
  })
    .format(valor)
    // En español no se agrupan los números de 4 cifras; aquí sí queremos "1.240".
    .replace(/^(-?\d)(\d{3})(,|$)/, '$1.$2$3')
}

export const km = (v: number) => `${numero(v)} km`
/** Km de un viaje: hasta 1 decimal ("244,6 km", "217 km") */
export const kmViaje = (v: number) => `${numero(v, 0, 1)} km`
export const litros = (v: number) => `${numero(v, 0, 2)} L`
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

export const fechaLista = (iso: string) => fecha(aFecha(iso))
export const fechaTarjeta = (iso: string) => fechaCorta(aFecha(iso))

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

/** Para el odómetro: "214.380" o "214380" → 214380 (el punto es de miles). */
export function leerEntero(texto: string): number | null {
  const t = texto.trim().replace(/[\s.]/g, '').split(',')[0]
  if (!t) return null
  const n = Number(t)
  return Number.isInteger(n) ? n : null
}

/** Número → texto editable con coma decimal */
export const aTexto = (n: number | null | undefined) => (n == null ? '' : String(n).replace('.', ','))

export const simboloMoneda = (m: 'USD' | 'VES') => (m === 'VES' ? 'Bs' : 'USD')
/** 42 → "42 USD" ; 1250.5 en VES → "1.250,5 Bs" */
export const dinero = (v: number, moneda: 'USD' | 'VES' = 'USD') => `${numero(v, 0, 2)} ${simboloMoneda(moneda)}`