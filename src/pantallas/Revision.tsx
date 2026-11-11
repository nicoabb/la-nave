import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Check, ChevronLeft, TriangleAlert } from 'lucide-react'
import { useAviso } from '../components/Aviso'
import { Campo } from '../components/Campo'
import { db, type TareaMantenimiento, type TipoRevision } from '../db/esquema'
import { useKilometraje, useVehiculoActivo } from '../db/hooks'
import { crear } from '../db/repo'
import { CHECKLIST_SEMANAL } from '../lib/catalogos'
import { hoyISO } from '../lib/fechas'
import { leerEntero, numero } from '../lib/formato'

const TIPO_POR_CLAVE: Record<string, TipoRevision> = {
  revision_semanal: 'semanal_capo',
  bateria: 'bateria',
  presion_cauchos: 'presion_cauchos',
}

/** Registrar una revisión. `ref` es el id de la tarea o su clave (p. ej. "revision_semanal"). */
export default function Revision() {
  const { ref } = useParams()
  const vehiculo = useVehiculoActivo()
  const kmTotal = useKilometraje(vehiculo.id)
  const tarea = useLiveQuery(
    async () =>
      (await db.maintenance_tasks.where('vehicle_id').equals(vehiculo.id).toArray()).find(
        (t) => !t.deleted && (t.id === ref || t.clave === ref),
      ) ?? null,
    [ref, vehiculo.id],
  )

  if (tarea === undefined || kmTotal === undefined) return <main className="pantalla" />
  if (!tarea) {
    return (
      <main className="pantalla">
        <p className="muted">No se encontró esa tarea.</p>
        <Link to="/" className="enlace">Volver a Inicio</Link>
      </main>
    )
  }
  return <FormRevision key={tarea.id} vehiculoId={vehiculo.id} tarea={tarea} kmTotal={kmTotal} />
}

function FormRevision({ vehiculoId, tarea, kmTotal }: { vehiculoId: string; tarea: TareaMantenimiento; kmTotal: number | null }) {
  const navegar = useNavigate()
  const avisar = useAviso()
  const tipo: TipoRevision = (tarea.clave && TIPO_POR_CLAVE[tarea.clave]) || 'otra'

  const [fecha, setFecha] = useState(hoyISO())
  const [km, setKm] = useState(kmTotal ? numero(Math.round(kmTotal)) : '')
  const [nota, setNota] = useState('')
  const [checklist, setChecklist] = useState<Record<string, 'ok' | 'revisar'>>(() =>
    Object.fromEntries(CHECKLIST_SEMANAL.map((i) => [i, 'ok' as const])),
  )
  const [capacidad, setCapacidad] = useState('')
  const [alternador, setAlternador] = useState('')

  const porRevisar = Object.entries(checklist).filter(([, v]) => v === 'revisar').map(([k]) => k)

  async function guardar(e: FormEvent) {
    e.preventDefault()
    const mediciones = tipo === 'bateria' ? Object.fromEntries(Object.entries({ capacidad, alternador }).filter(([, v]) => v.trim())) : null
    await crear(db.inspections, {
      vehicle_id: vehiculoId,
      fecha,
      km: km.trim() ? leerEntero(km) : null,
      tipo,
      checklist: tipo === 'semanal_capo' ? checklist : null,
      mediciones: mediciones && Object.keys(mediciones).length ? mediciones : null,
      task_id: tarea.id,
      nota: nota.trim(),
    })
    avisar(
      'Revisión guardada',
      porRevisar.length && tipo === 'semanal_capo' ? `Por revisar: ${porRevisar.join(', ')}.` : undefined,
      porRevisar.length && tipo === 'semanal_capo' ? 'info' : 'ok',
    )
    navegar(-1)
  }

  return (
    <main className="pantalla">
      <header className="encabezado" style={{ justifyContent: 'flex-start', alignItems: 'center' }}>
        <button className="btn" aria-label="Volver" style={{ padding: 0, width: 44 }} onClick={() => navegar(-1)}>
          <ChevronLeft size={22} strokeWidth={1.8} />
        </button>
        <h1 className="titulo" style={{ fontSize: 24 }}>{tarea.nombre}</h1>
      </header>

      <form className="form" onSubmit={guardar} noValidate>
        {tipo === 'semanal_capo' && (
          <section className="tarjeta" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="muted mini" style={{ marginBottom: 6 }}>Todo viene marcado "Bien". Toca lo que haya que revisar.</span>
            {CHECKLIST_SEMANAL.map((item) => {
              const mal = checklist[item] === 'revisar'
              return (
                <button
                  type="button"
                  key={item}
                  className="lista__fila"
                  aria-pressed={mal}
                  onClick={() => setChecklist((c) => ({ ...c, [item]: mal ? 'ok' : 'revisar' }))}
                >
                  <span style={{ flex: 1 }}>{item}</span>
                  <span className={`chip ${mal ? 'chip--pronto' : 'chip--en-orden'}`}>
                    {mal ? <TriangleAlert size={13} strokeWidth={2} aria-hidden /> : <Check size={13} strokeWidth={2} aria-hidden />}
                    {mal ? 'Revisar' : 'Bien'}
                  </span>
                </button>
              )
            })}
          </section>
        )}

        <section className="tarjeta form">
          {tipo === 'bateria' && (
            <div className="fila-campos">
              <Campo etiqueta="Capacidad" ayuda="Lo que marque el probador">
                <input className="input" autoComplete="off" value={capacidad} onChange={(e) => setCapacidad(e.target.value)} />
              </Campo>
              <Campo etiqueta="Alternador" ayuda="Ej.: bien">
                <input className="input" autoComplete="off" value={alternador} onChange={(e) => setAlternador(e.target.value)} />
              </Campo>
            </div>
          )}
          <div className="fila-campos">
            <Campo etiqueta="Fecha">
              <input className="input" type="date" value={fecha} max={hoyISO()} onChange={(e) => setFecha(e.target.value)} />
            </Campo>
            <Campo etiqueta="Km del tablero">
              <input className="input" inputMode="numeric" autoComplete="off" value={km} onChange={(e) => setKm(e.target.value)} />
            </Campo>
          </div>
          <Campo etiqueta="Nota (opcional)">
            <textarea className="input" rows={2} style={{ paddingTop: 10 }} value={nota} onChange={(e) => setNota(e.target.value)} />
          </Campo>
          <button type="submit" className="btn btn--primario btn--bloque">Guardar revisión</button>
        </section>
      </form>
    </main>
  )
}
