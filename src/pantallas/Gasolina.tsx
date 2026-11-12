import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Fuel, Trash2, TrendingUp, TriangleAlert } from 'lucide-react'
import { Encabezado, Vacio } from '../components/comunes'
import { FormCarga } from '../components/FormCarga'
import { GraficoRendimiento } from '../components/GraficoRendimiento'
import { Hoja } from '../components/Hoja'
import { db, type CargaGasolina } from '../db/esquema'
import { useGasolina, useVehiculoActivo } from '../db/hooks'
import { borrar } from '../db/repo'
import { fechaLista, kmViaje, litros, numero } from '../lib/formato'
import type { Analisis } from '../lib/gasolina'

export default function Gasolina() {
  const vehiculo = useVehiculoActivo()
  const { cargas, tramos, pendiente, analisis } = useGasolina(vehiculo.id)
  const foco = (useLocation().state as { foco?: boolean } | null)?.foco
  const [editando, setEditando] = useState<CargaGasolina | null>(null)

  const kmLPorCarga = new Map(tramos.map((t) => [t.id, t.kmL]))
  const historial = [...cargas].reverse()

  async function borrarCarga(c: CargaGasolina) {
    if (!window.confirm(`¿Borrar la carga del ${fechaLista(c.fecha)}?`)) return
    await borrar(db.fuel_logs, c.id)
    setEditando(null)
  }

  return (
    <main className="pantalla">
      <Encabezado titulo="Gasolina" subtitulo="Tanque lleno a tanque lleno" />

      <section className="tarjeta" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 className="titulo-seccion">Rendimiento</h2>
            <span className="muted mini">
              {analisis.recientes.length > 1 ? `Últimas ${analisis.recientes.length} cargas` : 'Por carga'}
            </span>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span className="cifra" style={{ fontSize: 24, color: 'var(--cielo)' }}>
              {analisis.promedio ? numero(analisis.promedio, 1) : '—'}
            </span>
            <span className="muted mini" style={{ display: 'block' }}>km/L promedio</span>
          </div>
        </div>

        {analisis.recientes.length > 0 ? (
          <>
            <GraficoRendimiento tramos={analisis.recientes} referencia={analisis.referencia} anomalos={analisis.anomalos} />
            {analisis.referencia !== null && (
              <span className="muted mini">
                Línea punteada: tu referencia ({numero(analisis.referencia, 1)} km/L, las 6 cargas anteriores a las últimas 3)
              </span>
            )}
          </>
        ) : (
          <p className="muted" style={{ margin: 0 }}>Registra tu primera carga full para ver el rendimiento.</p>
        )}

        <AvisoRendimiento analisis={analisis} />
      </section>

      <section className="tarjeta" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h2 className="titulo-seccion">Nueva carga</h2>
        <FormCarga vehiculoId={vehiculo.id} pendiente={pendiente} autoFocus={foco} />
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h2 className="titulo-seccion">Historial de cargas</h2>
        {historial.length === 0 ? (
          <Vacio Icono={Fuel} color="var(--cielo)">
            <p>Todavía no hay cargas registradas.</p>
          </Vacio>
        ) : (
          <div className="tarjeta lista" style={{ paddingTop: 4, paddingBottom: 4 }}>
            {historial.map((c) => {
              const kmL = kmLPorCarga.get(c.id)
              return (
                <button key={c.id} className="lista__fila" onClick={() => setEditando(c)}>
                  <span style={{ flex: 1 }}>
                    <span style={{ display: 'block', fontWeight: 600 }}>{fechaLista(c.fecha)}</span>
                    <span className="muted mini">{c.km_recorridos != null ? kmViaje(c.km_recorridos) : 'Sin km'} · {litros(c.litros)}</span>
                  </span>
                  {c.full === null ? (
                    <span className="chip chip--neutro">¿Full?</span>
                  ) : c.full && c.km_recorridos == null ? (
                    <span className="chip chip--neutro">Sin km</span>
                  ) : c.full ? (
                    <span className="cifra" style={{ fontSize: 18, color: analisis.anomalos.has(c.id) ? 'var(--coral)' : 'var(--cielo)' }}>
                      {kmL ? numero(kmL, 1) : '—'} <span className="mini muted" style={{ fontFamily: 'var(--font-body)' }}>km/L</span>
                    </span>
                  ) : (
                    <span className="chip chip--neutro">No fue full</span>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </section>

      {editando && (
        <Hoja titulo="Editar carga" onCerrar={() => setEditando(null)}>
          <FormCarga key={editando.id} vehiculoId={vehiculo.id} carga={editando} onGuardado={() => setEditando(null)} />
          <button className="btn btn--bloque btn--peligro" onClick={() => borrarCarga(editando)}>
            <Trash2 size={18} strokeWidth={1.8} /> Borrar carga
          </button>
        </Hoja>
      )}
    </main>
  )
}

function AvisoRendimiento({ analisis }: { analisis: Analisis }) {
  const { alerta, ventana, referencia } = analisis
  if (!alerta || ventana === null || referencia === null) return null
  const pct = Math.round(Math.abs(1 - ventana / referencia) * 100)

  if (alerta === 'positiva') {
    return (
      <div className="aviso aviso--positiva" role="status">
        <TrendingUp size={18} strokeWidth={1.8} aria-hidden style={{ flexShrink: 0 }} />
        <span>Las últimas 3 cargas rinden {pct} % más que tu referencia.</span>
      </div>
    )
  }
  return (
    <div className={`aviso aviso--${alerta}`} role="alert">
      <TriangleAlert size={18} strokeWidth={1.8} aria-hidden style={{ flexShrink: 0 }} />
      <span>
        {alerta === 'fuerte' ? (
          <><strong>Ya no parece una carga suelta: conviene revisar.</strong> Las últimas 3 cargas rinden {pct} % menos que tu referencia.</>
        ) : (
          <>Las últimas 3 cargas rinden {pct} % menos que tu referencia. Podría ser el nivel del full; si se repite, revisa.</>
        )}
      </span>
    </div>
  )
}
