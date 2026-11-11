import { useEffect, useState, type FormEvent } from 'react'
import { Camera, Trash2 } from 'lucide-react'
import { db, type Producto } from '../db/esquema'
import { useFotoUrl } from '../db/hooks'
import { actualizar, borrar, crear, uuid } from '../db/repo'
import { TIPOS_PRODUCTO } from '../lib/catalogos'
import { comprimirFoto } from '../lib/fotos'
import { useAviso } from './Aviso'
import { Campo } from './Campo'
import { Hoja } from './Hoja'

/** Crear o editar una ficha de producto, con foto del envase. */
export function HojaProducto({ producto, onCerrar }: { producto?: Producto; onCerrar: () => void }) {
  const avisar = useAviso()
  const [tipo, setTipo] = useState(producto?.tipo ?? TIPOS_PRODUCTO[0])
  const [marca, setMarca] = useState(producto?.marca ?? '')
  const [especificacion, setEspecificacion] = useState(producto?.especificacion ?? '')
  const [presentacion, setPresentacion] = useState(producto?.presentacion ?? '')
  const [enUso, setEnUso] = useState(producto?.en_uso ?? true)
  const [nota, setNota] = useState(producto?.nota ?? '')
  const [fotoNueva, setFotoNueva] = useState<Blob | null>(null)
  const [vistaNueva, setVistaNueva] = useState<string | null>(null)
  const [procesando, setProcesando] = useState(false)
  const [error, setError] = useState('')
  const fotoGuardada = useFotoUrl(producto?.foto_path ?? null)

  useEffect(() => () => {
    if (vistaNueva) URL.revokeObjectURL(vistaNueva)
  }, [vistaNueva])

  async function elegirFoto(archivo: File | undefined) {
    if (!archivo) return
    setProcesando(true)
    try {
      const blob = await comprimirFoto(archivo)
      setFotoNueva(blob)
      setVistaNueva(URL.createObjectURL(blob))
    } catch {
      setError('No se pudo procesar la foto.')
    } finally {
      setProcesando(false)
    }
  }

  async function guardar(e: FormEvent) {
    e.preventDefault()
    if (!marca.trim() && !especificacion.trim()) return setError('Escribe al menos la marca o la especificación.')
    await db.transaction('rw', db.products, db.fotos, async () => {
      let foto_path = producto?.foto_path ?? null
      if (fotoNueva) {
        if (foto_path) await db.fotos.delete(foto_path)
        foto_path = `${uuid()}.webp`
        await db.fotos.put({ path: foto_path, blob: fotoNueva, subida: false })
      }
      const datos = {
        tipo,
        marca: marca.trim(),
        especificacion: especificacion.trim(),
        presentacion: presentacion.trim(),
        en_uso: enUso,
        nota: nota.trim(),
        foto_path,
      }
      let id = producto?.id
      if (id) await actualizar(db.products, id, datos)
      else id = (await crear(db.products, datos)).id
      // Solo un producto "en uso" por tipo: los demás pasan a "anterior"
      if (enUso) {
        const otros = (await db.products.toArray()).filter((p) => !p.deleted && p.id !== id && p.tipo === tipo && p.en_uso)
        for (const p of otros) await actualizar(db.products, p.id, { en_uso: false })
      }
    })
    avisar(producto ? 'Producto actualizado' : 'Producto guardado')
    onCerrar()
  }

  async function borrarProducto() {
    if (!producto || !window.confirm('¿Borrar este producto?')) return
    await borrar(db.products, producto.id)
    onCerrar()
  }

  const vista = vistaNueva ?? fotoGuardada

  return (
    <Hoja titulo={producto ? 'Editar producto' : 'Nuevo producto'} onCerrar={onCerrar}>
      <form className="form" onSubmit={guardar} noValidate>
        <label className="foto-caja">
          {vista ? <img src={vista} alt="Foto del envase" /> : (
            <span className="muted" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <Camera size={24} strokeWidth={1.8} />
              {procesando ? 'Procesando…' : 'Foto del envase (opcional)'}
            </span>
          )}
          <input type="file" accept="image/*" hidden onChange={(e) => elegirFoto(e.target.files?.[0])} />
        </label>
        <Campo etiqueta="Tipo">
          <select className="input" value={tipo} onChange={(e) => setTipo(e.target.value)}>
            {TIPOS_PRODUCTO.map((t) => <option key={t}>{t}</option>)}
          </select>
        </Campo>
        <div className="fila-campos">
          <Campo etiqueta="Marca">
            <input className="input" autoComplete="off" value={marca} onChange={(e) => setMarca(e.target.value)} />
          </Campo>
          <Campo etiqueta="Presentación">
            <input className="input" autoComplete="off" placeholder="Ej.: 4 L" value={presentacion} onChange={(e) => setPresentacion(e.target.value)} />
          </Campo>
        </div>
        <Campo etiqueta="Especificación">
          <input className="input" autoComplete="off" placeholder="Ej.: 10W-40 semisintético" value={especificacion} onChange={(e) => setEspecificacion(e.target.value)} />
        </Campo>
        <Campo etiqueta="Nota (opcional)">
          <input className="input" autoComplete="off" value={nota} onChange={(e) => setNota(e.target.value)} />
        </Campo>
        <label className="check">
          <input type="checkbox" checked={enUso} onChange={(e) => setEnUso(e.target.checked)} />
          <span>
            En uso actual
            <span className="muted mini" style={{ display: 'block' }}>Si lo desmarcas, queda como "anterior".</span>
          </span>
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button type="submit" className="btn btn--primario btn--bloque" disabled={procesando}>Guardar</button>
        {producto && (
          <button type="button" className="btn btn--bloque btn--peligro" onClick={borrarProducto}>
            <Trash2 size={18} strokeWidth={1.8} /> Borrar producto
          </button>
        )}
      </form>
    </Hoja>
  )
}
