// Utilidades de los scripts de importación (SPEC §8 y anexo de Wallet).
// No contienen datos: todo se lee de la carpeta import/ (ignorada por Git).
import { readFileSync } from 'node:fs'

export const ZONA = 'America/Caracas'

/** Fecha y hora locales de Venezuela a partir de un instante. */
export function enCaracas(fecha: Date): { fecha: string; hora: string } {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: ZONA,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
      .formatToParts(fecha)
      .map((x) => [x.type, x.value]),
  )
  return { fecha: `${p.year}-${p.month}-${p.day}`, hora: `${p.hour === '24' ? '00' : p.hour}:${p.minute}` }
}

/** ISO con la zona de Venezuela (−04:00) a partir de fecha y hora locales. */
export const instante = (fecha: string, hora = '12:00') => new Date(`${fecha}T${hora}:00-04:00`).toISOString()

export const diasEntre = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000)

/** CSV con separador configurable y comillas. */
export function leerCsv(ruta: string, sep = ';'): Record<string, string>[] {
  const s = readFileSync(ruta, 'utf8').replace(/^﻿/, '')
  const filas: string[][] = []
  let fila: string[] = []
  let campo = ''
  let q = false
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (q) {
      if (ch === '"' && s[i + 1] === '"') {
        campo += '"'
        i++
      } else if (ch === '"') q = false
      else campo += ch
    } else if (ch === '"') q = true
    else if (ch === sep) {
      fila.push(campo)
      campo = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && s[i + 1] === '\n') i++
      fila.push(campo)
      filas.push(fila)
      fila = []
      campo = ''
    } else campo += ch
  }
  if (campo || fila.length) {
    fila.push(campo)
    filas.push(fila)
  }
  const [cab, ...resto] = filas.filter((f) => f.length > 1)
  return resto.map((f) => Object.fromEntries(cab.map((c, i) => [c.trim(), (f[i] ?? '').trim()])))
}

export function escribirCsvTexto(filas: Record<string, unknown>[], columnas: string[], sep = ';'): string {
  const celda = (v: unknown) => {
    const t = v == null ? '' : String(v)
    return /[";\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t
  }
  // BOM para que Excel lo abra en UTF-8
  return '﻿' + [columnas.join(sep), ...filas.map((f) => columnas.map((c) => celda(f[c])).join(sep))].join('\r\n') + '\r\n'
}

/** "25.46" o "25,46" → 25.46 */
export function num(t: string | undefined): number | null {
  if (t == null || !t.trim()) return null
  const n = Number(t.trim().replace(/\s/g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

/** Número con coma decimal para el CSV de revisión. */
export const coma = (n: number | null | undefined, dec = 2) =>
  n == null ? '' : String(Math.round(n * 10 ** dec) / 10 ** dec).replace('.', ',')
