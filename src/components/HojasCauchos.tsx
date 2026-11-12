import { useEffect, useState, type FormEvent } from 'react'
import { Trash2 } from 'lucide-react'
import { db, type Caucho, type EventoCaucho, type Moneda, type Posicion, type TipoEventoCaucho } from '../db/esquema'
import { actualizar, borrar, crear, guardarMeta, leerMeta } from '../db/repo'
import { edadAnios, POSICIONES, rotacionValida, textoEdad, textoPosicion } from '../lib/cauchos'
import { hoyISO } from '../lib/fechas'
import { aTexto, leerEntero, leerNumero, numero } from '../lib/formato'
import { aUsd, ayudaTasa } from '../lib/gastos'
import { useAviso } from './Aviso'
import { Campo, Segmentado } from './Campo'
import { Hoja } from './Hoja'

type Nuevo<T> = Omit<T, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'deleted'>

type Pago = Pick<EventoCaucho, 'monto' | 'moneda' | 'tasa_ves_usd' | 'tasa_origen' | 'monto_usd'>
const SIN_PAGO: Pago = { monto: null, moneda: null, tasa_ves_usd: null, tasa_origen: null, monto_usd: null }

async function registrarEvento(datos: Omit<Nuevo<EventoCaucho>, 'visit_id' | keyof Pago>, pago: Pago = SIN_PAGO) {
  await crear(db.tire_events, { ...datos, ...pago, visit_id: null })
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
    let anio = dotAnio.trim() ? leerEntero(dotAnio) : null
    if (anio !== null && anio < 100) anio += 2000 // "25" → 2025
    if (semana !== null && (semana < 1 || semana > 53)) return setError('La semana va de 1 a 53.')
    if (anio !== null && (anio < 1990 || anio > new Date().getFullYear() + 1))
      return setError('Escribe el año completo, por ejemplo 2025.')

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
            <input className="input" autoComplete="off" placeholder="Ej.: 195/60 R15" value={medida} onChange={(e) => setMedida(e.target.value)} />
          </Campo>
        </div>
        <div className="fila-campos">
          <Campo etiqueta="Semana de fabricación" ayuda="Ej.: 08">
            <input className="input" inputMode="numeric" autoComplete="off" placeholder="1 a 53" value={dotSemana} onChange={(e) => setDotSemana(e.target.value)} />
          </Campo>
          <Campo etiqueta="Año de fabricación" ayuda="Ej.: 2023">
            <input className="input" inputMode="numeric" autoComplete="off" placeholder="aaaa" value={dotAnio} onChange={(e) => setDotAnio(e.target.value)} />
          </Campo>
        </div>
        <span className="muted mini" style={{ marginTop: -6 }}>
          Están en el costado del caucho, al final del código DOT: 4 números donde los 2 primeros son la semana y los 2
          últimos el año. Por ejemplo, <strong>0823</strong> es la semana 8 de 2023.
        </span>
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
  balanceo: 'Balanceo y rotación',
  alineacion: 'Alineación',
  presion: 'Presión de aire',
}

const MONEDAS = [
  { valor: 'USD', texto: 'USD' },
  { valor: 'VES', texto: 'Bs' },
] as const

const EJES = [
  { valor: 'delantera', texto: 'Delantera' },
  { valor: 'trasera', texto: 'Trasera' },
  { valor: 'ambas', texto: 'Ambas' },
] as const

/** Registrar un servicio de cauchos: balanceo y rotación (juntos), alineación o presión. */
export function HojaServicio({
  vehiculoId,
  tipo,
  kmTotal,
  montados,
  onCerrar,
}: {
  vehiculoId: string
  tipo: 'balanceo' | 'alineacion' | 'presion'
  kmTotal: number | null
  montados: Caucho[]
  onCerrar: () => void
}) {
  const avisar = useAviso()
  const [fecha, setFecha] = useState(hoyISO())
  const [km, setKm] = useState(kmTotal ? numero(Math.round(kmTotal)) : '')
  const [eje, setEje] = useState<(typeof EJES)[number]['valor']>('ambas')
  const [conPago, setConPago] = useState(false)
  const [monto, setMonto] = useState('')
  const [moneda, setMoneda] = useState<Moneda>('VES')
  const [tasa, setTasa] = useState('')

  useEffect(() => {
    leerMeta<number>('ultima_tasa').then((t) => t && setTasa((prev) => prev || aTexto(t)))
  }, [])
  const original = arregloDe(montados)
  const [arreglo, setArreglo] = useState<Arreglo>(original)
  const [error, setError] = useState('')

  // Dónde quedó cada caucho según el arreglo final
  const mapa: Record<string, Posicion> = {}
  for (const p of ORDEN) if (arreglo[p]) mapa[arreglo[p]!] = p

  async function guardar(e: FormEvent) {
    e.preventDefault()
    if (tipo === 'balanceo' && !rotacionValida(mapa)) return setError('Hay dos cauchos en la misma posición.')
    const movidos = montados.filter((c) => mapa[c.id] !== c.posicion)
    const kmN = km.trim() ? leerEntero(km) : null
    let pago = SIN_PAGO
    if (conPago && monto.trim()) {
      const m = leerNumero(monto)
      const t = tasa.trim() ? leerNumero(tasa) : null
      if (!m || m <= 0) return setError('El monto no es válido.')
      if (moneda === 'VES' && (!t || t <= 0)) return setError('Si pagaste en Bs, escribe la tasa.')
      const tasaOk = t && t > 0 ? t : null
      if (tasaOk) await guardarMeta('ultima_tasa', tasaOk)
      pago = { monto: m, moneda, tasa_ves_usd: tasaOk, tasa_origen: tasaOk ? 'manual' : null, monto_usd: aUsd(m, moneda, tasaOk) }
    }
    await db.transaction('rw', db.tires, db.tire_events, async () => {
      await registrarEvento({ vehicle_id: vehiculoId, fecha, km: kmN, tipo, detalle: tipo === 'alineacion' ? { eje } : null }, pago)
      // Balanceo y rotación van juntos: si se cambiaron de lugar, se mueven y queda el evento de rotación
      if (tipo === 'balanceo' && movidos.length) {
        const detalle: Record<string, string> = {}
        for (const c of movidos) {
          detalle[c.id] = mapa[c.id]
          await actualizar(db.tires, c.id, { posicion: mapa[c.id] })
        }
        await registrarEvento({ vehicle_id: vehiculoId, fecha, km: kmN, tipo: 'rotacion', detalle })
      }
    })
    avisar(
      tipo === 'balanceo' ? 'Balanceo y rotación registrados' : `${TITULOS[tipo]} registrada`,
      tipo === 'balanceo' && !movidos.length ? 'Sin cambios de posición en el dibujo.' : undefined,
    )
    onCerrar()
  }

  return (
    <Hoja titulo={TITULOS[tipo]!} onCerrar={onCerrar}>
      <form className="form" onSubmit={guardar} noValidate>
        {tipo === 'balanceo' && montados.length > 0 && (
          <SelectorRotacion montados={montados} original={original} arreglo={arreglo} onCambio={setArreglo} />
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
        {conPago ? (
          <>
            <div className="fila-campos">
              <Campo etiqueta="Pagado">
                <input className="input" inputMode="decimal" autoComplete="off" value={monto} onChange={(e) => setMonto(e.target.value)} />
              </Campo>
              <Campo etiqueta="Moneda">
                <Segmentado etiqueta="Moneda" opciones={MONEDAS} valor={moneda} onCambio={setMoneda} />
              </Campo>
            </div>
            <Campo etiqueta="Tasa (Bs por USD)" ayuda={ayudaTasa(moneda, null, false)}>
              <input className="input" inputMode="decimal" autoComplete="off" value={tasa} onChange={(e) => setTasa(e.target.value)} />
            </Campo>
          </>
        ) : (
          <button type="button" className="enlace" style={{ alignSelf: 'flex-start', minHeight: 32 }} onClick={() => setConPago(true)}>
            + Agregar lo pagado (opcional)
          </button>
        )}
        {error && <p className="error" role="alert">{error}</p>}
        <button type="submit" className="btn btn--primario btn--bloque">Guardar</button>
        <span className="muted mini">Lo pagado suma a Gastos en el sistema Cauchos. Si fue un trabajo con varios ítems, regístralo como visita.</span>
      </form>
    </Hoja>
  )
}

// ---------- Rotación: patrón + tocar para intercambiar ----------

type Arreglo = Record<Posicion, string | null>
const ORDEN: Posicion[] = ['DI', 'DD', 'TI', 'TD', 'REP']

function arregloDe(montados: Caucho[]): Arreglo {
  const a: Arreglo = { DI: null, DD: null, TI: null, TD: null, REP: null }
  for (const c of montados) a[c.posicion] = c.id
  return a
}

type Movimiento = Partial<Record<Posicion, Posicion>>

const PATRONES: { clave: string; texto: string; ayuda: string; mov: Movimiento; flechas: [number, number, number, number][] }[] = [
  {
    clave: 'adelante_atras',
    texto: 'Adelante ↔ atrás',
    ayuda: 'Cada lado por su cuenta',
    mov: { DI: 'TI', TI: 'DI', DD: 'TD', TD: 'DD' },
    flechas: [[12, 14, 12, 46], [12, 46, 12, 14], [36, 14, 36, 46], [36, 46, 36, 14]],
  },
  {
    clave: 'cruz',
    texto: 'En cruz',
    ayuda: 'Los de atrás cruzan',
    mov: { DI: 'TI', DD: 'TD', TI: 'DD', TD: 'DI' },
    flechas: [[12, 14, 12, 46], [36, 14, 36, 46], [12, 46, 36, 14], [36, 46, 12, 14]],
  },
]

function aplicar(original: Arreglo, mov: Movimiento): Arreglo {
  const r: Arreglo = { DI: null, DD: null, TI: null, TD: null, REP: null }
  for (const p of ORDEN) if (original[p]) r[mov[p] ?? p] = original[p]
  return r
}

const mismoArreglo = (a: Arreglo, b: Arreglo) => ORDEN.every((p) => a[p] === b[p])

function SelectorRotacion({
  montados,
  original,
  arreglo,
  onCambio,
}: {
  montados: Caucho[]
  original: Arreglo
  arreglo: Arreglo
  onCambio: (a: Arreglo) => void
}) {
  const [seleccion, setSeleccion] = useState<Posicion | null>(null)
  const porId = new Map(montados.map((c) => [c.id, c]))
  const hoy = hoyISO()
  const patronActivo = PATRONES.find((p) => mismoArreglo(aplicar(original, p.mov), arreglo))?.clave ?? null
  const cambiado = !mismoArreglo(original, arreglo)

  function tocar(p: Posicion) {
    if (seleccion === null) return setSeleccion(p)
    if (seleccion !== p) onCambio({ ...arreglo, [seleccion]: arreglo[p], [p]: arreglo[seleccion] })
    setSeleccion(null)
  }

  const etiqueta = (id: string | null) => {
    const c = id ? porId.get(id) : null
    if (!c) return 'Vacío'
    const edad = edadAnios(c.dot_anio, c.dot_semana, hoy)
    return c.dot_anio && edad !== null ? `${c.dot_anio} · ${textoEdad(edad)}` : c.marca || 'Sin DOT'
  }

  const Caja = ({ p, alinear }: { p: Posicion; alinear: 'left' | 'right' }) => {
    const movido = arreglo[p] !== original[p]
    return (
      <button
        type="button"
        className={`rotar__caucho${seleccion === p ? ' rotar__caucho--sel' : ''}`}
        style={{ textAlign: alinear }}
        aria-pressed={seleccion === p}
        onClick={() => tocar(p)}
      >
        <span className="muted mini">{textoPosicion(p)}</span>
        <strong style={{ fontWeight: 600, color: movido ? 'var(--lavanda)' : undefined }}>{etiqueta(arreglo[p])}</strong>
      </button>
    )
  }

  const cambios = montados
    .map((c) => {
      const nueva = ORDEN.find((p) => arreglo[p] === c.id)!
      return nueva !== c.posicion ? `${etiqueta(c.id)}: ${textoPosicion(c.posicion)} → ${textoPosicion(nueva)}` : null
    })
    .filter(Boolean)

  return (
    <>
      <span className="campo__etiqueta">¿Cómo los rotaron? <span className="muted" style={{ fontWeight: 400 }}>(si no cambiaron de lugar, déjalo así)</span></span>
      <div className="fila-campos">
        {PATRONES.map((pt) => (
          <button
            key={pt.clave}
            type="button"
            className={`patron${patronActivo === pt.clave ? ' patron--activo' : ''}`}
            aria-pressed={patronActivo === pt.clave}
            onClick={() => {
              setSeleccion(null)
              onCambio(aplicar(original, pt.mov))
            }}
          >
            <svg viewBox="0 0 48 60" width="40" height="50" aria-hidden>
              <defs>
                <marker id={`punta-${pt.clave}`} viewBox="0 0 6 6" refX="5" refY="3" markerWidth="5" markerHeight="5" orient="auto">
                  <path d="M0 0 L6 3 L0 6 Z" style={{ fill: 'currentColor' }} />
                </marker>
              </defs>
              {[[12, 10], [36, 10], [12, 50], [36, 50]].map(([x, y]) => (
                <rect key={`${x}${y}`} x={x - 4} y={y - 7} width="8" height="14" rx="2" style={{ fill: 'currentColor', opacity: 0.35 }} />
              ))}
              {pt.flechas.map(([x1, y1, x2, y2], i) => (
                <line
                  key={i}
                  x1={x1 + (i % 2 && pt.clave === 'adelante_atras' ? 3 : 0)}
                  y1={y1}
                  x2={x2 + (i % 2 && pt.clave === 'adelante_atras' ? 3 : 0)}
                  y2={y2}
                  markerEnd={`url(#punta-${pt.clave})`}
                  style={{ stroke: 'currentColor', strokeWidth: 1.6 }}
                />
              ))}
            </svg>
            <span style={{ fontWeight: 600 }}>{pt.texto}</span>
            <span className="mini" style={{ opacity: 0.8 }}>{pt.ayuda}</span>
          </button>
        ))}
      </div>

      <span className="muted mini">
        {seleccion
          ? `Ahora toca el caucho con el que intercambiaste el de ${textoPosicion(seleccion).toLowerCase()}.`
          : '¿Fue distinto? Toca un caucho y luego otro para intercambiarlos.'}
      </span>

      <div className="rotar">
        <span className="muted mini rotar__frente">Frente</span>
        <Caja p="DI" alinear="right" />
        <div className="rotar__carro" aria-hidden />
        <Caja p="DD" alinear="left" />
        <Caja p="TI" alinear="right" />
        <Caja p="TD" alinear="left" />
      </div>
      <Caja p="REP" alinear="left" />

      {cambiado && (
        <div className="resultado" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
          <span className="mini" style={{ fontWeight: 600 }}>Así quedan:</span>
          {cambios.map((t) => <span key={t} className="mini">{t}</span>)}
          <button type="button" className="enlace mini" style={{ marginTop: 4 }} onClick={() => { setSeleccion(null); onCambio(original) }}>
            Deshacer
          </button>
        </div>
      )}
    </>
  )
}

/** "Listo" de la presión: un toque, sin formulario. */
export async function registrarPresion(vehiculoId: string, kmTotal: number | null) {
  await registrarEvento({ vehicle_id: vehiculoId, fecha: hoyISO(), km: kmTotal != null ? Math.round(kmTotal) : null, tipo: 'presion', detalle: null })
}
