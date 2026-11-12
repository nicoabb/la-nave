import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Trash2 } from 'lucide-react'
import { db, type Deseo, type Prioridad } from '../db/esquema'
import { actualizar, borrar, crear } from '../db/repo'
import { hoyISO } from '../lib/fechas'
import { aTexto, leerNumero } from '../lib/formato'
import { useAviso } from './Aviso'
import { Campo, Segmentado } from './Campo'
import { Hoja } from './Hoja'

const PRIORIDADES = [
  { valor: 'rojo', texto: 'Urgente' },
  { valor: 'amarillo', texto: 'Pronto' },
  { valor: 'verde', texto: 'En orden' },
] as const

/** Crear o editar un pendiente puntual (SPEC §4.5). */
export function HojaPendiente({ vehiculoId, deseo, onCerrar }: { vehiculoId: string; deseo?: Deseo; onCerrar: () => void }) {
  const avisar = useAviso()
  const navegar = useNavigate()
  const [titulo, setTitulo] = useState(deseo?.titulo ?? '')
  const [prioridad, setPrioridad] = useState<Prioridad>(deseo?.prioridad ?? 'amarillo')
  const [costo, setCosto] = useState(aTexto(deseo?.costo_estimado_usd))
  const [nota, setNota] = useState(deseo?.nota ?? '')
  const [error, setError] = useState('')

  function datos() {
    return {
      titulo: titulo.trim(),
      prioridad,
      costo_estimado_usd: costo.trim() ? leerNumero(costo) : null,
      nota: nota.trim(),
    }
  }

  async function guardar(e: FormEvent) {
    e.preventDefault()
    if (!titulo.trim()) return setError('Escribe qué hay que hacer.')
    if (costo.trim() && leerNumero(costo) === null) return setError('El costo no es válido.')
    if (deseo) await actualizar(db.wishlist_items, deseo.id, datos())
    else await crear(db.wishlist_items, { vehicle_id: vehiculoId, ...datos(), hecho: false, fecha_hecho: null, visit_id: null })
    avisar(deseo ? 'Pendiente actualizado' : 'Pendiente agregado')
    onCerrar()
  }

  async function marcarHecho() {
    if (!deseo) return
    if (!titulo.trim()) return setError('Escribe qué hay que hacer.')
    await actualizar(db.wishlist_items, deseo.id, { ...datos(), hecho: true, fecha_hecho: hoyISO() })
    onCerrar()
    if (window.confirm('¡Listo! ¿Quieres registrarlo como visita al taller?')) {
      navegar(`/taller/visita/nueva?pendiente=${deseo.id}`)
    } else {
      avisar('Pendiente hecho')
    }
  }

  async function reabrir() {
    if (!deseo) return
    await actualizar(db.wishlist_items, deseo.id, { hecho: false, fecha_hecho: null })
    avisar('Pendiente reabierto')
    onCerrar()
  }

  async function borrarPendiente() {
    if (!deseo || !window.confirm('¿Borrar este pendiente?')) return
    await borrar(db.wishlist_items, deseo.id)
    onCerrar()
  }

  return (
    <Hoja titulo={deseo ? 'Pendiente' : 'Nuevo pendiente'} onCerrar={onCerrar}>
      <form className="form" onSubmit={guardar} noValidate>
        <Campo etiqueta="¿Qué hay que hacer?">
          <input className="input" autoComplete="off" autoFocus={!deseo} placeholder="Ej.: Cambiar plumillas del parabrisas" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
        </Campo>
        <Campo etiqueta="Prioridad">
          <Segmentado etiqueta="Prioridad" opciones={PRIORIDADES} valor={prioridad} onCambio={setPrioridad} />
        </Campo>
        <div className="fila-campos">
          <Campo etiqueta="Costo estimado (USD)" ayuda="Opcional">
            <input className="input" inputMode="decimal" autoComplete="off" value={costo} onChange={(e) => setCosto(e.target.value)} />
          </Campo>
          <Campo etiqueta="Nota" ayuda="Ej.: antes de las lluvias">
            <input className="input" autoComplete="off" value={nota} onChange={(e) => setNota(e.target.value)} />
          </Campo>
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        <button type="submit" className="btn btn--primario btn--bloque">Guardar</button>
        {deseo && !deseo.hecho && (
          <button type="button" className="btn btn--bloque" onClick={marcarHecho}>
            <Check size={18} strokeWidth={2} /> Marcar como hecho
          </button>
        )}
        {deseo?.hecho && (
          <button type="button" className="btn btn--bloque" onClick={reabrir}>Volver a pendiente</button>
        )}
        {deseo && (
          <button type="button" className="btn btn--bloque btn--peligro" onClick={borrarPendiente}>
            <Trash2 size={18} strokeWidth={1.8} /> Borrar
          </button>
        )}
      </form>
    </Hoja>
  )
}
