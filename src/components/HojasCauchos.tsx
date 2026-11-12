import { useState, type FormEvent } from 'react'
import { Trash2 } from 'lucide-react'
import { db, type Caucho, type EventoCaucho, type Posicion, type TipoEventoCaucho } from '../db/esquema'
import { actualizar, borrar, crear } from '../db/repo'
import { POSICIONES, rotacionValida, textoPosicion } from '../lib/cauchos'
import { hoyISO } from '../lib/fechas'
import { leerEntero, numero } from '../lib/formato'
import { useAviso } from './Aviso'
import { Campo, Segmentado } from './Campo'
import { Hoja } from './Hoja'

type Nuevo<T> = Omit<T, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'deleted'>

async function registrarEvento(datos: Omit<Nuevo<EventoCaucho>, 'visit_id'>) {
  await crear(db.tire_events, { ...datos, visit_id: null })
}

/** Agregar, editar o retirar un caucho. */
export function HojaCaucho({
  vehiculoId,
  caucho,
  posicionInicial,
  kmTotal,
  ocupadas,
  onCerrar,
}: {
  vehiculoId: string
  caucho?: Caucho
  posicionInicial: Posicion
  kmTotal: number | null
  ocupadas: Map<Posicion, Caucho>
  onCerrar: () => void
}) {
  const avisar = useAviso()
  const [marca, setMarca] = useState(caucho?.marca ?? '')
  const [medida, setMedida] = useState(caucho?.medida ?? '')
  const [dotSemana, setDotSemana] = useState(caucho?.dot_semana ? String(caucho.dot_semana) : '')
  const [dotAnio, setDotAnio] = useState(caucho?.dot_anio ? String(caucho.dot_anio) : '')
  const [fechaMontaje, setFechaMontaje] = useState(caucho?.fecha_montaje ?? (caucho ? '' : hoyISO()))
  const [kmMontaje, setKmMontaje] = useState(
    caucho ? (caucho.km_montaje != null ? numero(caucho.km_montaje) : '') : kmTotal ? numero(Math.round(kmTotal)) : '',
  )
  const [posicion, setPosicion] = useState<Posicion>(caucho?.posicion ?? posicionInicial)
  const [nota, setNota] = useState(caucho?.nota ?? '')
  const [error, setError] = useState('')

  async function guardar(e: FormEvent) {
    e.preventDefault()
    const semana = dotSemana.trim() ? leerEntero(dotSemana) : null
    const anio = dotAnio.trim() ? leerEntero(dotAnio) : null
    if (semana !== null && (semana < 1 || semana > 53)) return setError('La semana del DOT va de 1 a 53.')
    if (anio !== null && (anio < 1990 || anio > 2100)) return setError('El año del DOT no es válido.')

    const otro = ocupadas.get(posicion)
    if (otro && otro.id !== caucho?.id) {
      if (!window.confirm(`Ya hay un caucho en ${textoPosicion(posicion).toLowerCase()}. ¿Retirarlo y poner este?`)) return
    }

    const datos = {
      marca: marca.trim(),
      medida: medida.trim(),
      dot_semana: semana,
      dot_anio: anio,
      fecha_montaje: fechaMontaje || null,
      km_montaje: kmMontaje.trim() ? leerEntero(kmMontaje) : null,
      posicion,
      nota: nota.trim(),
    }

    await db.transaction('rw', db.tires, db.tire_events, async () => {
      if (otro && otro.id !== caucho?.id) {
        await actualizar(db.tires, otro.id, { estado: 'retirado' })
        await registrarEvento({ vehicle_id: vehiculoId, fecha: datos.fecha_montaje ?? hoyISO(), km: datos.km_montaje, tipo: 'retiro', detalle: { tire_id: otro.id } })
      }
      if (caucho) {
        await actualizar(db.tires, caucho.id, datos)
      } else {
        const nuevo = await crear(db.tires, { vehicle_id: vehiculoId, ...datos, estado: 'montado' })
        await registrarEvento({ vehicle_id: vehiculoId, fecha: datos.fecha_montaje ?? hoyISO(), km: datos.km_montaje, tipo: 'montaje', detalle: { tire_id: nuevo.id, posicion } })
      }
    })
    avisar(caucho ? 'Caucho actualizado' : 'Caucho agregado')
    onCerrar()
  }

  async function retirar() {
    if (!caucho || !window.confirm('¿Retirar este caucho? Queda en el historial, pero deja de aparecer en el carro.')) return
    await db.transaction('rw', db.tires, db.tire_events, async () => {
      await actualizar(db.tires, caucho.id, { estado: 'retirado' })
      await registrarEvento({ vehicle_id: vehiculoId, fecha: hoyISO(), km: kmTotal != null ? Math.round(kmTotal) : null, tipo: 'retiro', detalle: { tire_id: caucho.id } })
    })
    avisar('Caucho retirado')
    onCerrar()
  }

  async function borrarCaucho() {
    if (!caucho || !window.confirm('¿Borrar este caucho? Úsalo solo si lo cargaste por error.')) return
    await borrar(db.tires, caucho.id)
    onCerrar()
  }

  return (
    <Hoja titulo={caucho ? 'Editar caucho' : 'Agregar caucho'} onCerrar={onCerrar}>
      <form className="form" onSubmit={guardar} noValidate>
        <Campo etiqueta="Posición">
          <select className="input" value={posicion} onChange={(e) => setPosicion(e.target.value as Posicion)}>
            {POSICIONES.map((p) => <option key={p.valor} value={p.valor}>{p.texto}</option>)}
          </select>
        </Campo>
        <div className="fila-campos">
          <Campo etiqueta="Marca y modelo">
            <input className="input" autoComplete="off" value={marca} onChange={(e) => setMarca(e.target.value)} />
          </Campo>
          <Campo etiqueta="Medida">
            <input className="input" autoComplete="off" placeholder="Ej.: 185/65 R14" value={medida} onChange={(e) => setMedida(e.target.value)} />
          </Campo>
        </div>
        <div className="fila-campos">
          <Campo etiqueta="DOT: semana" ayuda="Los 2 primeros dígitos">
            <input className="input" inputMode="numeric" autoComplete="off" value={dotSemana} onChange={(e) => setDotSemana(e.target.value)} />
          </Campo>
          <Campo etiqueta="DOT: año" ayuda="Ej.: 2324 → 2024">
            <input className="input" inputMode="numeric" autoComplete="off" value={dotAnio} onChange={(e) => setDotAnio(e.target.value)} />
          </Campo>
        </div>
        <div className="fila-campos">
          <Campo etiqueta="Montado el">
            <input className="input" type="date" value={fechaMontaje} max={hoyISO()} onChange={(e) => setFechaMontaje(e.target.value)} />
          </Campo>
          <Campo etiqueta="Km al montar">
            <input className="input" inputMode="numeric" autoComplete="off" value={kmMontaje} onChange={(e) => setKmMontaje(e.target.value)} />
          </Campo>
        </div>
        <Campo etiqueta="Nota (opcional)">
          <input className="input" autoComplete="off" value={nota} onChange={(e) => setNota(e.target.value)} />
        </Campo>
        {error && <p className="error" role="alert">{error}</p>}
        <button type="submit" className="btn btn--primario btn--bloque">Guardar</button>
        {caucho && (
          <>
            <button type="button" className="btn btn--bloque" onClick={retirar}>Retirar caucho</button>
            <button type="button" className="btn btn--bloque btn--peligro" onClick={borrarCaucho}>
              <Trash2 size={18} strokeWidth={1.8} /> Borrar (cargado por error)
            </button>
          </>
        )}
      </form>
    </Hoja>
  )
}

const TITULOS: Partial<Record<TipoEventoCaucho, string>> = {
  rotacion: 'Rotación',
  balanceo: 'Balanceo',
  alineacion: 'Alineación',
  presion: 'Presión de aire',
}

const EJES = [
  { valor: 'delantera', texto: 'Delantera' },
  { valor: 'trasera', texto: 'Trasera' },
  { valor: 'ambas', texto: 'Ambas' },
] as const

/** Registrar un servicio de cauchos (rotación, balanceo, alineación, presión). */
export function HojaServicio({
  vehiculoId,
  tipo,
  kmTotal,
  montados,
  onCerrar,
}: {
  vehiculoId: string
  tipo: 'rotacion' | 'balanceo' | 'alineacion' | 'presion'
  kmTotal: number | null
  montados: Caucho[]
  onCerrar: () => void
}) {
  const avisar = useAviso()
  const [fecha, setFecha] = useState(hoyISO())
  const [km, setKm] = useState(kmTotal ? numero(Math.round(kmTotal)) : '')
  const [eje, setEje] = useState<(typeof EJES)[number]['valor']>('ambas')
  const [mapa, setMapa] = useState<Record<string, Posicion>>(() => Object.fromEntries(montados.map((c) => [c.id, c.posicion])))
  const [error, setError] = useState('')

  async function guardar(e: FormEvent) {
    e.preventDefault()
    if (tipo === 'rotacion' && !rotacionValida(mapa)) return setError('Hay dos cauchos en la misma posición.')
    const kmN = km.trim() ? leerEntero(km) : null
    await db.transaction('rw', db.tires, db.tire_events, async () => {
      let detalle: Record<string, string> | null = null
      if (tipo === 'alineacion') detalle = { eje }
      if (tipo === 'rotacion') {
        detalle = {}
        for (const c of montados) {
          if (mapa[c.id] !== c.posicion) {
            detalle[c.id] = mapa[c.id]
            await actualizar(db.tires, c.id, { posicion: mapa[c.id] })
          }
        }
      }
      await registrarEvento({ vehicle_id: vehiculoId, fecha, km: kmN, tipo, detalle })
    })
    avisar(`${TITULOS[tipo]} registrada`)
    onCerrar()
  }

  return (
    <Hoja titulo={TITULOS[tipo]!} onCerrar={onCerrar}>
      <form className="form" onSubmit={guardar} noValidate>
        {tipo === 'rotacion' && montados.length > 0 && (
          <>
            <span className="muted mini">Indica dónde quedó cada caucho.</span>
            {montados.map((c) => (
              <Campo key={c.id} etiqueta={`Estaba en: ${textoPosicion(c.posicion)}${c.dot_anio ? ` (${c.dot_anio})` : ''}`}>
                <select className="input" value={mapa[c.id]} onChange={(e) => setMapa((m) => ({ ...m, [c.id]: e.target.value as Posicion }))}>
                  {POSICIONES.map((p) => <option key={p.valor} value={p.valor}>{p.texto}</option>)}
                </select>
              </Campo>
            ))}
          </>
        )}
        {tipo === 'alineacion' && (
          <Campo etiqueta="Alineación">
            <Segmentado etiqueta="Eje" opciones={EJES} valor={eje} onCambio={setEje} />
          </Campo>
        )}
        <div className="fila-campos">
          <Campo etiqueta="Fecha">
            <input className="input" type="date" value={fecha} max={hoyISO()} onChange={(e) => setFecha(e.target.value)} />
          </Campo>
          <Campo etiqueta="Km del tablero">
            <input className="input" inputMode="numeric" autoComplete="off" value={km} onChange={(e) => setKm(e.target.value)} />
          </Campo>
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        <button type="submit" className="btn btn--primario btn--bloque">Guardar</button>
        <span className="muted mini">Si lo hiciste en el taller y quieres guardar el costo, regístralo también como visita.</span>
      </form>
    </Hoja>
  )
}

/** "Listo" de la presión: un toque, sin formulario. */
export async function registrarPresion(vehiculoId: string, kmTotal: number | null) {
  await registrarEvento({ vehicle_id: vehiculoId, fecha: hoyISO(), km: kmTotal != null ? Math.round(kmTotal) : null, tipo: 'presion', detalle: null })
}
