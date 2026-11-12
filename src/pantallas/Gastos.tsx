import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { FileText, Fuel, Plus, Receipt, Wrench, type LucideIcon } from 'lucide-react'
import { Segmentado } from '../components/Campo'
import { Encabezado, Vacio } from '../components/comunes'
import { HojaGasto } from '../components/HojaGasto'
import { db, type Gasto } from '../db/esquema'
import { useCargas, useMantenimiento, useVehiculoActivo } from '../db/hooks'
import { guardarMeta } from '../db/repo'
import { SISTEMAS } from '../lib/catalogos'
import { dinero, fechaTarjeta, numero } from '../lib/formato'
import { CATEGORIAS, sumar, type Categoria, type Monto, type Vista } from '../lib/gastos'
import { tituloVisita } from './Taller'

const VISTAS = [
  { valor: 'USD', texto: 'USD' },
  { valor: 'VES', texto: 'Bs' },
] as const

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const nombreMes = (aaaamm: string) => `${MESES[Number(aaaamm.slice(5, 7)) - 1]} ${aaaamm.slice(0, 4)}`

interface Movimiento {
  clave: string
  Icono: LucideIcon
  color: string
  titulo: string
  fecha: string // para ordenar
  fechaTexto: string
  moneda: string
  montos: Monto[]
  accion: () => void
}

export default function Gastos() {
  const vehiculo = useVehiculoActivo()
  const navegar = useNavigate()
  const cargas = useCargas(vehiculo.id)
  const mant = useMantenimiento(vehiculo.id)
  const gastos = useLiveQuery(
    async () => (await db.expenses.where('vehicle_id').equals(vehiculo.id).toArray()).filter((g) => !g.deleted),
    [vehiculo.id],
  )
  const vistaGuardada = useLiveQuery(async () => (await db.meta.get('vista_gastos'))?.valor as Vista | undefined)
  const vista: Vista = vistaGuardada ?? 'USD'
  const [hoja, setHoja] = useState<Gasto | 'nuevo' | null>(null)
  const [verTodos, setVerTodos] = useState(false)

  const datos = useMemo(() => {
    if (!cargas || !mant || !gastos) return null
    const visitaPorId = new Map(mant.visitas.map((v) => [v.id, v]))

    // Montos por categoría (y del taller, por sistema)
    const deCarga = cargas
      .filter((c) => c.monto != null)
      .map((c) => ({ c, m: { monto: c.monto, moneda: c.moneda, tasa: c.tasa_ves_usd, monto_usd: c.monto_usd } as Monto }))
    const deItem = mant.items
      .filter((i) => i.monto != null && visitaPorId.has(i.visit_id))
      .map((i) => {
        const v = visitaPorId.get(i.visit_id)!
        return { i, v, m: { monto: i.monto, moneda: v.moneda, tasa: v.tasa_ves_usd, monto_usd: i.monto_usd } as Monto }
      })
    const deGasto = gastos.map((g) => ({ g, m: { monto: g.monto, moneda: g.moneda, tasa: g.tasa_ves_usd, monto_usd: g.monto_usd } as Monto }))

    const porCategoria: Record<Categoria, Monto[]> = {
      compra_papeles: deGasto.filter((x) => x.g.categoria === 'compra_papeles').map((x) => x.m),
      gasolina: deCarga.map((x) => x.m),
      taller: deItem.map((x) => x.m),
      otro: deGasto.filter((x) => x.g.categoria === 'otro').map((x) => x.m),
    }
    const porSistema = SISTEMAS.map((s) => ({ sistema: s, montos: deItem.filter((x) => x.i.sistema === s).map((x) => x.m) }))

    // Uso y mantenimiento por km (sin la compra), siempre en USD
    const usoUsd = sumar([...porCategoria.gasolina, ...porCategoria.taller, ...porCategoria.otro], 'USD').total
    const kmRecorridos = cargas.reduce((s, c) => s + c.km_recorridos, 0)

    // Últimos movimientos: gasolina agrupada por mes, taller por visita, gastos sueltos
    const movimientos: Movimiento[] = []
    const meses = new Map<string, typeof deCarga>()
    for (const x of deCarga) meses.set(x.c.fecha.slice(0, 7), [...(meses.get(x.c.fecha.slice(0, 7)) ?? []), x])
    for (const [mes, xs] of meses) {
      const monedas = new Set(xs.map((x) => x.c.moneda))
      movimientos.push({
        clave: `gas-${mes}`,
        Icono: Fuel,
        color: 'var(--cielo)',
        titulo: `Gasolina · ${xs.length} ${xs.length === 1 ? 'carga' : 'cargas'}`,
        fecha: xs.map((x) => x.c.fecha).sort().at(-1)!,
        fechaTexto: nombreMes(mes),
        moneda: monedas.size > 1 ? 'USD y Bs' : monedas.has('VES') ? 'Bs' : 'USD',
        montos: xs.map((x) => x.m),
        accion: () => navegar('/gasolina'),
      })
    }
    for (const v of mant.visitas) {
      const items = mant.items.filter((i) => i.visit_id === v.id)
      const xs = deItem.filter((x) => x.v.id === v.id)
      if (!xs.length) continue
      movimientos.push({
        clave: v.id,
        Icono: Wrench,
        color: 'var(--mantequilla)',
        titulo: tituloVisita(v, items),
        fecha: v.fecha,
        fechaTexto: fechaTarjeta(v.fecha),
        moneda: v.moneda === 'VES' ? 'Bs' : 'USD',
        montos: xs.map((x) => x.m),
        accion: () => navegar(`/taller/visita/${v.id}`),
      })
    }
    for (const { g, m } of deGasto) {
      movimientos.push({
        clave: g.id,
        Icono: g.categoria === 'compra_papeles' ? FileText : Receipt,
        color: g.categoria === 'compra_papeles' ? 'var(--lavanda)' : 'var(--text-muted)',
        titulo: g.descripcion,
        fecha: g.fecha,
        fechaTexto: fechaTarjeta(g.fecha),
        moneda: g.moneda === 'VES' ? 'Bs' : 'USD',
        montos: [m],
        accion: () => setHoja(g),
      })
    }
    movimientos.sort((a, b) => b.fecha.localeCompare(a.fecha))

    return { porCategoria, porSistema, usoUsd, kmRecorridos, movimientos }
  }, [cargas, mant, gastos, navegar])

  if (!datos) return <main className="pantalla" />

  const totales = CATEGORIAS.map((c) => ({ ...c, ...sumar(datos.porCategoria[c.clave], vista) }))
  const total = totales.reduce((s, c) => s + c.total, 0)
  const sinValor = totales.reduce((s, c) => s + c.sinValor, 0)
  const hayAlgo = total > 0
  const movimientos = verTodos ? datos.movimientos : datos.movimientos.slice(0, 12)

  return (
    <main className="pantalla">
      <Encabezado
        titulo="Gastos"
        accion={
          <div style={{ width: 120 }}>
            <Segmentado etiqueta="Ver en" opciones={VISTAS} valor={vista} onCambio={(v) => guardarMeta('vista_gastos', v)} />
          </div>
        }
      />

      <section className="tarjeta" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <span className="muted mini">Total desde la compra</span>
          <div className="cifra" style={{ marginTop: 6 }}>{dinero(Math.round(total), vista)}</div>
          {datos.kmRecorridos > 0 && datos.usoUsd > 0 && (
            <span className="muted mini">
              ≈ {numero(datos.usoUsd / datos.kmRecorridos, 2, 3)} USD por km recorrido (uso y mantenimiento, sin la compra)
            </span>
          )}
        </div>

        {hayAlgo && (
          <>
            <div className="apilada" role="img" aria-label={totales.filter((c) => c.total > 0).map((c) => `${c.texto}: ${Math.round((c.total / total) * 100)} %`).join(', ')}>
              {totales.filter((c) => c.total > 0).map((c) => (
                <span key={c.clave} style={{ width: `${(c.total / total) * 100}%`, background: c.color }} />
              ))}
            </div>
            <div className="leyenda">
              {totales.filter((c) => c.total > 0).map((c) => (
                <span key={c.clave}>
                  <span className="punto" style={{ background: c.color }} aria-hidden /> {c.texto} {Math.round((c.total / total) * 100)} %
                </span>
              ))}
            </div>
          </>
        )}
        {vista === 'VES' && sinValor > 0 && (
          <span className="muted mini">
            {sinValor} {sinValor === 1 ? 'monto pagado en USD no tiene' : 'montos pagados en USD no tienen'} tasa y no se suman en Bs.
          </span>
        )}
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className="titulo-seccion">Categorías</h2>
          <button className="btn" style={{ minHeight: 36 }} onClick={() => setHoja('nuevo')}>
            <Plus size={16} strokeWidth={2} /> Gasto
          </button>
        </div>
        <div className="tarjeta lista" style={{ paddingTop: 4, paddingBottom: 4 }}>
          {totales.map((c) => (
            <div key={c.clave}>
              <div className="lista__fila" style={{ borderBottom: c.clave === 'taller' ? 0 : undefined }}>
                <span className="punto" style={{ background: c.color, width: 10, height: 10 }} aria-hidden />
                <span style={{ flex: 1 }}>
                  {c.texto}
                  {c.clave === 'gasolina' && <span className="muted mini" style={{ display: 'block' }}>Solo cargas con monto registrado</span>}
                </span>
                <strong>{c.total > 0 ? dinero(Math.round(c.total * 100) / 100, vista) : '—'}</strong>
              </div>
              {c.clave === 'taller' && (
                <div style={{ paddingLeft: 22, paddingBottom: 8, borderBottom: '1px solid var(--surface-2)' }}>
                  {datos.porSistema.map(({ sistema, montos }) => {
                    const s = sumar(montos, vista).total
                    return s > 0 ? (
                      <div key={sistema} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }} className="mini">
                        <span className="muted">{sistema}</span>
                        <span>{dinero(Math.round(s * 100) / 100, vista)}</span>
                      </div>
                    ) : null
                  })}
                  {c.total === 0 && <span className="muted mini">Sin visitas con monto</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h2 className="titulo-seccion">Últimos movimientos</h2>
        {datos.movimientos.length === 0 ? (
          <Vacio Icono={Receipt}>
            <p>Todavía no hay gastos. Se suman solos al registrar cargas con monto y visitas al taller.</p>
          </Vacio>
        ) : (
          <div className="tarjeta lista" style={{ paddingTop: 4, paddingBottom: 4 }}>
            {movimientos.map((m) => {
              const { total: monto, sinValor: falta } = sumar(m.montos, vista)
              return (
                <button key={m.clave} className="lista__fila" onClick={m.accion}>
                  <span className="icono-caja">
                    <m.Icono size={18} strokeWidth={1.8} color={m.color} aria-hidden />
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.titulo}</span>
                    <span className="muted mini">{m.fechaTexto} · Pagado en {m.moneda}</span>
                  </span>
                  <strong style={{ whiteSpace: 'nowrap' }}>
                    {falta === m.montos.length ? '—' : dinero(Math.round(monto * 100) / 100, vista)}
                  </strong>
                </button>
              )
            })}
          </div>
        )}
        {!verTodos && datos.movimientos.length > 12 && (
          <button className="enlace" style={{ alignSelf: 'center', minHeight: 36 }} onClick={() => setVerTodos(true)}>
            Ver todos ({datos.movimientos.length})
          </button>
        )}
      </section>

      {hoja && (
        <HojaGasto key={hoja === 'nuevo' ? 'nuevo' : hoja.id} vehiculoId={vehiculo.id} gasto={hoja === 'nuevo' ? undefined : hoja} onCerrar={() => setHoja(null)} />
      )}
    </main>
  )
}

