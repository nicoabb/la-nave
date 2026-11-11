import { useState, type FormEvent } from 'react'
import { db } from '../db/esquema'
import { crear } from '../db/repo'
import { hoyISO } from '../lib/fechas'
import { km, leerEntero, numero } from '../lib/formato'
import { Campo } from './Campo'
import { Hoja } from './Hoja'

/** Registra una corrección de odómetro, que pasa a ser la nueva base (SPEC §5.2). */
export function HojaCorreccion({
  vehiculoId,
  kmEstimado,
  onCerrar,
}: {
  vehiculoId: string
  kmEstimado: number | null | undefined
  onCerrar: () => void
}) {
  const [total, setTotal] = useState(kmEstimado ? numero(kmEstimado) : '')
  const [fecha, setFecha] = useState(hoyISO())
  const [nota, setNota] = useState('')
  const [error, setError] = useState('')

  async function guardar(e: FormEvent) {
    e.preventDefault()
    const n = leerEntero(total)
    if (!n || n <= 0) return setError('Escribe el kilometraje que marca el tablero.')
    if (!fecha) return setError('Escribe la fecha.')
    await crear(db.odometer_corrections, { vehicle_id: vehiculoId, fecha, km_total: n, nota: nota.trim() })
    onCerrar()
  }

  return (
    <Hoja titulo="Corregir kilometraje" onCerrar={onCerrar}>
      <form className="form" onSubmit={guardar} noValidate>
        <Campo
          etiqueta="Kilometraje del tablero"
          ayuda={kmEstimado ? `Según tus cargas, debería marcar unos ${km(kmEstimado)}.` : undefined}
        >
          <input className="input" inputMode="numeric" autoComplete="off" autoFocus value={total} onChange={(e) => setTotal(e.target.value)} />
        </Campo>
        <Campo etiqueta="Fecha">
          <input className="input" type="date" value={fecha} max={hoyISO()} onChange={(e) => setFecha(e.target.value)} />
        </Campo>
        <Campo etiqueta="Nota (opcional)">
          <input className="input" autoComplete="off" placeholder="Ej.: leído en el taller" value={nota} onChange={(e) => setNota(e.target.value)} />
        </Campo>
        {error && <p className="error" role="alert">{error}</p>}
        <button type="submit" className="btn btn--primario btn--bloque">Guardar</button>
        <button type="button" className="btn btn--bloque" onClick={onCerrar}>Cancelar</button>
      </form>
    </Hoja>
  )
}
