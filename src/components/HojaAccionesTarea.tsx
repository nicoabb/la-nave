import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarCheck, ChevronRight, CircleDot, ClipboardCheck, Pencil, Plus, Receipt, Wrench } from 'lucide-react'
import { db, type TareaMantenimiento, type TipoEventoCaucho, type TipoRevision } from '../db/esquema'
import { useKilometraje, useMantenimiento, useVehiculoActivo } from '../db/hooks'
import { crear } from '../db/repo'
import { hoyISO } from '../lib/fechas'
import { dinero, fechaLista, fechaTarjeta, km, leerEntero, numero } from '../lib/formato'
import { describirIntervalo, type EstadoTarea } from '../lib/tareas'
import { tituloVisita } from '../pantallas/Taller'
import { HojaTarea } from '../pantallas/Tareas'
import { useAviso } from './Aviso'
import { Campo } from './Campo'
import { ChipEstado } from './comunes'
import { Hoja } from './Hoja'
import { HojaGasto } from './HojaGasto'

/** Tareas que se registran como evento de cauchos. */
const EVENTO_DE_TAREA: Record<string, TipoEventoCaucho> = {
  presion_cauchos: 'presion',
  rotacion: 'rotacion',
  balanceo: 'balanceo',
  alineacion: 'alineacion',
}
/** Tareas con formulario de revisión propio (checklist, mediciones). */
const CON_FORMULARIO: Record<string, TipoRevision> = { revision_semanal: 'semanal_capo', bateria: 'bateria' }

type Modo = 'menu' | 'hecha' | 'visita' | 'gasto' | 'editar'

/**
 * Lo que se puede hacer con una tarea periódica: marcarla hecha, sumarla a una
 * visita existente o nueva, registrar su pago como gasto o editarla.
 */
export function HojaAccionesTarea({ estado: e, onCerrar }: { estado: EstadoTarea<TareaMantenimiento>; onCerrar: () => void }) {
  const t = e.tarea
  const navegar = useNavigate()
  const vehiculo = useVehiculoActivo()
  const mant = useMantenimiento(vehiculo.id)
  const [modo, setModo] = useState<Modo>('menu')
  const costo = mant?.costo(t.id) ?? null
  const ir = (ruta: string) => {
    onCerrar()
    navegar(ruta)
  }

  if (modo === 'editar') return <HojaTarea vehiculoId={vehiculo.id} tarea={t} onCerrar={onCerrar} />
  if (modo === 'gasto') {
    return <HojaGasto vehiculoId={vehiculo.id} tareaInicial={t} categoriaInicial={t.clave === 'rcv' ? 'seguro' : 'otro'} onCerrar={onCerrar} />
  }

  return (
    <Hoja titulo={t.nombre} onCerrar={onCerrar}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <ChipEstado estado={e.estado} />
        <span style={{ fontWeight: 600 }}>{e.texto}</span>
      </div>
      <div className="resultado" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
        <span className="mini">
          <span className="muted">Última vez: </span>
          {e.ultimaFecha || e.ultimaKm != null
            ? [e.ultimaFecha && fechaLista(e.ultimaFecha), e.ultimaKm != null && `≈ ${km(e.ultimaKm)}`].filter(Boolean).join(' · ')
            : 'sin registro'}
        </span>
        <span className="mini">
          <span className="muted">Frecuencia: </span>
          {describirIntervalo(t)}
        </span>
        <span className="mini">
          <span className="muted">Estimado: </span>
          {costo
            ? `≈ ${dinero(Math.round(costo.usd * 100) / 100)} ${costo.veces ? `(según ${costo.veces === 1 ? 'tu último pago' : `tus últimos ${costo.veces}`})` : '(estimado manual)'}`
            : 'sin estimado'}
        </span>
      </div>

      {modo === 'menu' && (
        <>
          {t.clave && CON_FORMULARIO[t.clave] && (
            <Accion Icono={ClipboardCheck} texto="Registrar revisión" detalle="Con su checklist o mediciones" destacada onClick={() => ir(`/revision/${t.id}`)} />
          )}
          <Accion
            Icono={CalendarCheck}
            texto="Marcar como hecha"
            detalle="Con fecha y km, sin crear visita"
            destacada={!(t.clave && CON_FORMULARIO[t.clave])}
            onClick={() => setModo('hecha')}
          />
          <Accion Icono={Wrench} texto="Agregar a una visita existente" detalle="Por ejemplo, si se hizo junto con otro trabajo" onClick={() => setModo('visita')} />
          <Accion Icono={Plus} texto="Registrar visita nueva al taller" onClick={() => ir(`/taller/visita/nueva?tarea=${t.id}`)} />
          <Accion Icono={Receipt} texto="Registrar el pago como gasto" detalle="Para lo que no es taller, como el seguro" onClick={() => setModo('gasto')} />
          {t.clave && EVENTO_DE_TAREA[t.clave] && <Accion Icono={CircleDot} texto="Ir a Cauchos" onClick={() => ir('/taller/cauchos')} />}
          <Accion Icono={Pencil} texto="Editar tarea" detalle="Frecuencia, última vez, estimado o desactivarla" onClick={() => setModo('editar')} />
        </>
      )}

      {modo === 'hecha' && <FormHecha tarea={t} onListo={onCerrar} onVolver={() => setModo('menu')} />}

      {modo === 'visita' && (
        <>
          <span className="muted mini">Elige la visita donde se hizo. Se agregará un ítem vinculado a esta tarea.</span>
          <div className="lista">
            {mant?.visitas.slice(0, 20).map((v) => (
              <button key={v.id} className="lista__fila" onClick={() => ir(`/taller/visita/${v.id}?tarea=${t.id}`)}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontWeight: 600 }}>{tituloVisita(v, mant.items.filter((i) => i.visit_id === v.id))}</span>
                  <span className="muted mini">
                    {fechaTarjeta(v.fecha)}
                    {v.km != null && ` · ${km(v.km)}`}
                    {v.taller && ` · ${v.taller}`}
                  </span>
                </span>
                <ChevronRight size={18} strokeWidth={1.8} color="var(--text-muted)" />
              </button>
            ))}
            {mant?.visitas.length === 0 && <p className="muted">Todavía no hay visitas.</p>}
          </div>
          <button className="btn btn--bloque" onClick={() => setModo('menu')}>Volver</button>
        </>
      )}
    </Hoja>
  )
}

function Accion({
  Icono,
  texto,
  detalle,
  destacada,
  onClick,
}: {
  Icono: typeof Wrench
  texto: string
  detalle?: string
  destacada?: boolean
  onClick: () => void
}) {
  return (
    <button className={`opcion${destacada ? ' opcion--destacada' : ''}`} onClick={onClick}>
      <span className="icono-caja" style={destacada ? undefined : { background: 'var(--surface)' }}>
        <Icono size={20} strokeWidth={1.8} color={destacada ? undefined : 'var(--lavanda)'} />
      </span>
      <span className="opcion__texto">
        {texto}
        {detalle && <small className={destacada ? undefined : 'muted'}>{detalle}</small>}
      </span>
    </button>
  )
}

/** Marca la tarea como hecha: revisión vinculada, o evento si es de cauchos. */
function FormHecha({ tarea: t, onListo, onVolver }: { tarea: TareaMantenimiento; onListo: () => void; onVolver: () => void }) {
  const vehiculo = useVehiculoActivo()
  const kmTotal = useKilometraje(vehiculo.id)
  const avisar = useAviso()
  const [fecha, setFecha] = useState(hoyISO())
  const [kmTexto, setKmTexto] = useState(kmTotal ? numero(Math.round(kmTotal)) : '')
  const [nota, setNota] = useState('')

  async function guardar(ev: FormEvent) {
    ev.preventDefault()
    const kmN = kmTexto.trim() ? leerEntero(kmTexto) : null
    const evento = t.clave ? EVENTO_DE_TAREA[t.clave] : undefined
    if (evento) {
      await crear(db.tire_events, {
        vehicle_id: vehiculo.id,
        fecha,
        km: kmN,
        tipo: evento,
        detalle: evento === 'alineacion' ? { eje: 'ambas' } : null,
        visit_id: null,
        monto: null,
        moneda: null,
        tasa_ves_usd: null,
        tasa_origen: null,
        monto_usd: null,
      })
    } else {
      await crear(db.inspections, {
        vehicle_id: vehiculo.id,
        fecha,
        km: kmN,
        tipo: (t.clave && CON_FORMULARIO[t.clave]) || 'otra',
        checklist: null,
        mediciones: null,
        task_id: t.id,
        nota: nota.trim() || 'Marcada como hecha',
      })
    }
    avisar('Tarea marcada como hecha', fechaLista(fecha))
    onListo()
  }

  return (
    <form className="form" onSubmit={guardar} noValidate>
      <div className="fila-campos">
        <Campo etiqueta="Fecha">
          <input className="input" type="date" value={fecha} max={hoyISO()} onChange={(e) => setFecha(e.target.value)} />
        </Campo>
        <Campo etiqueta="Km del tablero" ayuda="Déjalo vacío si no lo sabes">
          <input className="input" inputMode="numeric" autoComplete="off" value={kmTexto} onChange={(e) => setKmTexto(e.target.value)} />
        </Campo>
      </div>
      <Campo etiqueta="Nota (opcional)">
        <input className="input" autoComplete="off" value={nota} onChange={(e) => setNota(e.target.value)} />
      </Campo>
      <button type="submit" className="btn btn--primario btn--bloque">Guardar</button>
      <button type="button" className="btn btn--bloque" onClick={onVolver}>Volver</button>
    </form>
  )
}
