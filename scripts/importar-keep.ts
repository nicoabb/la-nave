// Paso 1 de la importación (SPEC §8 + anexo de Wallet). No escribe en la base:
// genera archivos para revisar en import/.
//
//   node scripts/importar-keep.ts
//
// Lee:     import/<carpeta de Keep>/*.json (notas con la etiqueta indicada en mapeo.json → keep)
//          import/wallet_records.csv
//          import/mapeo.json (opcional: ajustes puntuales de gasolina)
// Genera:  import/revision-gasolina.csv  → revísalo y corrígelo si hace falta
//          import/otras-notas.md
//          import/revision-resumen.md
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { coma, diasEntre, enCaracas, escribirCsvTexto, leerCsv, num } from './comun.ts'

const DIR = 'import'
const ANIO_MIN = 2025 // antes de esa fecha el carro no era del usuario

// ---------------------------------------------------------------- Keep
interface NotaKeep {
  archivo: string
  title: string
  textContent?: string
  labels?: { name: string }[]
  createdTimestampUsec: number
}

interface CargaKeep {
  archivo: string
  km: number | null
  litros: number
  fecha: string
  hora: string
  banderas: string[]
  texto: string
  tieneFecha: boolean
}

// La carpeta y la etiqueta de Keep van en import/mapeo.json → keep, no en el código
const mapeo = existsSync(join(DIR, 'mapeo.json')) ? JSON.parse(readFileSync(join(DIR, 'mapeo.json'), 'utf8')) : {}
const CARPETA_KEEP: string = mapeo.keep?.carpeta ?? 'keep'
const ETIQUETA_KEEP: string | undefined = mapeo.keep?.etiqueta

const notas: NotaKeep[] = readdirSync(join(DIR, CARPETA_KEEP))
  .filter((f) => f.endsWith('.json'))
  .map((f) => ({ archivo: f, ...JSON.parse(readFileSync(join(DIR, CARPETA_KEEP, f), 'utf8')) }))
  .filter((n) => !ETIQUETA_KEEP || n.labels?.some((l: { name: string }) => l.name === ETIQUETA_KEEP))

const reLitros = /^\s*([\d.,]+)\s*litros?\b/i
const reKm = /^\s*([\d.,]+)\s*(km)?\s*$/i
const reFecha = /^\s*(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\s*$/

const cargasKeep: CargaKeep[] = []
const otrasNotas: NotaKeep[] = []

for (const n of notas) {
  const lineas = (n.textContent ?? '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const lLitros = lineas.find((l) => reLitros.test(l))
  if (n.title || !lLitros) {
    otrasNotas.push(n)
    continue
  }
  const creada = enCaracas(new Date(n.createdTimestampUsec / 1000))
  const banderas: string[] = []
  const litros = num(lLitros.match(reLitros)![1])!
  const lKm = lineas.find((l) => l !== lLitros && reKm.test(l))
  const km = lKm ? num(lKm.match(reKm)![1]) : null
  if (km === null) banderas.push('sin_km')

  let fecha = creada.fecha
  let tieneFecha = false
  const lFecha = lineas.find((l) => reFecha.test(l))
  if (lFecha) {
    const [, d, m, a] = lFecha.match(reFecha)!
    let anio = a ? Number(a) : Number(creada.fecha.slice(0, 4))
    if (!a) banderas.push('sin_anio')
    if (a && a.length === 2) anio = 2000 + anio
    if (anio < ANIO_MIN || anio > Number(creada.fecha.slice(0, 4))) {
      banderas.push(`anio_corregido(${anio})`)
      anio = Number(creada.fecha.slice(0, 4))
    }
    fecha = `${anio}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
    tieneFecha = true
  } else {
    banderas.push('fecha_estimada')
  }
  cargasKeep.push({ archivo: n.archivo, km, litros, fecha, hora: creada.hora, banderas, texto: lineas.join(' | '), tieneFecha })
}

// ---------------------------------------------------------------- Wallet
interface FilaWallet {
  i: number
  categoria: string
  moneda: 'USD' | 'VES'
  monto: number
  usd: number
  nota: string
  fecha: string
  hora: string
  instante: string
  tasa: number | null
  tasaOrigen: 'wallet' | 'estimada' | ''
}

const wallet: FilaWallet[] = leerCsv(join(DIR, 'wallet_records.csv')).map((f, i) => {
  const instanteUtc = new Date(f.date)
  const local = enCaracas(instanteUtc)
  const moneda = f.currency === 'VEF' || f.currency === 'VES' ? 'VES' : 'USD'
  const monto = num(f.amount)!
  const usd = num(f.ref_currency_amount)!
  return {
    i,
    categoria: f.category,
    moneda,
    monto,
    usd,
    nota: f.note,
    fecha: local.fecha,
    hora: local.hora,
    instante: instanteUtc.toISOString(),
    tasa: moneda === 'VES' && usd ? monto / usd : null,
    tasaOrigen: moneda === 'VES' ? 'wallet' : '',
  }
})

// Filas en USD: tasa estimada con la fila en Bs más cercana (±7 días)
for (const f of wallet.filter((x) => x.moneda === 'USD')) {
  const cercana = wallet
    .filter((x) => x.moneda === 'VES' && x.tasa && Math.abs(Date.parse(x.instante) - Date.parse(f.instante)) <= 7 * 86_400_000)
    .sort((a, b) => Math.abs(Date.parse(a.instante) - Date.parse(f.instante)) - Math.abs(Date.parse(b.instante) - Date.parse(f.instante)))[0]
  if (cercana) {
    f.tasa = cercana.tasa
    f.tasaOrigen = 'estimada'
  }
}

const reWLitros = /([\d.]+)\s*litros/i
const reWKm = /([\d.]+)\s*km/i
const gasWallet = wallet
  .filter((f) => f.categoria === 'Combustible')
  .map((f) => ({
    ...f,
    litros: num(f.nota.match(reWLitros)?.[1]),
    km: num(f.nota.match(reWKm)?.[1]),
    full: /\bfull\b/i.test(f.nota),
  }))

// ---------------------------------------------------------------- Emparejar
type Gw = (typeof gasWallet)[number]
const pareja = new Map<CargaKeep, Gw>()
const ambiguas = new Map<CargaKeep, Gw[]>()

// Primero las notas con fecha; luego las sin fecha, solo contra lo que quedó libre
const ordenEmparejar = [...cargasKeep.filter((k) => k.tieneFecha), ...cargasKeep.filter((k) => !k.tieneFecha)]
for (const k of ordenEmparejar) {
  const tomadas = new Set(pareja.values())
  const mismosLitros = gasWallet.filter((w) => !tomadas.has(w) && w.litros != null && Math.abs(w.litros - k.litros) <= 0.6)
  let cands: Gw[]
  if (k.tieneFecha) {
    cands = mismosLitros.filter((w) => Math.abs(diasEntre(k.fecha, w.fecha)) <= 3)
  } else {
    cands = mismosLitros.filter((w) => w.km != null && k.km != null && Math.abs(w.km - k.km) < 0.05)
    // Sin km que confirme: solo por litros es adivinar → ambiguo
    if (!cands.length) {
      const soloLitros = mismosLitros.filter((w) => w.km == null)
      if (soloLitros.length) ambiguas.set(k, soloLitros)
      continue
    }
  }
  if (cands.length === 1) pareja.set(k, cands[0])
  else if (cands.length > 1) ambiguas.set(k, cands)
}

// Una fila de Wallet no puede quedar en dos parejas
const usos = new Map<Gw, CargaKeep[]>()
for (const [k, w] of pareja) usos.set(w, [...(usos.get(w) ?? []), k])
for (const [w, ks] of usos) {
  if (ks.length > 1) for (const k of ks) {
    pareja.delete(k)
    ambiguas.set(k, [w])
  }
}

// ---------------------------------------------------------------- Ajustes puntuales (import/mapeo.json)
interface Ajuste {
  fecha: string
  litros: number
  full?: 'si' | 'no' | 'desconocido'
  km?: number
  nota?: string
}
const ajustes: Ajuste[] = mapeo.ajustes_gasolina ?? []

// ---------------------------------------------------------------- Filas de revisión
interface Fila {
  fecha: string
  hora: string
  km: number | null
  litros: number
  full: 'si' | 'no' | 'desconocido'
  monto: number | null
  moneda: string
  tasa: number | null
  tasa_origen: string
  monto_usd: number | null
  origen: 'keep' | 'wallet' | 'ambos'
  banderas: string[]
  keep_original: string
  wallet_original: string
}

const filas: Fila[] = []
const usadas = new Set<Gw>()
for (const k of cargasKeep) {
  const w = pareja.get(k)
  if (w) usadas.add(w)
  const banderas = [...k.banderas]
  if (!w) banderas.push(ambiguas.has(k) ? `ambiguo(${ambiguas.get(k)!.length} candidatas en Wallet)` : 'sin_pareja_en_wallet')
  if (w && !k.tieneFecha) banderas.push('fecha_de_wallet')
  filas.push({
    fecha: k.tieneFecha || !w ? k.fecha : w.fecha,
    hora: w?.hora ?? k.hora,
    km: k.km,
    litros: k.litros,
    full: 'si',
    monto: w?.monto ?? null,
    moneda: w?.moneda ?? '',
    tasa: w?.tasa ?? null,
    tasa_origen: w?.tasaOrigen ?? '',
    monto_usd: w?.usd ?? null,
    origen: w ? 'ambos' : 'keep',
    banderas,
    keep_original: k.texto,
    wallet_original: w?.nota ?? '',
  })
}
for (const w of gasWallet.filter((x) => !usadas.has(x))) {
  const banderas = ['solo_wallet']
  if (w.km == null) banderas.push('sin_km')
  filas.push({
    fecha: w.fecha,
    hora: w.hora,
    km: w.km,
    litros: w.litros ?? 0,
    full: w.km != null && w.full ? 'si' : 'desconocido',
    monto: w.monto,
    moneda: w.moneda,
    tasa: w.tasa,
    tasa_origen: w.tasaOrigen,
    monto_usd: w.usd,
    origen: 'wallet',
    banderas,
    keep_original: '',
    wallet_original: w.nota,
  })
}
for (const a of ajustes) {
  const f = filas.find((x) => x.fecha === a.fecha && Math.abs(x.litros - a.litros) <= 0.6)
  if (!f) {
    console.warn(`Ajuste sin carga: ${a.fecha} ${a.litros} L`)
    continue
  }
  if (a.full) f.full = a.full
  if (a.km != null) {
    f.km = a.km
    f.banderas = f.banderas.filter((b) => b !== 'sin_km')
  }
  f.banderas.push(`ajuste(${a.nota ?? 'manual'})`)
}
filas.sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora))

const kmL = (f: Fila) => (f.km != null && f.full === 'si' && f.litros ? f.km / f.litros : null)
writeFileSync(
  join(DIR, 'revision-gasolina.csv'),
  escribirCsvTexto(
    filas.map((f, i) => ({
      n: i + 1,
      incluir: 'si',
      fecha: f.fecha.split('-').reverse().join('/'),
      hora: f.hora,
      km: coma(f.km, 1),
      litros: coma(f.litros, 2),
      km_L: coma(kmL(f), 1),
      full: f.full,
      monto: coma(f.monto, 2),
      moneda: f.moneda,
      tasa: coma(f.tasa, 2),
      tasa_origen: f.tasa_origen,
      monto_usd: coma(f.monto_usd, 2),
      origen: f.origen,
      banderas: f.banderas.join(' '),
      keep_original: f.keep_original,
      wallet_original: f.wallet_original,
    })),
    ['n', 'incluir', 'fecha', 'hora', 'km', 'litros', 'km_L', 'full', 'monto', 'moneda', 'tasa', 'tasa_origen', 'monto_usd', 'origen', 'banderas', 'keep_original', 'wallet_original'],
  ),
)

// ---------------------------------------------------------------- Otras notas
writeFileSync(
  join(DIR, 'otras-notas.md'),
  '# Otras notas de Keep\n\nPara cargar de forma asistida, no con un parser.\n\n' +
    otrasNotas
      .map((n) => `## ${n.title || '(sin título)'}\n\nArchivo: \`${n.archivo}\` · creada ${enCaracas(new Date(n.createdTimestampUsec / 1000)).fecha}\n\n${n.textContent ?? ''}\n`)
      .join('\n'),
)

// ---------------------------------------------------------------- Resumen
const ambos = filas.filter((f) => f.origen === 'ambos').length
const soloKeep = filas.filter((f) => f.origen === 'keep')
const soloWallet = filas.filter((f) => f.origen === 'wallet')
const lineas = [
  '# Resumen de la revisión de gasolina',
  '',
  `- Notas de Keep con carga: ${cargasKeep.length} (sin fecha: ${cargasKeep.filter((k) => !k.tieneFecha).length})`,
  `- Filas de gasolina en Wallet: ${gasWallet.length}`,
  `- Emparejadas (origen "ambos"): ${ambos}; notas sin fecha que obtuvieron fecha de Wallet: ${filas.filter((f) => f.banderas.includes('fecha_de_wallet')).length}`,
  `- Solo en Keep: ${soloKeep.length}`,
  ...soloKeep.map((f) => `  - ${f.fecha} · ${f.km ?? '¿?'} km · ${f.litros} L · ${f.banderas.join(' ')}`),
  `- Solo en Wallet: ${soloWallet.length} (sin km: ${soloWallet.filter((f) => f.km == null).length})`,
  `- Otras notas: ${otrasNotas.length} (ver otras-notas.md)`,
]

// Lecturas reales del odómetro (de mapeo.json) contra la suma de km de las cargas
const lecturas: { fecha: string; km: number }[] = (mapeo.odometro ?? []).sort((a: { fecha: string }, b: { fecha: string }) => a.fecha.localeCompare(b.fecha))
if (lecturas.length > 1) {
  lineas.push('', '## Odómetro contra cargas')
  for (let i = 1; i < lecturas.length; i++) {
    const [a, b] = [lecturas[i - 1], lecturas[i]]
    const entre = filas.filter((f) => f.fecha > a.fecha && f.fecha <= b.fecha)
    const suma = entre.reduce((s, f) => s + (f.km ?? 0), 0)
    const sinKm = entre.filter((f) => f.km == null).length
    lineas.push(
      `- ${a.fecha} → ${b.fecha}: el odómetro avanzó ${b.km - a.km} km; las cargas suman ${Math.round(suma)} km` +
        ` (diferencia ${Math.round(b.km - a.km - suma)} km${sinKm ? `; ${sinKm} cargas sin km` : ''})`,
    )
  }
}
writeFileSync(join(DIR, 'revision-resumen.md'), lineas.join('\n') + '\n')
console.log(lineas.join('\n'))
