import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, Plus, Trash2, TriangleAlert } from 'lucide-react'
import { useAviso } from '../components/Aviso'
import { Campo } from '../components/Campo'
import { ChipEstado } from '../components/comunes'
import { Hoja } from '../components/Hoja'
import { db, type TareaMantenimiento } from '../db/esquema'
import { useMantenimiento, useVehiculoActivo } from '../db/hooks'
import { actualizar, borrar, crear, guardarMeta } from '../db/repo'
import { SISTEMAS } from '../lib/catalogos'
import { hoyISO } from '../lib/fechas'
import { fechaLista, km, leerEntero, numero } from '../lib/formato'
import { describirIntervalo, duracion } from '../lib/tareas'

/** Configuración de tareas periódicas (SPEC §5.3 y §7). */
export default function Tareas() {
  const vehiculo = useVehiculoActivo()
  const datos = useMantenimiento(vehiculo.id)
  const claveRevisados = `intervalos_revisados_${vehiculo.id}`
  const revisados = useLiveQuery(async () => Boolean((await db.meta.get(claveRevisados))?.valor), [claveRevisados])
  const [editando, setEditando] = useState<TareaMantenimiento | 'nueva' | null>(null)

  const estadoPorId = new Map(datos?.estados.map((e) => [e.tarea.id, e]))
  const hayManual = datos?.tareas.some((t) => t.fuente === 'Manual')

  return (
    <main className="pantalla">
      <header className="encabezado" style={{ alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link to="/configuracion" className="btn" aria-label="Volver a Configuración" style={{ padding: 0, width: 44 }}>
            <ChevronLeft size={22} strokeWidth={1.8} />
          </Link>
          <h1 className="titulo" style={{ fontSize: 24 }}>Tareas periódicas</h1>
        </div>
        <button className="btn btn--primario" onClick={() => setEditando('nueva')} aria-label="Nueva tarea">
          <Plus size={18} strokeWidth={2} />
        </button>
      </header>

      {revisados === false && hayManual && (
        <div className="aviso aviso--suave">
          <TriangleAlert size={18} strokeWidth={1.8} aria-hidden style={{ flexShrink: 0 }} />
          <span style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span>
              Los intervalos marcados <strong>Manual</strong> son de referencia para condiciones severas. Confírmalos con tu
              manual del propietario antes de darlos por buenos.
            </span>
            <button className="btn" style={{ alignSelf: 'flex-start', borderColor: 'currentColor', minHeight: 36 }} onClick={() => guardarMeta(claveRevisados, true)}>
              Ya los revisé
            </button>
          </span>
        </div>
      )}

      <p className="muted mini" style={{ margin: 0 }}>
        Toca una tarea para cambiar su intervalo o anotar cuándo se hizo por última vez.
      </p>

      <div className="tarjeta lista" style={{ paddingTop: 4, paddingBottom: 4 }}>
        {datos?.tareas.map((t) => {
          const e = estadoPorId.get(t.id)
          return (
            <button key={t.id} className="lista__fila" onClick={() => setEditando(t)} style={{ opacity: t.activa ? 1 : 0.5 }}>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontWeight: 600 }}>{t.nombre}</span>
                <span className="muted mini">
                  {describirIntervalo(t)}
                  {t.fuente && ` · ${t.fuente}`}
                  {!t.activa && ' · Desactivada'}
                </span>
                {e && <span className="mini" style={{ display: 'block', marginTop: 2 }}>{e.texto}</span>}
              </span>
              {e && <ChipEstado estado={e.estado} />}
            </button>
          )
        })}
      </div>

      {editando && (
        <HojaTarea
          key={editando === 'nueva' ? 'nueva' : editando.id}
          vehiculoId={vehiculo.id}
          tarea={editando === 'nueva' ? undefined : editando}
          onCerrar={() => setEditando(null)}
        />
      )}
    </main>
  )
}

function HojaTarea({ vehiculoId, tarea, onCerrar }: { vehiculoId: string; tarea?: TareaMantenimiento; onCerrar: () => void }) {
  const avisar = useAviso()
  const [nombre, setNombre] = useState(tarea?.nombre ?? '')
  const [sistema, setSistema] = useState(tarea?.sistema ?? 'Motor')
  const [intervaloKm, setIntervaloKm] = useState(tarea?.intervalo_km ? numero(tarea.intervalo_km) : '')
  const [intervaloDias, setIntervaloDias] = useState(tarea?.intervalo_dias ? String(tarea.intervalo_dias) : '')
  const [ultimaFecha, setUltimaFecha] = useState(tarea?.ultima_fecha_inicial ?? '')
  const [ultimaKm, setUltimaKm] = useState(tarea?.ultima_km_inicial != null ? numero(tarea.ultima_km_inicial) : '')
  const [esRevision, setEsRevision] = useState(tarea?.es_revision ?? false)
  const [activa, setActiva] = useState(tarea?.activa ?? true)
  const [notas, setNotas] = useState(tarea?.notas ?? '')
  const [error, setError] = useState('')

  const diasN = leerEntero(intervaloDias)

  async function guardar(e: FormEvent) {
    e.preventDefault()
    if (!nombre.trim()) return setError('Escribe el nombre de la tarea.')
    const kmN = intervaloKm.trim() ? leerEntero(intervaloKm) : null
    if (!kmN && !diasN) return setError('Pon un intervalo en km, en días o en ambos.')
    const datos = {
      nombre: nombre.trim(),
      sistema,
      intervalo_km: kmN || null,
      intervalo_dias: diasN || null,
      ultima_fecha_inicial: ultimaFecha || null,
      ultima_km_inicial: ultimaKm.trim() ? leerEntero(ultimaKm) : null,
      es_revision: esRevision,
      activa,
      notas: notas.trim(),
    }
    if (tarea) await actualizar(db.maintenance_tasks, tarea.id, datos)
    else await crear(db.maintenance_tasks, { vehicle_id: vehiculoId, clave: null, fuente: '', ...datos })
    avisar(tarea ? 'Tarea actualizada' : 'Tarea creada')
    onCerrar()
  }

  async function borrarTarea() {
    if (!tarea || !window.confirm(`¿Borrar la tarea "${tarea.nombre}"? Si solo quieres pausarla, desactívala.`)) return
    await borrar(db.maintenance_tasks, tarea.id)
    onCerrar()
  }

  return (
    <Hoja titulo={tarea ? 'Editar tarea' : 'Nueva tarea'} onCerrar={onCerrar}>
      <form className="form" onSubmit={guardar} noValidate>
        <Campo etiqueta="Nombre">
          <input className="input" autoComplete="off" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </Campo>
        <Campo etiqueta="Sistema">
          <select className="input" value={sistema} onChange={(e) => setSistema(e.target.value)}>
            {SISTEMAS.map((s) => <option key={s}>{s}</option>)}
          </select>
        </Campo>
        <div className="fila-campos">
          <Campo etiqueta="Cada (km)">
            <input className="input" inputMode="numeric" autoComplete="off" value={intervaloKm} onChange={(e) => setIntervaloKm(e.target.value)} />
          </Campo>
          <Campo etiqueta="Cada (días)" ayuda={diasN ? `≈ ${duracion(diasN)}` : 'Vence lo que ocurra primero'}>
            <input className="input" inputMode="numeric" autoComplete="off" value={intervaloDias} onChange={(e) => setIntervaloDias(e.target.value)} />
          </Campo>
        </div>
        <span className="campo__etiqueta" style={{ marginBottom: -6 }}>Última vez (si no está registrada en la app)</span>
        <div className="fila-campos">
          <Campo etiqueta="Fecha">
            <input className="input" type="date" value={ultimaFecha} max={hoyISO()} onChange={(e) => setUltimaFecha(e.target.value)} />
          </Campo>
          <Campo etiqueta="Km">
            <input className="input" inputMode="numeric" autoComplete="off" value={ultimaKm} onChange={(e) => setUltimaKm(e.target.value)} />
          </Campo>
        </div>
        {(tarea?.ultima_fecha_inicial || tarea?.ultima_km_inicial != null) && (
          <span className="muted mini" style={{ marginTop: -6 }}>
            Guardado: {[tarea.ultima_fecha_inicial && fechaLista(tarea.ultima_fecha_inicial), tarea.ultima_km_inicial != null && km(tarea.ultima_km_inicial)].filter(Boolean).join(' · ')}
          </span>
        )}
        <Campo etiqueta="Notas (opcional)">
          <input className="input" autoComplete="off" value={notas} onChange={(e) => setNotas(e.target.value)} />
        </Campo>
        <label className="check">
          <input type="checkbox" checked={esRevision} onChange={(e) => setEsRevision(e.target.checked)} />
          Solo revisar (no cambiar)
        </label>
        <label className="check">
          <input type="checkbox" checked={activa} onChange={(e) => setActiva(e.target.checked)} />
          Activa
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button type="submit" className="btn btn--primario btn--bloque">Guardar</button>
        {tarea && (
          <button type="button" className="btn btn--bloque btn--peligro" onClick={borrarTarea}>
            <Trash2 size={18} strokeWidth={1.8} /> Borrar tarea
          </button>
        )}
      </form>
    </Hoja>
  )
}
