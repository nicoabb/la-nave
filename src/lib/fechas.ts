// Las fechas de los registros se guardan como 'aaaa-mm-dd' (fecha local, sin hora).

const p2 = (n: number) => String(n).padStart(2, '0')

export function hoyISO(d = new Date()): string {
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`
}

export function aFecha(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Número de día absoluto, para restar fechas sin líos de horario. */
export function diaNum(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return Date.UTC(y, m - 1, d) / 86_400_000
}
