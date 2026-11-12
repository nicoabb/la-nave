import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Check, ChevronLeft, ChevronRight, CircleDot, Plus } from 'lucide-react'
import { useAviso } from '../components/Aviso'
import { ChipEstado, PuntoEstado } from '../components/comunes'
import { HojaCaucho, HojaServicio, registrarPresion } from '../components/HojasCauchos'
import type { Caucho, Posicion } from '../db/esquema'
import { useCauchos, useKilometraje, useVehiculoActivo } from '../db/hooks'
import { textoEdad, textoPosicion, type EstadoCaucho } from '../lib/cauchos'
import { fechaLista, km } from '../lib/formato'
import type { Estado, EstadoTarea } from '../lib/tareas'

const COLOR: Record<Estado, string> = { urgente: 'var(--coral)', pronto: 'var(--mantequilla)', 'en-orden': 'var(--menta)' }

type HojaAbierta =
  | { tipo: 'caucho'; posicion: Posicion; caucho?: Caucho }
  | { tipo: 'servicio'; servicio: 'balanceo' | 'alineacion' | 'presion' }
  | null

export default function Cauchos() {
  const vehiculo = useVehiculoActivo()
  const datos = useCauchos(vehiculo.id)
  const kmTotal = useKilometraje(vehiculo.id) ?? null
  const avisar = useAviso()
  const [hoja, setHoja] = useState<HojaAbierta>(null)

  if (!datos) return <main className="pantalla" />
  const { porPosicion, servicios, vidaUtil } = datos
  const ocupadas = new Map([...porPosicion].map(([p, x]) => [p, x.caucho]))
  const montados = [...ocupadas.values()]
  const abrir = (posicion: Posicion) => setHoja({ tipo: 'caucho', posicion, caucho: ocupadas.get(posicion) })

  const delantero = porPosicion.get('DI')?.caucho ?? porPosicion.get('DD')?.caucho
  const rep = porPosicion.get('REP')

  return (
    <main className="pantalla">
      <header className="encabezado" style={{ justifyContent: 'flex-start', alignItems: 'center' }}>
        <Link to="/taller" className="btn" aria-label="Volver a Taller" style={{ padding: 0, width: 44 }}>
          <ChevronLeft size={22} strokeWidth={1.8} />
        </Link>
        <h1 className="titulo">Cauchos</h1>
      </header>

      <section className="tarjeta" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span className="muted mini" style={{ textAlign: 'center', letterSpacing: 1, textTransform: 'uppercase' }}>Frente</span>
        <div className="carro">
          <EtiquetaCaucho posicion="DI" dato={porPosicion.get('DI')} alinear="right" onClick={() => abrir('DI')} />
          <VistaCarro porPosicion={porPosicion} onClick={abrir} />
          <EtiquetaCaucho posicion="DD" dato={porPosicion.get('DD')} alinear="left" onClick={() => abrir('DD')} />
          <EtiquetaCaucho posicion="TI" dato={porPosicion.get('TI')} alinear="right" onClick={() => abrir('TI')} />
          <EtiquetaCaucho posicion="TD" dato={porPosicion.get('TD')} alinear="left" onClick={() => abrir('TD')} />
        </div>
      </section>

      {/* Repuesto */}
      <button className="tarjeta fila-tarjeta" onClick={() => abrir('REP')}>
        <span className="icono-caja">
          <CircleDot size={20} strokeWidth={1.8} color={rep ? COLOR[rep.estado.estado] : 'var(--text-muted)'} aria-hidden />
        </span>
        <span style={{ flex: 1 }}>
          <strong style={{ fontWeight: 600 }}>Repuesto</strong>
          <span className="muted mini" style={{ display: 'block' }}>
            {rep ? lineaCaucho(rep.caucho, rep.estado) || 'Sin DOT' : 'Toca para agregarlo'}
          </span>
        </span>
        {rep && <ChipEstado estado={rep.estado.estado} texto={rep.estado.estado === 'urgente' ? 'Cambiar' : undefined} />}
      </button>

      {(delantero?.fecha_montaje || delantero?.km_montaje != null) && (
        <p className="muted mini" style={{ margin: 0 }}>
          {delantero.fecha_montaje && `Delanteros montados el ${fechaLista(delantero.fecha_montaje)}`}
          {delantero.km_montaje != null && ` · Revisión de desgaste a los ${km(delantero.km_montaje + vidaUtil)}`}
        </p>
      )}

      <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h2 className="titulo-seccion">Servicios</h2>
        <div className="tarjeta lista" style={{ paddingTop: 4, paddingBottom: 4 }}>
          <FilaServicio
            nombre="Presión de aire"
            estado={servicios.presion}
            accion={
              <button
                className="btn btn--primario"
                style={{ minHeight: 36, padding: '0 12px' }}
                onClick={async (e) => {
                  e.stopPropagation()
                  await registrarPresion(vehiculo.id, kmTotal)
                  avisar('Presión registrada', 'La próxima, en 2 semanas.')
                }}
              >
                <Check size={16} strokeWidth={2} /> Listo
              </button>
            }
            onClick={() => setHoja({ tipo: 'servicio', servicio: 'presion' })}
          />
          <FilaServicio nombre="Balanceo y rotación" estado={servicios.balanceo} onClick={() => setHoja({ tipo: 'servicio', servicio: 'balanceo' })} />
          <FilaServicio nombre="Alineación" estado={servicios.alineacion} onClick={() => setHoja({ tipo: 'servicio', servicio: 'alineacion' })} />
        </div>
        <span className="muted mini">Toca un servicio para registrarlo con otra fecha o km.</span>
      </section>

      {hoja?.tipo === 'caucho' && (
        <HojaCaucho
          key={hoja.caucho?.id ?? hoja.posicion}
          vehiculoId={vehiculo.id}
          caucho={hoja.caucho}
          posicionInicial={hoja.posicion}
          kmTotal={kmTotal}
          ocupadas={ocupadas}
          onCerrar={() => setHoja(null)}
        />
      )}
      {hoja?.tipo === 'servicio' && (
        <HojaServicio vehiculoId={vehiculo.id} tipo={hoja.servicio} kmTotal={kmTotal} montados={montados} onCerrar={() => setHoja(null)} />
      )}
    </main>
  )
}

function lineaCaucho(c: Caucho, e: EstadoCaucho): string {
  const partes = [c.dot_anio && e.edad !== null ? `${c.dot_anio} · ${textoEdad(e.edad)}` : null, e.motivo || null]
  return partes.filter(Boolean).join(' · ')
}

function EtiquetaCaucho({
  posicion,
  dato,
  alinear,
  onClick,
}: {
  posicion: Posicion
  dato?: { caucho: Caucho; estado: EstadoCaucho }
  alinear: 'left' | 'right'
  onClick: () => void
}) {
  return (
    <button className="carro__etiqueta" style={{ textAlign: alinear, alignItems: alinear === 'left' ? 'flex-start' : 'flex-end' }} onClick={onClick}>
      <span className="muted mini">{textoPosicion(posicion)}</span>
      {dato ? (
        <>
          <strong style={{ fontWeight: 600 }}>
            {dato.caucho.dot_anio && dato.estado.edad !== null ? `${dato.caucho.dot_anio} · ${textoEdad(dato.estado.edad)}` : 'Sin DOT'}
          </strong>
          <ChipEstado estado={dato.estado.estado} />
        </>
      ) : (
        <span className="enlace mini" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <Plus size={14} strokeWidth={2} /> Agregar
        </span>
      )}
    </button>
  )
}

/** Silueta del carro visto desde arriba, con cada caucho del color de su estado. */
function VistaCarro({
  porPosicion,
  onClick,
}: {
  porPosicion: Map<Posicion, { caucho: Caucho; estado: EstadoCaucho }>
  onClick: (p: Posicion) => void
}) {
  const ruedas: { p: Posicion; x: number; y: number }[] = [
    { p: 'DI', x: 4, y: 38 },
    { p: 'DD', x: 82, y: 38 },
    { p: 'TI', x: 4, y: 140 },
    { p: 'TD', x: 82, y: 140 },
  ]
  return (
    <svg className="carro__svg" viewBox="0 0 100 210" role="img" aria-label="Carro visto desde arriba">
      <rect x="14" y="6" width="72" height="198" rx="26" style={{ fill: 'var(--surface-2)', stroke: 'var(--border)', strokeWidth: 1.5 }} />
      <path d="M24 62 Q50 50 76 62 L72 84 Q50 78 28 84 Z" style={{ fill: 'var(--bg)', opacity: 0.7 }} />
      <path d="M28 150 Q50 156 72 150 L74 166 Q50 172 26 166 Z" style={{ fill: 'var(--bg)', opacity: 0.7 }} />
      {ruedas.map(({ p, x, y }) => {
        const d = porPosicion.get(p)
        return (
          <rect
            key={p}
            x={x}
            y={y}
            width="14"
            height="34"
            rx="5"
            onClick={() => onClick(p)}
            style={{
              cursor: 'pointer',
              fill: d ? COLOR[d.estado.estado] : 'var(--surface)',
              stroke: d ? 'none' : 'var(--border)',
              strokeDasharray: d ? undefined : '3 3',
            }}
          />
        )
      })}
    </svg>
  )
}

function FilaServicio({
  nombre,
  estado,
  accion,
  onClick,
}: {
  nombre: string
  estado?: EstadoTarea
  accion?: ReactNode
  onClick: () => void
}) {
  return (
    <div className="lista__fila" role="button" tabIndex={0} onClick={onClick} onKeyDown={(e) => e.key === 'Enter' && onClick()} style={{ cursor: 'pointer' }}>
      {estado && <PuntoEstado estado={estado.estado} />}
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontWeight: 600 }}>{nombre}</span>
        <span className="muted mini">{estado ? estado.texto : 'Tarea desactivada'}</span>
      </span>
      {accion ?? (estado ? <ChipEstado estado={estado.estado} /> : <ChevronRight size={18} strokeWidth={1.8} color="var(--text-muted)" />)}
    </div>
  )
}
