import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronDown, ChevronRight, CircleDot, Gauge, Package, Pencil, Plus, Wrench } from 'lucide-react'
import { Encabezado, Vacio } from '../components/comunes'
import { HojaProducto } from '../components/FormProducto'
import { db, type ItemTaller, type Producto, type VisitaTaller } from '../db/esquema'
import { useFotoUrl, useMantenimiento, useVehiculoActivo } from '../db/hooks'
import { TIPOS_ITEM } from '../lib/catalogos'
import { dinero, fechaTarjeta, km, numero } from '../lib/formato'

export default function Taller() {
  const [pestana, setPestana] = useState<'visitas' | 'productos'>('visitas')
  const navegar = useNavigate()

  return (
    <main className="pantalla">
      <Encabezado
        titulo="Taller"
        accion={
          <button className="btn btn--primario" onClick={() => navegar('/taller/visita/nueva')}>
            <Plus size={18} strokeWidth={2} /> Visita
          </button>
        }
      />

      <div className="segmentado" role="group" aria-label="Sección de taller">
        <button aria-pressed={pestana === 'visitas'} onClick={() => setPestana('visitas')}>Visitas</button>
        <button aria-pressed={pestana === 'productos'} onClick={() => setPestana('productos')}>Productos que uso</button>
      </div>

      {pestana === 'visitas' ? <Visitas /> : <Productos />}
    </main>
  )
}

function Visitas() {
  const vehiculo = useVehiculoActivo()
  const datos = useMantenimiento(vehiculo.id)
  const [abierta, setAbierta] = useState<string | null>(null)

  const itemsPorVisita = new Map<string, ItemTaller[]>()
  for (const i of datos?.items ?? []) itemsPorVisita.set(i.visit_id, [...(itemsPorVisita.get(i.visit_id) ?? []), i])

  return (
    <>
      <Link to="/taller/cauchos" className="tarjeta" style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 64 }}>
        <span className="icono-caja">
          <CircleDot size={20} strokeWidth={1.8} color="var(--lavanda)" aria-hidden />
        </span>
        <span style={{ flex: 1 }}>
          <strong style={{ fontWeight: 600 }}>Cauchos</strong>
          <span className="muted mini" style={{ display: 'block' }}>Disponible en la próxima fase</span>
        </span>
        <ChevronRight size={20} strokeWidth={1.8} color="var(--text-muted)" aria-hidden />
      </Link>

      {datos && datos.visitas.length === 0 && (
        <Vacio Icono={Wrench}>
          <p>Todavía no hay visitas al taller.</p>
        </Vacio>
      )}
      {datos?.visitas.map((v) => (
        <TarjetaVisita
          key={v.id}
          visita={v}
          items={itemsPorVisita.get(v.id) ?? []}
          abierta={abierta === v.id}
          onAlternar={() => setAbierta(abierta === v.id ? null : v.id)}
        />
      ))}
    </>
  )
}

export function tituloVisita(v: VisitaTaller, items: ItemTaller[]): string {
  if (v.titulo) return v.titulo
  if (!items.length) return 'Visita al taller'
  return items.length > 1 ? `${items[0].descripcion} + ${items.length - 1} más` : items[0].descripcion
}

const TEXTO_TIPO = Object.fromEntries(TIPOS_ITEM.map((t) => [t.valor, t.texto]))

function TarjetaVisita({
  visita,
  items,
  abierta,
  onAlternar,
}: {
  visita: VisitaTaller
  items: ItemTaller[]
  abierta: boolean
  onAlternar: () => void
}) {
  const navegar = useNavigate()
  const suma = (xs: ItemTaller[]) => xs.reduce((s, i) => s + (i.monto ?? 0), 0)
  const total = suma(items)
  const totalUsd = items.reduce((s, i) => s + (i.monto_usd ?? 0), 0)

  const grupos = new Map<string, ItemTaller[]>()
  for (const i of items) grupos.set(i.sistema, [...(grupos.get(i.sistema) ?? []), i])
  const variosSistemas = grupos.size > 1

  return (
    <section className="tarjeta" style={{ padding: 0 }}>
      <button className="visita__cabecera" aria-expanded={abierta} onClick={onAlternar}>
        <span style={{ flex: 1, minWidth: 0 }}>
          <strong style={{ display: 'block', fontWeight: 600 }}>{tituloVisita(visita, items)}</strong>
          <span className="muted mini">
            {fechaTarjeta(visita.fecha)}
            {visita.km != null && ` · ${km(visita.km)}`}
            {visita.taller && ` · ${visita.taller}`}
          </span>
        </span>
        <span className="cifra" style={{ fontSize: 17, whiteSpace: 'nowrap' }}>{dinero(total, visita.moneda)}</span>
        <ChevronDown size={18} strokeWidth={1.8} color="var(--text-muted)" style={{ transform: abierta ? 'rotate(180deg)' : undefined, flexShrink: 0 }} aria-hidden />
      </button>

      {abierta && (
        <div style={{ padding: '0 18px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[...grupos].map(([sistema, xs]) => (
            <div key={sistema}>
              {variosSistemas && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--surface-2)' }}>
                  <span className="mini" style={{ fontWeight: 600, color: 'var(--lavanda)' }}>{sistema}</span>
                  <span className="mini muted">Subtotal {dinero(suma(xs), visita.moneda)}</span>
                </div>
              )}
              {xs.map((i) => (
                <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 0' }}>
                  <span>
                    {i.descripcion}
                    <span className="muted mini" style={{ display: 'block' }}>
                      {TEXTO_TIPO[i.tipo]}
                      {i.cantidad != null && ` · ${numero(i.cantidad, 0, 2)}`}
                    </span>
                  </span>
                  <span style={{ whiteSpace: 'nowrap' }}>{i.monto == null ? '—' : i.monto === 0 ? 'Sin costo' : dinero(i.monto, visita.moneda)}</span>
                </div>
              ))}
            </div>
          ))}

          <div className="resultado">
            <span>
              <strong>Total</strong>
              <span className="muted mini" style={{ display: 'block' }}>
                Pagado en {visita.moneda === 'VES' ? 'Bs' : 'USD'}
                {visita.moneda === 'VES' && visita.tasa_ves_usd && ` · tasa guardada (${numero(visita.tasa_ves_usd, 0, 2)} Bs/USD)`}
              </span>
            </span>
            <span style={{ textAlign: 'right' }}>
              <strong className="cifra" style={{ fontSize: 20 }}>{dinero(total, visita.moneda)}</strong>
              {visita.moneda === 'VES' && <span className="muted mini" style={{ display: 'block' }}>≈ {dinero(totalUsd)}</span>}
            </span>
          </div>

          {visita.afecta_rendimiento && (
            <span className="muted mini" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Gauge size={14} strokeWidth={1.8} aria-hidden /> Reinició la referencia de rendimiento
            </span>
          )}
          {visita.nota && <p className="muted" style={{ margin: 0 }}>{visita.nota}</p>}

          <button className="btn btn--bloque" onClick={() => navegar(`/taller/visita/${visita.id}`)}>
            <Pencil size={16} strokeWidth={1.8} /> Editar visita
          </button>
        </div>
      )}
    </section>
  )
}

function Productos() {
  const productos = useLiveQuery(async () =>
    (await db.products.toArray())
      .filter((p) => !p.deleted)
      .sort((a, b) => Number(b.en_uso) - Number(a.en_uso) || a.tipo.localeCompare(b.tipo)),
  )
  const [editando, setEditando] = useState<Producto | 'nuevo' | null>(null)

  return (
    <>
      <button className="btn btn--bloque" onClick={() => setEditando('nuevo')}>
        <Plus size={18} strokeWidth={2} /> Producto
      </button>
      {productos?.length === 0 && (
        <Vacio Icono={Package}>
          <p>Aquí van las fichas del aceite, refrigerante, filtros y demás productos que usas.</p>
        </Vacio>
      )}
      {productos?.map((p) => <FichaProducto key={p.id} producto={p} onEditar={() => setEditando(p)} />)}
      {editando && (
        <HojaProducto key={editando === 'nuevo' ? 'nuevo' : editando.id} producto={editando === 'nuevo' ? undefined : editando} onCerrar={() => setEditando(null)} />
      )}
    </>
  )
}

function FichaProducto({ producto: p, onEditar }: { producto: Producto; onEditar: () => void }) {
  const foto = useFotoUrl(p.foto_path)
  return (
    <button className="tarjeta ficha" onClick={onEditar}>
      <span className="ficha__foto">
        {foto ? <img src={foto} alt="" /> : <Package size={24} strokeWidth={1.8} color="var(--text-muted)" aria-hidden />}
      </span>
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span className="muted mini">{p.tipo}</span>
        <strong style={{ fontWeight: 600 }}>{[p.marca, p.especificacion].filter(Boolean).join(' · ')}</strong>
        {(p.presentacion || p.nota) && <span className="muted mini">{[p.presentacion, p.nota].filter(Boolean).join(' · ')}</span>}
        <span className={`chip ${p.en_uso ? 'chip--lavanda' : 'chip--neutro'}`} style={{ alignSelf: 'flex-start', marginTop: 4 }}>
          {p.en_uso ? 'En uso actual' : 'Anterior'}
        </span>
      </span>
    </button>
  )
}
