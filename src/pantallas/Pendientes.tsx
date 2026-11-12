import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ChevronDown, ListChecks, Plus } from 'lucide-react'
import { Encabezado, PuntoEstado, Vacio } from '../components/comunes'
import { HojaPendiente } from '../components/HojaPendiente'
import type { Deseo, TareaMantenimiento } from '../db/esquema'
import { usePendientes, useVehiculoActivo, type ItemPendiente } from '../db/hooks'
import { dinero, fechaLista } from '../lib/formato'
import type { Estado, EstadoTarea } from '../lib/tareas'
import { HojaAccionesTarea } from '../components/HojaAccionesTarea'

const GRUPOS: { estado: Estado; titulo: string }[] = [
  { estado: 'urgente', titulo: 'Urgente' },
  { estado: 'pronto', titulo: 'Pronto' },
  { estado: 'en-orden', titulo: 'En orden' },
]

export default function Pendientes() {
  const vehiculo = useVehiculoActivo()
  const datos = usePendientes(vehiculo.id)
  const navegar = useNavigate()
  const nuevoDesdeInicio = (useLocation().state as { nuevo?: boolean } | null)?.nuevo
  const [hoja, setHoja] = useState<Deseo | 'nuevo' | null>(nuevoDesdeInicio ? 'nuevo' : null)
  const [acciones, setAcciones] = useState<EstadoTarea<TareaMantenimiento> | null>(null)
  const [abiertos, setAbiertos] = useState<Record<string, boolean>>({ urgente: true, pronto: true, 'en-orden': false, hechos: false })

  const items = datos?.items ?? []
  const activos = items.filter((i) => i.estado !== 'en-orden')
  const totalUsd = activos.reduce((s, i) => s + (i.costoUsd ?? 0), 0)
  const sinEstimado = activos.filter((i) => i.costoUsd == null).length

  function abrir(i: ItemPendiente) {
    if (i.deseo) setHoja(i.deseo)
    else if (i.estadoTarea) setAcciones(i.estadoTarea)
  }

  return (
    <main className="pantalla">
      <Encabezado
        titulo="Pendientes"
        subtitulo="Ordenado por prioridad"
        accion={
          <button className="btn btn--primario" onClick={() => setHoja('nuevo')}>
            <Plus size={18} strokeWidth={2} /> Añadir
          </button>
        }
      />

      <section className="tarjeta">
        <span className="muted mini">Urgente + pronto</span>
        <div className="cifra" style={{ marginTop: 6 }}>{datos ? `≈ ${dinero(Math.round(totalUsd))}` : '—'}</div>
        <p className="muted mini" style={{ margin: '6px 0 0' }}>
          No incluye lo que está en orden
          {sinEstimado > 0 && ` · ${sinEstimado} sin estimado`}
        </p>
      </section>

      {datos && items.length === 0 && (
        <Vacio Icono={ListChecks}>
          <p>No hay pendientes.</p>
        </Vacio>
      )}

      {GRUPOS.map(({ estado, titulo }) => {
        const del = items.filter((i) => i.estado === estado)
        if (!del.length) return null
        const abierto = abiertos[estado]
        return (
          <section key={estado} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button className="grupo__titulo" aria-expanded={abierto} onClick={() => setAbiertos((a) => ({ ...a, [estado]: !abierto }))}>
              <PuntoEstado estado={estado} />
              <span className="titulo-seccion" style={{ flex: 1 }}>{titulo} · {del.length}</span>
              <ChevronDown size={18} strokeWidth={1.8} color="var(--text-muted)" style={{ transform: abierto ? 'rotate(180deg)' : undefined }} aria-hidden />
            </button>
            {abierto && (
              <div className="tarjeta lista" style={{ paddingTop: 4, paddingBottom: 4 }}>
                {del.map((i) => <FilaPendiente key={i.clave} item={i} onClick={() => abrir(i)} />)}
              </div>
            )}
          </section>
        )
      })}

      {datos && datos.hechos.length > 0 && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button className="grupo__titulo" aria-expanded={abiertos.hechos} onClick={() => setAbiertos((a) => ({ ...a, hechos: !a.hechos }))}>
            <span className="titulo-seccion muted" style={{ flex: 1 }}>Hechos · {datos.hechos.length}</span>
            <ChevronDown size={18} strokeWidth={1.8} color="var(--text-muted)" style={{ transform: abiertos.hechos ? 'rotate(180deg)' : undefined }} aria-hidden />
          </button>
          {abiertos.hechos && (
            <div className="tarjeta lista" style={{ paddingTop: 4, paddingBottom: 4 }}>
              {datos.hechos.map((d) => (
                <button key={d.id} className="lista__fila" onClick={() => setHoja(d)}>
                  <span style={{ flex: 1 }}>
                    <span style={{ display: 'block', textDecoration: 'line-through', color: 'var(--text-muted)' }}>{d.titulo}</span>
                    {d.fecha_hecho && <span className="muted mini">Hecho el {fechaLista(d.fecha_hecho)}</span>}
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {acciones && <HojaAccionesTarea key={acciones.tarea.id} estado={acciones} onCerrar={() => setAcciones(null)} />}

      {hoja && (
        <HojaPendiente
          key={hoja === 'nuevo' ? 'nuevo' : hoja.id}
          vehiculoId={vehiculo.id}
          deseo={hoja === 'nuevo' ? undefined : hoja}
          onCerrar={() => {
            setHoja(null)
            if (nuevoDesdeInicio) navegar('/pendientes', { replace: true })
          }}
        />
      )}
    </main>
  )
}

function FilaPendiente({ item: i, onClick }: { item: ItemPendiente; onClick: () => void }) {
  return (
    <button className="lista__fila" onClick={onClick}>
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ fontWeight: 600 }}>{i.titulo}</span>
          <span style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>
            {i.costoUsd != null ? `≈ ${dinero(Math.round(i.costoUsd))}` : <span className="muted mini">Sin estimado</span>}
          </span>
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="chip chip--neutro" style={{ padding: '2px 8px' }}>{i.tipo === 'periodico' ? 'Periódico' : 'Puntual'}</span>
          {i.detalle && <span className="muted mini" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.detalle}</span>}
        </span>
      </span>
    </button>
  )
}
