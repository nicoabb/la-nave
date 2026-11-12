// Gastos y monedas — SPEC.md §4.6 y §5.5. Funciones puras.

export type Moneda = 'USD' | 'VES'
export type Vista = 'USD' | 'VES'

export interface Monto {
  monto: number | null
  moneda: Moneda | null
  tasa: number | null
  monto_usd: number | null
}

/**
 * Valor de un monto en la vista elegida:
 * - USD: el monto_usd guardado.
 * - Bs: si se pagó en Bs, el original; si se pagó en USD con tasa, monto × tasa; si no, null ("—").
 */
export function valorEn(m: Monto, vista: Vista): number | null {
  if (m.monto == null || m.moneda == null) return null
  if (vista === 'USD') return m.monto_usd
  if (m.moneda === 'VES') return m.monto
  return m.tasa ? m.monto * m.tasa : null
}

/** monto_usd a guardar según la moneda de pago. */
export function aUsd(monto: number, moneda: Moneda, tasa: number | null): number | null {
  if (moneda === 'USD') return monto
  return tasa ? monto / tasa : null
}

/** Suma lo que tiene valor en la vista y cuenta lo que quedó fuera. */
export function sumar(xs: readonly Monto[], vista: Vista): { total: number; sinValor: number } {
  let total = 0
  let sinValor = 0
  for (const m of xs) {
    const v = valorEn(m, vista)
    if (v == null) sinValor++
    else total += v
  }
  return { total, sinValor }
}

export type Categoria = 'compra_papeles' | 'gasolina' | 'taller' | 'seguro' | 'otro'

export const CATEGORIAS: { clave: Categoria; texto: string; color: string }[] = [
  { clave: 'compra_papeles', texto: 'Compra y papeles', color: 'var(--lavanda)' },
  { clave: 'gasolina', texto: 'Gasolina', color: 'var(--cielo)' },
  { clave: 'taller', texto: 'Taller', color: 'var(--mantequilla)' },
  { clave: 'seguro', texto: 'Seguro', color: 'var(--menta)' },
  { clave: 'otro', texto: 'Otros gastos', color: 'var(--text-muted)' },
]

export type TasaOrigen = 'manual' | 'wallet' | 'estimada' | 'comprobante'

/** Texto de ayuda bajo el campo de tasa, según su origen (si no se ha tocado). */
export function ayudaTasa(moneda: Moneda, origen: TasaOrigen | null | undefined, sinTocar: boolean): string {
  if (sinTocar && origen === 'wallet') return 'Tasa tomada de Wallet. Puedes corregirla.'
  if (sinTocar && origen === 'estimada') return 'Tasa estimada con la fecha más cercana. Revísala.'
  if (sinTocar && origen === 'comprobante') return 'Tasa tomada del comprobante.'
  return moneda === 'VES' ? 'Obligatoria si pagaste en Bs' : 'Opcional: sirve para ver el gasto en Bs'
}