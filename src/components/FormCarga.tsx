import { useEffect, useState, type FormEvent } from 'react'
import { Check, Plus } from 'lucide-react'
import { db, type CargaGasolina, type Moneda, type TasaOrigen } from '../db/esquema'
import { actualizar, crear, guardarMeta, leerMeta } from '../db/repo'
import { hoyISO } from '../lib/fechas'
import { aTexto, fechaLista, km as kmTexto, kmPorLitro, leerNumero, numero } from '../lib/formato'
import { ordenar } from '../lib/gasolina'
import { ayudaTasa } from '../lib/gastos'
import { kmActual } from '../lib/kilometraje'
import { useAviso } from './Aviso'
import { Campo, Segmentado } from './Campo'

interface Pendiente {
  km: number
  litros: number
  cargas: number
}

const OPCIONES_FULL = [
  { valor: 'si', texto: 'Sí' },
  { valor: 'no', texto: 'No' },
  { valor: 'nose', texto: 'No sé' },
] as const

const MONEDAS = [
  { valor: 'USD', texto: 'USD' },
  { valor: 'VES', texto: 'Bs' },
] as const

export function FormCarga({
  vehiculoId,
  carga,
  pendiente,
  autoFocus,
  onGuardado,
}: {
  vehiculoId: string
  carga?: CargaGasolina
  pendiente?: Pendiente
  autoFocus?: boolean
  onGuardado?: () => void
}) {
  const [km, setKm] = useState(aTexto(carga?.km_recorridos))
  const [litros, setLitros] = useState(aTexto(carga?.litros))
  const [fecha, setFecha] = useState(carga?.fecha ?? hoyISO())
  // 'si' = full · 'no' = no fue full · 'nose' = desconocido (cargas importadas)
  const [full, setFull] = useState<'si' | 'no' | 'nose'>(carga ? (carga.full === null ? 'nose' : carga.full ? 'si' : 'no') : 'si')
  const noFull = full !== 'si'
  const [conMonto, setConMonto] = useState(carga?.monto != null)
  const [monto, setMonto] = useState(aTexto(carga?.monto))
  const [moneda, setMoneda] = useState<Moneda>(carga?.moneda ?? 'USD')
  const [tasa, setTasa] = useState(aTexto(carga?.tasa_ves_usd))
  const [error, setError] = useState('')
  const [guardado, setGuardado] = useState(false)
  const avisar = useAviso()

  // La tasa se prellena con la última usada (SPEC §5.5)
  useEffect(() => {
    if (carga) return
    leerMeta<number>('ultima_tasa').then((t) => t && setTasa((prev) => prev || aTexto(t)))
  }, [carga])

  const kmN = leerNumero(km)
  const litrosN = leerNumero(litros)
  // Las cargas no full anteriores se suman a esta (solo al registrar una nueva)
  const pend = !carga && pendiente && pendiente.cargas > 0 ? pendiente : null

  let vivo = '—'
  if (noFull || (carga && !km.trim())) vivo = 'No se calcula'
  else if (kmN && litrosN) vivo = kmPorLitro((kmN + (pend?.km ?? 0)) / (litrosN + (pend?.litros ?? 0)))

  /** Confirma la carga y dice cómo quedó el kilometraje (o por qué no sumó). */
  async function avisarCargaNueva(fechaCarga: string, rendimientoTexto: string | null) {
    const [correcciones, cargas] = await Promise.all([
      db.odometer_corrections.where('vehicle_id').equals(vehiculoId).toArray(),
      db.fuel_logs.where('vehicle_id').equals(vehiculoId).toArray(),
    ])
    const vivas = correcciones.filter((c) => !c.deleted)
    const base = ordenar(vivas).at(-1)
    const total = kmActual(vivas, cargas.filter((c) => !c.deleted))
    const partes = [rendimientoTexto, total != null ? `Kilometraje: ${kmTexto(total)}` : null].filter(Boolean)

    if (base && fechaCarga < base.fecha) {
      avisar(
        'Carga guardada',
        `No suma al kilometraje porque es anterior a tu última lectura del tablero (${fechaLista(base.fecha)}).`,
        'info',
      )
    } else {
      avisar('Carga guardada', partes.join(' · '))
    }
  }

  async function guardar(e: FormEvent) {
    e.preventDefault()
    setError('')
    // Al editar una carga importada sin km se permite dejarlos vacíos
    const sinKm = Boolean(carga) && !km.trim()
    if (!sinKm && (!kmN || kmN <= 0)) return setError('Escribe los km recorridos.')
    if (!litrosN || litrosN <= 0) return setError('Escribe los litros.')
    if (!fecha) return setError('Escribe la fecha.')

    let pago = { monto: null as number | null, moneda: null as Moneda | null, tasa_ves_usd: null as number | null, tasa_origen: null as TasaOrigen | null, monto_usd: null as number | null }
    if (conMonto && monto.trim()) {
      const m = leerNumero(monto)
      const t = leerNumero(tasa)
      if (!m || m <= 0) return setError('El monto no es válido.')
      if (moneda === 'VES' && (!t || t <= 0)) return setError('Si pagaste en Bs, escribe la tasa.')
      const tasaOk = t && t > 0 ? t : null
      // Si la tasa no se tocó, conserva su origen (Wallet / estimada); si se escribió, es manual
      const tasa_origen = !tasaOk ? null : carga && tasa === aTexto(carga.tasa_ves_usd) ? carga.tasa_origen : 'manual'
      pago = { monto: m, moneda, tasa_ves_usd: tasaOk, tasa_origen, monto_usd: moneda === 'VES' ? m / tasaOk! : m }
      if (tasaOk) await guardarMeta('ultima_tasa', tasaOk)
    }

    const datos = { fecha, km_recorridos: sinKm ? null : kmN, litros: litrosN!, full: full === 'nose' ? null : full === 'si', ...pago }
    if (carga) {
      await actualizar(db.fuel_logs, carga.id, datos)
      avisar('Cambios guardados')
    } else {
      const delVehiculo = (await db.fuel_logs.where('vehicle_id').equals(vehiculoId).toArray()).filter((c) => !c.deleted)
      const repetida = delVehiculo.some((c) => c.fecha === fecha && c.km_recorridos === kmN && c.litros === litrosN)
      if (repetida && !window.confirm('Ya hay una carga igual registrada ese día. ¿Guardarla de todas formas?')) return

      const nueva = await crear(db.fuel_logs, { vehicle_id: vehiculoId, ...datos, nota: '', origen: 'manual' })
      await avisarCargaNueva(nueva.fecha, noFull ? null : vivo)
      setKm('')
      setLitros('')
      setFecha(hoyISO())
      setFull('si')
      setMonto('')
      setConMonto(false)
      ;(document.activeElement as HTMLElement | null)?.blur()
      setGuardado(true)
      setTimeout(() => setGuardado(false), 2500)
    }
    onGuardado?.()
  }

  return (
    <form className="form" onSubmit={guardar} noValidate>
      <div className="fila-campos">
        <Campo etiqueta="Km recorridos" ayuda={carga && carga.km_recorridos == null ? 'Sin km: no cuenta para el rendimiento' : 'Desde el último full (trip)'}>
          <input className="input" inputMode="decimal" autoComplete="off" enterKeyHint="next" placeholder="0" autoFocus={autoFocus} value={km} onChange={(e) => setKm(e.target.value)} />
        </Campo>
        <Campo etiqueta="Litros">
          <input className="input" inputMode="decimal" autoComplete="off" enterKeyHint="done" placeholder="0" value={litros} onChange={(e) => setLitros(e.target.value)} />
        </Campo>
      </div>

      <Campo etiqueta="Fecha">
        <input className="input" type="date" value={fecha} max={hoyISO()} onChange={(e) => setFecha(e.target.value)} />
      </Campo>

      {conMonto ? (
        <>
          <div className="fila-campos">
            <Campo etiqueta="Pagado (opcional)">
              <input className="input" inputMode="decimal" autoComplete="off" placeholder="0" value={monto} onChange={(e) => setMonto(e.target.value)} />
            </Campo>
            <Campo etiqueta="Moneda">
              <Segmentado etiqueta="Moneda" opciones={MONEDAS} valor={moneda} onCambio={setMoneda} />
            </Campo>
          </div>
          <Campo etiqueta="Tasa (Bs por USD)" ayuda={ayudaTasa(moneda, carga?.tasa_origen, Boolean(carga) && tasa === aTexto(carga?.tasa_ves_usd))}>
            <input className="input" inputMode="decimal" autoComplete="off" placeholder="0" value={tasa} onChange={(e) => setTasa(e.target.value)} />
          </Campo>
        </>
      ) : (
        <button type="button" className="enlace" style={{ alignSelf: 'flex-start', minHeight: 32 }} onClick={() => setConMonto(true)}>
          <Plus size={14} strokeWidth={2} style={{ verticalAlign: -2 }} /> Agregar lo pagado (opcional)
        </button>
      )}

      {carga ? (
        <Campo etiqueta="¿Fue full?">
          <Segmentado etiqueta="¿Fue full?" opciones={OPCIONES_FULL} valor={full} onCambio={setFull} />
        </Campo>
      ) : (
        <label className="check">
          <input type="checkbox" checked={noFull} onChange={(e) => setFull(e.target.checked ? 'no' : 'si')} />
          No fue full
        </label>
      )}

      <div className="resultado">
        <span className="muted mini">
          Rendimiento de esta carga
          {noFull && <><br />Se suma a la próxima carga full</>}
          {!noFull && pend && (
            <><br />Incluye {pend.cargas === 1 ? '1 carga' : `${pend.cargas} cargas`} que no fue full ({numero(pend.litros, 0, 2)} L)</>
          )}
        </span>
        <strong className="cifra" style={{ fontSize: 22, color: 'var(--cielo)' }}>{vivo}</strong>
      </div>

      {error && <p className="error" role="alert">{error}</p>}

      <button type="submit" className="btn btn--primario btn--bloque">
        {guardado ? <><Check size={18} strokeWidth={2} /> Carga guardada</> : carga ? 'Guardar cambios' : 'Guardar carga'}
      </button>
    </form>
  )
}
