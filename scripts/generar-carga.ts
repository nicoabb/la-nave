// Paso 2 de la importación: arma el archivo que se carga desde la app con
// Configuración → "Restaurar desde un respaldo" (y luego se sincroniza).
//
//   node scripts/generar-carga.ts
//
// Lee:     import/revision-gasolina.csv (ya revisado), import/mapeo.json,
//          import/wallet_records.csv y los archivos que mapeo.json indique
//          (comprobantes PDF, fotos)
// Genera:  import/la-nave-carga.json  (contiene datos personales: nunca a Git)
//
// Los ids son deterministas: cargar el archivo dos veces no duplica nada.
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { PLANTILLA_TAREAS } from '../src/lib/catalogos.ts'
import { enCaracas, instante, leerCsv, num } from './comun.ts'

const DIR = 'import'
const mapeo = JSON.parse(readFileSync(join(DIR, 'mapeo.json'), 'utf8'))
const AHORA = new Date().toISOString()

/** uuid estable a partir de una clave */
function id(...partes: (string | number | null | undefined)[]): string {
  const h = createHash('sha1').update(partes.join('|')).digest('hex')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${((parseInt(h[16], 16) & 3) | 8).toString(16)}${h.slice(17, 20)}-${h.slice(20, 32)}`
}

const base = (clave: string, fecha: string, hora = '12:00') => ({
  id: id(clave),
  user_id: null,
  created_at: instante(fecha, hora),
  updated_at: AHORA,
  deleted: false,
})

// ---------------------------------------------------------------- Wallet (tasas)
const wallet = leerCsv(join(DIR, 'wallet_records.csv')).map((f) => {
  const local = enCaracas(new Date(f.date))
  const moneda = f.currency === 'VEF' || f.currency === 'VES' ? 'VES' : 'USD'
  const monto = num(f.amount)!
  const usd = num(f.ref_currency_amount)!
  return { ...local, instante: new Date(f.date).getTime(), moneda, monto, usd, nota: f.note, tasa: moneda === 'VES' ? monto / usd : null }
})

function filaWallet(ref: { fecha: string; monto: number }) {
  const f = wallet.find((w) => w.fecha === ref.fecha && Math.abs(w.monto - ref.monto) < 0.01)
  if (!f) throw new Error(`No hay fila de Wallet ${ref.fecha} por ${ref.monto}`)
  return f
}

/** Tasa de la fila en Bs más cercana (±7 días) a una fecha. */
function tasaEstimada(fecha: string): number | null {
  const t = Date.parse(`${fecha}T12:00:00-04:00`)
  const c = wallet
    .filter((w) => w.moneda === 'VES' && Math.abs(w.instante - t) <= 7 * 86_400_000)
    .sort((a, b) => Math.abs(a.instante - t) - Math.abs(b.instante - t))[0]
  return c?.tasa ?? null
}

interface Pago {
  moneda: 'USD' | 'VES'
  tasa: number | null
  tasa_origen: 'manual' | 'wallet' | 'estimada' | 'comprobante' | null
}

/** Moneda y tasa de un registro: explícitas, de su fila de Wallet o estimadas. */
function resolverPago(r: { fecha: string; moneda?: 'USD' | 'VES'; tasa?: number; tasa_origen?: Pago['tasa_origen']; wallet?: { fecha: string; monto: number } }): Pago {
  if (r.tasa) return { moneda: r.moneda ?? 'VES', tasa: r.tasa, tasa_origen: r.tasa_origen ?? 'manual' }
  if (r.wallet) {
    const w = filaWallet(r.wallet)
    if (w.moneda === 'VES') return { moneda: 'VES', tasa: w.tasa, tasa_origen: 'wallet' }
    const t = tasaEstimada(w.fecha)
    return { moneda: 'USD', tasa: t, tasa_origen: t ? 'estimada' : null }
  }
  const moneda = r.moneda ?? 'USD'
  if (moneda === 'USD') {
    const t = tasaEstimada(r.fecha)
    return { moneda, tasa: t, tasa_origen: t ? 'estimada' : null }
  }
  return { moneda, tasa: null, tasa_origen: null }
}

const aUsd = (monto: number | null, p: Pago) => (monto == null ? null : p.moneda === 'USD' ? monto : p.tasa ? monto / p.tasa : null)
const r2 = (n: number | null) => (n == null ? null : Math.round(n * 100) / 100)

// ---------------------------------------------------------------- Vehículo y tareas
const v = mapeo.vehiculo
const vehicleId = id('vehiculo')
const vehicles = [{ ...base('vehiculo', v.fecha_compra), ...v, alias: v.alias ?? '', activo: true }]

const tareasPorClave = new Map<string, string>()
const maintenance_tasks = [...PLANTILLA_TAREAS, ...(mapeo.tareas_extra ?? [])]
  .filter((p) => !(p.soloAutomatico && v.transmision !== 'automático'))
  .map((p) => {
    const o = mapeo.tareas?.[p.clave] ?? {}
    const tid = id('tarea', p.clave)
    tareasPorClave.set(p.clave, tid)
    return {
      ...base(`tarea|${p.clave}`, v.fecha_compra),
      id: tid,
      vehicle_id: vehicleId,
      clave: p.clave,
      nombre: o.nombre ?? p.nombre,
      sistema: o.sistema ?? p.sistema,
      intervalo_km: o.intervalo_km !== undefined ? o.intervalo_km : p.intervalo_km,
      intervalo_dias: o.intervalo_dias !== undefined ? o.intervalo_dias : p.intervalo_dias,
      ultima_km_inicial: o.ultima_km_inicial ?? null,
      ultima_fecha_inicial: o.ultima_fecha_inicial ?? null,
      activa: true,
      notas: o.notas ?? p.notas ?? '',
      es_revision: p.es_revision,
      fuente: o.fuente ?? p.fuente,
      pospuesta_hasta: null,
      costo_estimado_usd: o.costo_estimado_usd ?? (p as { costo_estimado_usd?: number }).costo_estimado_usd ?? null,
    }
  })
const tarea = (clave?: string) => {
  if (!clave) return null
  const t = tareasPorClave.get(clave)
  if (!t) throw new Error(`Tarea desconocida: ${clave}`)
  return t
}

// ---------------------------------------------------------------- Odómetro
const odometer_corrections = (mapeo.odometro ?? []).map((o: { fecha: string; hora?: string; km: number; nota?: string }) => ({
  ...base(`odometro|${o.fecha}`, o.fecha, o.hora ?? '09:00'),
  vehicle_id: vehicleId,
  fecha: o.fecha,
  km_total: o.km,
  nota: o.nota ?? '',
}))

// ---------------------------------------------------------------- Gasolina (CSV revisado)
const fuel_logs = leerCsv(join(DIR, 'revision-gasolina.csv'))
  .filter((f) => (f.incluir || 'si').toLowerCase() !== 'no')
  .map((f) => {
    const [d, m, a] = f.fecha.split('/')
    const fecha = `${a}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
    const monto = num(f.monto)
    const moneda = (f.moneda || null) as 'USD' | 'VES' | null
    const tasa = num(f.tasa)
    const full = f.full === 'si' ? true : f.full === 'no' ? false : null
    const nota = [f.keep_original && `Keep: ${f.keep_original}`, f.wallet_original && `Wallet: ${f.wallet_original}`].filter(Boolean).join(' · ')
    return {
      ...base(`carga|${fecha}|${f.hora}|${f.litros}`, fecha, f.hora || '12:00'),
      vehicle_id: vehicleId,
      fecha,
      km_recorridos: num(f.km),
      litros: num(f.litros)!,
      full,
      monto,
      moneda: monto != null ? moneda : null,
      tasa_ves_usd: monto != null ? tasa : null,
      tasa_origen: monto != null && tasa ? (f.tasa_origen || 'manual') : null,
      monto_usd: monto != null ? (num(f.monto_usd) ?? r2(aUsd(monto, { moneda: moneda!, tasa, tasa_origen: null }))) : null,
      nota,
      origen: 'importado',
    }
  })

// ---------------------------------------------------------------- Productos
const archivos: { bucket: 'fotos' | 'comprobantes'; path: string; mime: string; base64: string }[] = []
const productosPorClave = new Map<string, string>()

async function fotoWebp(ruta: string): Promise<Buffer> {
  // sharp viene con las dependencias de desarrollo (generador de íconos)
  const sharp = (await import('sharp')).default
  let q = 70
  let buf = await sharp(ruta).rotate().resize(1280, 1280, { fit: 'inside', withoutEnlargement: true }).webp({ quality: q }).toBuffer()
  while (buf.length > 250_000 && q > 35) {
    q -= 10
    buf = await sharp(ruta).rotate().resize(1280, 1280, { fit: 'inside', withoutEnlargement: true }).webp({ quality: q }).toBuffer()
  }
  return buf
}

const products = []
for (const p of mapeo.productos ?? []) {
  const pid = id('producto', p.clave)
  productosPorClave.set(p.clave, pid)
  let foto_path: string | null = null
  if (p.foto) {
    foto_path = `${pid}.webp`
    archivos.push({ bucket: 'fotos', path: foto_path, mime: 'image/webp', base64: (await fotoWebp(join(DIR, p.foto))).toString('base64') })
  }
  products.push({
    ...base(`producto|${p.clave}`, p.fecha ?? v.fecha_compra),
    id: pid,
    tipo: p.tipo,
    marca: p.marca,
    especificacion: p.especificacion ?? '',
    presentacion: p.presentacion ?? '',
    en_uso: p.en_uso ?? true,
    nota: p.nota ?? '',
    foto_path,
  })
}
const producto = (clave?: string) => {
  if (!clave) return null
  const p = productosPorClave.get(clave)
  if (!p) throw new Error(`Producto desconocido: ${clave}`)
  return p
}

// ---------------------------------------------------------------- Visitas, ítems y comprobantes
const service_visits = []
const service_items = []
const visit_receipts = []
const visitaPorClave = new Map<string, string>()

for (const vi of mapeo.visitas ?? []) {
  const vid = id('visita', vi.clave)
  visitaPorClave.set(vi.clave, vid)
  const pago = resolverPago(vi)
  service_visits.push({
    ...base(`visita|${vi.clave}`, vi.fecha, vi.hora ?? '12:00'),
    id: vid,
    vehicle_id: vehicleId,
    fecha: vi.fecha,
    km: vi.km ?? null,
    titulo: vi.titulo ?? '',
    taller: vi.taller ?? '',
    proveedor: vi.proveedor ?? '',
    afecta_rendimiento: vi.afecta_rendimiento ?? false,
    moneda: pago.moneda,
    tasa_ves_usd: r2(pago.tasa),
    tasa_origen: pago.tasa_origen,
    nota: vi.nota ?? '',
  })
  vi.items.forEach((it: Record<string, any>, n: number) => {
    const monto = it.wallet ? filaWallet(it.wallet).monto : (it.monto ?? null)
    service_items.push({
      ...base(`item|${vi.clave}|${n}`, vi.fecha, `12:${String(n).padStart(2, '0')}`),
      visit_id: vid,
      descripcion: it.descripcion,
      tipo: it.tipo ?? 'repuesto',
      sistema: it.sistema ?? 'Otros',
      task_id: tarea(it.tarea),
      product_id: producto(it.producto),
      cantidad: it.cantidad ?? null,
      monto,
      monto_usd: r2(aUsd(monto, pago)),
    })
  })
  for (const ruta of vi.comprobantes ?? []) {
    const buf = readFileSync(join(DIR, ruta))
    const ext = ruta.split('.').pop()!.toLowerCase()
    const rid = id('comprobante', vi.clave, ruta)
    const path = `${vid}/${rid}.${ext}`
    const mime = ext === 'pdf' ? 'application/pdf' : `image/${ext === 'jpg' ? 'jpeg' : ext}`
    archivos.push({ bucket: 'comprobantes', path, mime, base64: buf.toString('base64') })
    visit_receipts.push({ ...base(`comprobante|${vi.clave}|${ruta}`, vi.fecha), id: rid, visit_id: vid, nombre: basename(ruta), mime, bytes: buf.length, path })
  }
}

// ---------------------------------------------------------------- Gastos
const expenses = (mapeo.gastos ?? []).map((g: Record<string, any>, n: number) => {
  const pago = resolverPago(g)
  const monto = g.wallet ? filaWallet(g.wallet).monto : g.monto
  return {
    ...base(`gasto|${g.fecha}|${n}`, g.fecha),
    vehicle_id: vehicleId,
    fecha: g.fecha,
    categoria: g.categoria,
    descripcion: g.descripcion,
    task_id: tarea(g.tarea),
    monto,
    moneda: pago.moneda,
    tasa_ves_usd: r2(pago.tasa),
    tasa_origen: pago.tasa_origen,
    monto_usd: r2(aUsd(monto, pago)),
  }
})

// ---------------------------------------------------------------- Cauchos
const tires = (mapeo.cauchos ?? []).map((c: Record<string, any>) => ({
  ...base(`caucho|${c.posicion}`, c.fecha_montaje ?? v.fecha_compra),
  vehicle_id: vehicleId,
  marca: c.marca ?? '',
  medida: c.medida ?? '',
  dot_semana: c.dot_semana ?? null,
  dot_anio: c.dot_anio ?? null,
  fecha_montaje: c.fecha_montaje ?? null,
  km_montaje: c.km_montaje ?? null,
  posicion: c.posicion,
  estado: 'montado',
  nota: c.nota ?? '',
}))

const SIN_PAGO = { monto: null, moneda: null, tasa_ves_usd: null, tasa_origen: null, monto_usd: null }
const tire_events = (mapeo.eventos_cauchos ?? []).map((e: Record<string, any>, n: number) => ({
  ...base(`evento|${e.fecha}|${e.tipo}|${n}`, e.fecha, e.hora ?? '12:00'),
  vehicle_id: vehicleId,
  fecha: e.fecha,
  km: e.km ?? null,
  tipo: e.tipo,
  detalle: e.detalle ?? null,
  visit_id: e.visita ? visitaPorClave.get(e.visita) ?? null : null,
  ...SIN_PAGO,
}))
// Montaje de los cauchos con fecha conocida
for (const c of tires.filter((x: { fecha_montaje: string | null }) => x.fecha_montaje)) {
  tire_events.push({
    ...base(`montaje|${c.id}`, c.fecha_montaje),
    vehicle_id: vehicleId,
    fecha: c.fecha_montaje,
    km: c.km_montaje,
    tipo: 'montaje',
    detalle: { tire_id: c.id, posicion: c.posicion },
    visit_id: null,
    ...SIN_PAGO,
  })
}
// Aire pagado (filas de Wallet cuya nota cumple el patrón): evento de presión con su monto
if (mapeo.aire_desde_wallet) {
  const re = new RegExp(mapeo.aire_desde_wallet, 'i')
  for (const w of wallet.filter((x) => re.test(x.nota))) {
    const pago: Pago = w.moneda === 'VES' ? { moneda: 'VES', tasa: w.tasa, tasa_origen: 'wallet' } : resolverPago({ fecha: w.fecha, moneda: 'USD' })
    tire_events.push({
      ...base(`aire|${w.fecha}|${w.hora}`, w.fecha, w.hora),
      vehicle_id: vehicleId,
      fecha: w.fecha,
      km: null,
      tipo: 'presion',
      detalle: null,
      visit_id: null,
      monto: w.monto,
      moneda: pago.moneda,
      tasa_ves_usd: r2(pago.tasa),
      tasa_origen: pago.tasa_origen,
      monto_usd: r2(aUsd(w.monto, pago)),
    })
  }
}

// ---------------------------------------------------------------- Revisiones y pendientes
const inspections = (mapeo.revisiones ?? []).map((r: Record<string, any>, n: number) => ({
  ...base(`revision|${r.fecha}|${n}`, r.fecha),
  vehicle_id: vehicleId,
  fecha: r.fecha,
  km: r.km ?? null,
  tipo: r.tipo,
  checklist: r.checklist ?? null,
  mediciones: r.mediciones ?? null,
  task_id: tarea(r.tarea),
  nota: r.nota ?? '',
}))

const wishlist_items = (mapeo.pendientes ?? []).map((p: Record<string, any>, n: number) => ({
  ...base(`pendiente|${n}|${p.titulo}`, AHORA.slice(0, 10)),
  vehicle_id: vehicleId,
  titulo: p.titulo,
  prioridad: p.prioridad,
  costo_estimado_usd: p.costo_estimado_usd ?? null,
  nota: p.nota ?? '',
  hecho: false,
  fecha_hecho: null,
  visit_id: null,
}))

// ---------------------------------------------------------------- Salida
const salida = {
  app: 'la-nave',
  version: 1,
  exportado: AHORA,
  origen: 'importacion',
  vehicles,
  odometer_corrections,
  fuel_logs,
  maintenance_tasks,
  service_visits,
  service_items,
  products,
  inspections,
  tires,
  tire_events,
  wishlist_items,
  expenses,
  visit_receipts,
  archivos,
}
writeFileSync(join(DIR, 'la-nave-carga.json'), JSON.stringify(salida))

const usd = (xs: { monto_usd: number | null }[]) => Math.round(xs.reduce((s, x) => s + (x.monto_usd ?? 0), 0))
console.log(`Archivo: import/la-nave-carga.json (${Math.round(JSON.stringify(salida).length / 1024)} KB)`)
console.log(`- Cargas de gasolina: ${fuel_logs.length} (con km: ${fuel_logs.filter((f) => f.km_recorridos != null).length}) · ${usd(fuel_logs)} USD`)
console.log(`- Visitas: ${service_visits.length} · ítems: ${service_items.length} · ${usd(service_items)} USD · comprobantes: ${visit_receipts.length}`)
console.log(`- Gastos: ${expenses.length} · ${usd(expenses)} USD`)
console.log(`- Cauchos: ${tires.length} · eventos: ${tire_events.length} (aire con monto: ${tire_events.filter((e: { monto: number | null }) => e.monto != null).length}, ${usd(tire_events)} USD)`)
console.log(`- Tareas: ${maintenance_tasks.length} · productos: ${products.length} · revisiones: ${inspections.length} · pendientes: ${wishlist_items.length}`)
console.log(`- Lecturas del odómetro: ${odometer_corrections.length} · archivos incrustados: ${archivos.length}`)
