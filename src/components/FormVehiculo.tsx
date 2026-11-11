import { useState, type FormEvent } from 'react'
import { Check } from 'lucide-react'
import { db, type Transmision, type Vehiculo } from '../db/esquema'
import { actualizar, crear } from '../db/repo'
import { hoyISO } from '../lib/fechas'
import { leerEntero } from '../lib/formato'
import { Campo, Segmentado } from './Campo'

const TRANSMISIONES = [
  { valor: 'automático', texto: 'Automático' },
  { valor: 'sincrónico', texto: 'Sincrónico' },
] as const

/** Crea el vehículo (con su odómetro inicial) o edita sus datos. */
export function FormVehiculo({ vehiculo }: { vehiculo?: Vehiculo }) {
  const [marca, setMarca] = useState(vehiculo?.marca ?? '')
  const [modelo, setModelo] = useState(vehiculo?.modelo ?? '')
  const [anio, setAnio] = useState(vehiculo?.anio ? String(vehiculo.anio) : '')
  const [motor, setMotor] = useState(vehiculo?.motor ?? '')
  const [transmision, setTransmision] = useState<Transmision>(vehiculo?.transmision ?? 'automático')
  const [alias, setAlias] = useState(vehiculo?.alias ?? '')
  const [fechaCompra, setFechaCompra] = useState(vehiculo?.fecha_compra ?? '')
  const [odometro, setOdometro] = useState('')
  const [fechaOdometro, setFechaOdometro] = useState(hoyISO())
  const [error, setError] = useState('')
  const [guardado, setGuardado] = useState(false)

  async function guardar(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!marca.trim() || !modelo.trim()) return setError('Escribe al menos la marca y el modelo.')
    const anioN = anio.trim() ? leerEntero(anio) : null
    if (anio.trim() && (!anioN || anioN < 1900 || anioN > 2100)) return setError('El año no es válido.')

    const datos = {
      marca: marca.trim(),
      modelo: modelo.trim(),
      anio: anioN,
      motor: motor.trim(),
      transmision,
      alias: alias.trim(),
      fecha_compra: fechaCompra || null,
    }

    if (vehiculo) {
      await actualizar(db.vehicles, vehiculo.id, datos)
      setGuardado(true)
      setTimeout(() => setGuardado(false), 2500)
      return
    }

    const km = leerEntero(odometro)
    if (!km || km <= 0) return setError('Escribe el kilometraje que marca el tablero.')
    if (!fechaOdometro) return setError('Escribe la fecha de esa lectura.')
    await db.transaction('rw', db.vehicles, db.odometer_corrections, async () => {
      const v = await crear(db.vehicles, { ...datos, activo: true })
      await crear(db.odometer_corrections, { vehicle_id: v.id, fecha: fechaOdometro, km_total: km, nota: 'Odómetro inicial' })
    })
  }

  return (
    <form className="form" onSubmit={guardar} noValidate>
      <div className="fila-campos">
        <Campo etiqueta="Marca">
          <input className="input" autoComplete="off" value={marca} onChange={(e) => setMarca(e.target.value)} />
        </Campo>
        <Campo etiqueta="Modelo">
          <input className="input" autoComplete="off" value={modelo} onChange={(e) => setModelo(e.target.value)} />
        </Campo>
      </div>
      <div className="fila-campos">
        <Campo etiqueta="Año">
          <input className="input" inputMode="numeric" autoComplete="off" value={anio} onChange={(e) => setAnio(e.target.value)} />
        </Campo>
        <Campo etiqueta="Motor">
          <input className="input" autoComplete="off" placeholder="Ej.: 1.6" value={motor} onChange={(e) => setMotor(e.target.value)} />
        </Campo>
      </div>
      <Campo etiqueta="Transmisión">
        <Segmentado etiqueta="Transmisión" opciones={TRANSMISIONES} valor={transmision} onCambio={setTransmision} />
      </Campo>
      <Campo etiqueta="Apodo (opcional)">
        <input className="input" autoComplete="off" value={alias} onChange={(e) => setAlias(e.target.value)} />
      </Campo>
      <Campo etiqueta="Fecha de compra (opcional)">
        <input className="input" type="date" value={fechaCompra} max={hoyISO()} onChange={(e) => setFechaCompra(e.target.value)} />
      </Campo>

      {!vehiculo && (
        <div className="fila-campos">
          <Campo etiqueta="Km del tablero" ayuda="El odómetro total">
            <input className="input" inputMode="numeric" autoComplete="off" value={odometro} onChange={(e) => setOdometro(e.target.value)} />
          </Campo>
          <Campo etiqueta="Leído el">
            <input className="input" type="date" value={fechaOdometro} max={hoyISO()} onChange={(e) => setFechaOdometro(e.target.value)} />
          </Campo>
        </div>
      )}

      {error && <p className="error" role="alert">{error}</p>}
      <button type="submit" className="btn btn--primario btn--bloque">
        {guardado ? <><Check size={18} strokeWidth={2} /> Guardado</> : vehiculo ? 'Guardar cambios' : 'Guardar y empezar'}
      </button>
    </form>
  )
}
