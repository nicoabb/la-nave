import { useEffect, useState, type FormEvent } from 'react'
import { Trash2 } from 'lucide-react'
import { db, type Gasto, type Moneda } from '../db/esquema'
import { actualizar, borrar, crear, guardarMeta, leerMeta } from '../db/repo'
import { hoyISO } from '../lib/fechas'
import { aTexto, leerNumero } from '../lib/formato'
import { aUsd } from '../lib/gastos'
import { useAviso } from './Aviso'
import { Campo, Segmentado } from './Campo'
import { Hoja } from './Hoja'

const CATEGORIAS = [
  { valor: 'compra_papeles', texto: 'Compra y papeles' },
  { valor: 'otro', texto: 'Otro' },
] as const

const MONEDAS = [
  { valor: 'USD', texto: 'USD' },
  { valor: 'VES', texto: 'Bs' },
] as const

/** Gastos que no son gasolina ni taller: compra, traspaso, seguro, etc. */
export function HojaGasto({ vehiculoId, gasto, onCerrar }: { vehiculoId: string; gasto?: Gasto; onCerrar: () => void }) {
  const avisar = useAviso()
  const [categoria, setCategoria] = useState<Gasto['categoria']>(gasto?.categoria ?? 'compra_papeles')
  const [descripcion, setDescripcion] = useState(gasto?.descripcion ?? '')
  const [fecha, setFecha] = useState(gasto?.fecha ?? hoyISO())
  const [monto, setMonto] = useState(aTexto(gasto?.monto))
  const [moneda, setMoneda] = useState<Moneda>(gasto?.moneda ?? 'USD')
  const [tasa, setTasa] = useState(aTexto(gasto?.tasa_ves_usd))
  const [error, setError] = useState('')

  useEffect(() => {
    if (gasto) return
    leerMeta<number>('ultima_tasa').then((t) => t && setTasa((prev) => prev || aTexto(t)))
  }, [gasto])

  async function guardar(e: FormEvent) {
    e.preventDefault()
    const m = leerNumero(monto)
    const t = tasa.trim() ? leerNumero(tasa) : null
    if (!descripcion.trim()) return setError('Escribe una descripción, por ejemplo "Traspaso".')
    if (!m || m <= 0) return setError('Escribe el monto.')
    if (moneda === 'VES' && (!t || t <= 0)) return setError('Si pagaste en Bs, escribe la tasa.')
    const tasaOk = t && t > 0 ? t : null
    if (tasaOk) await guardarMeta('ultima_tasa', tasaOk)

    const datos = {
      categoria,
      descripcion: descripcion.trim(),
      fecha,
      monto: m,
      moneda,
      tasa_ves_usd: tasaOk,
      monto_usd: aUsd(m, moneda, tasaOk),
    }
    if (gasto) await actualizar(db.expenses, gasto.id, datos)
    else await crear(db.expenses, { vehicle_id: vehiculoId, ...datos })
    avisar(gasto ? 'Gasto actualizado' : 'Gasto guardado')
    onCerrar()
  }

  async function borrarGasto() {
    if (!gasto || !window.confirm('¿Borrar este gasto?')) return
    await borrar(db.expenses, gasto.id)
    onCerrar()
  }

  return (
    <Hoja titulo={gasto ? 'Editar gasto' : 'Nuevo gasto'} onCerrar={onCerrar}>
      <form className="form" onSubmit={guardar} noValidate>
        <Campo etiqueta="Categoría" ayuda="La gasolina y el taller se suman solos desde sus pantallas.">
          <Segmentado etiqueta="Categoría" opciones={CATEGORIAS} valor={categoria} onCambio={setCategoria} />
        </Campo>
        <Campo etiqueta="Descripción">
          <input
            className="input"
            autoComplete="off"
            placeholder={categoria === 'compra_papeles' ? 'Ej.: Precio de compra, traspaso' : 'Ej.: Seguro, lavado, estacionamiento'}
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
          />
        </Campo>
        <Campo etiqueta="Fecha">
          <input className="input" type="date" value={fecha} max={hoyISO()} onChange={(e) => setFecha(e.target.value)} />
        </Campo>
        <div className="fila-campos">
          <Campo etiqueta="Monto">
            <input className="input" inputMode="decimal" autoComplete="off" value={monto} onChange={(e) => setMonto(e.target.value)} />
          </Campo>
          <Campo etiqueta="Moneda">
            <Segmentado etiqueta="Moneda" opciones={MONEDAS} valor={moneda} onCambio={setMoneda} />
          </Campo>
        </div>
        <Campo etiqueta="Tasa (Bs por USD)" ayuda={moneda === 'VES' ? 'Obligatoria si pagaste en Bs' : 'Opcional: sirve para ver el gasto en Bs'}>
          <input className="input" inputMode="decimal" autoComplete="off" value={tasa} onChange={(e) => setTasa(e.target.value)} />
        </Campo>
        {error && <p className="error" role="alert">{error}</p>}
        <button type="submit" className="btn btn--primario btn--bloque">Guardar</button>
        {gasto && (
          <button type="button" className="btn btn--bloque btn--peligro" onClick={borrarGasto}>
            <Trash2 size={18} strokeWidth={1.8} /> Borrar gasto
          </button>
        )}
      </form>
    </Hoja>
  )
}
