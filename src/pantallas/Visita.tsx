import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, Plus, Trash2 } from 'lucide-react'
import { useAviso } from '../components/Aviso'
import { Campo, Segmentado } from '../components/Campo'
import { db, type Deseo, type ItemTaller, type Moneda, type Producto, type TareaMantenimiento, type TipoItem, type VisitaTaller } from '../db/esquema'
import { useKilometraje, useVehiculoActivo } from '../db/hooks'
import { actualizar, borrar, crear, guardarMeta, leerMeta, uuid } from '../db/repo'
import { SISTEMAS, TIPOS_ITEM } from '../lib/catalogos'
import { hoyISO } from '../lib/fechas'
import { aTexto, dinero, leerEntero, leerNumero, numero } from '../lib/formato'
import { ayudaTasa } from '../lib/gastos'

interface ItemForm {
  clave: string
  id?: string
  descripcion: string
  tipo: TipoItem
  sistema: string
  task_id: string
  product_id: string
  cantidad: string
  monto: string
}

const itemVacio = (p: Partial<ItemForm> = {}): ItemForm => ({
  clave: uuid(),
  descripcion: '',
  tipo: 'repuesto',
  sistema: 'Motor',
  task_id: '',
  product_id: '',
  cantidad: '',
  monto: '',
  ...p,
})

const MONEDAS = [
  { valor: 'USD', texto: 'USD' },
  { valor: 'VES', texto: 'Bs' },
] as const

export default function Visita() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const vehiculo = useVehiculoActivo()
  const kmTotal = useKilometraje(vehiculo.id)
  const datos = useLiveQuery(async () => {
    const tareas = (await db.maintenance_tasks.where('vehicle_id').equals(vehiculo.id).toArray())
      .filter((t) => !t.deleted)
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
    const productos = (await db.products.toArray()).filter((p) => !p.deleted)
    const idPendiente = params.get('pendiente')
    const pendiente = idPendiente ? ((await db.wishlist_items.get(idPendiente)) ?? null) : null
    if (!id) return { tareas, productos, visita: null, items: [] as ItemTaller[], pendiente }
    const visita = (await db.service_visits.get(id)) ?? null
    const items = (await db.service_items.where('visit_id').equals(id).toArray())
      .filter((i) => !i.deleted)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
    return { tareas, productos, visita, items, pendiente: null }
  }, [id, vehiculo.id, params.get('pendiente')])

  if (!datos || kmTotal === undefined) return <main className="pantalla" />
  if (id && !datos.visita) {
    return (
      <main className="pantalla">
        <p className="muted">No se encontró esa visita.</p>
        <Link to="/taller" className="enlace">Volver a Taller</Link>
      </main>
    )
  }
  return (
    <FormVisita
      key={id ?? 'nueva'}
      vehiculoId={vehiculo.id}
      visita={datos.visita}
      itemsGuardados={datos.items}
      tareas={datos.tareas}
      productos={datos.productos}
      kmTotal={kmTotal}
      tareaInicial={params.get('tarea')}
      pendiente={datos.pendiente}
    />
  )
}

function FormVisita({
  vehiculoId,
  visita,
  itemsGuardados,
  tareas,
  productos,
  kmTotal,
  tareaInicial,
  pendiente,
}: {
  pendiente: Deseo | null
  vehiculoId: string
  visita: VisitaTaller | null
  itemsGuardados: ItemTaller[]
  tareas: TareaMantenimiento[]
  productos: Producto[]
  kmTotal: number | null
  tareaInicial: string | null
}) {
  const navegar = useNavigate()
  const avisar = useAviso()

  const [fecha, setFecha] = useState(visita?.fecha ?? hoyISO())
  const [km, setKm] = useState(visita ? (visita.km != null ? numero(visita.km) : '') : kmTotal ? numero(Math.round(kmTotal)) : '')
  const [titulo, setTitulo] = useState(visita?.titulo ?? '')
  const [taller, setTaller] = useState(visita?.taller ?? '')
  const [proveedor, setProveedor] = useState(visita?.proveedor ?? '')
  const [afecta, setAfecta] = useState(visita?.afecta_rendimiento ?? false)
  const [moneda, setMoneda] = useState<Moneda>(visita?.moneda ?? 'USD')
  const [tasa, setTasa] = useState(aTexto(visita?.tasa_ves_usd))
  const [nota, setNota] = useState(visita?.nota ?? '')
  const [error, setError] = useState('')
  const [items, setItems] = useState<ItemForm[]>(() => {
    if (visita) {
      return itemsGuardados.map((i) =>
        itemVacio({
          id: i.id,
          descripcion: i.descripcion,
          tipo: i.tipo,
          sistema: i.sistema,
          task_id: i.task_id ?? '',
          product_id: i.product_id ?? '',
          cantidad: aTexto(i.cantidad),
          monto: aTexto(i.monto),
        }),
      )
    }
    if (pendiente) return [itemVacio({ descripcion: pendiente.titulo, tipo: 'servicio' })]
    const t = tareas.find((x) => x.id === tareaInicial)
    return [t ? itemVacio({ descripcion: t.nombre, sistema: t.sistema, task_id: t.id, tipo: 'servicio' }) : itemVacio()]
  })

  useEffect(() => {
    if (visita) return
    leerMeta<number>('ultima_tasa').then((t) => t && setTasa((prev) => prev || aTexto(t)))
  }, [visita])

  const cambiarItem = (clave: string, cambios: Partial<ItemForm>) =>
    setItems((xs) => xs.map((x) => (x.clave === clave ? { ...x, ...cambios } : x)))

  function elegirTarea(item: ItemForm, taskId: string) {
    const t = tareas.find((x) => x.id === taskId)
    cambiarItem(item.clave, {
      task_id: taskId,
      ...(t && !item.descripcion.trim() ? { descripcion: t.nombre } : {}),
      ...(t ? { sistema: t.sistema } : {}),
    })
  }

  const total = items.reduce((s, i) => s + (leerNumero(i.monto) ?? 0), 0)

  async function guardar(e: FormEvent) {
    e.preventDefault()
    setError('')
    const llenos = items.filter((i) => i.descripcion.trim())
    if (!fecha) return setError('Escribe la fecha.')
    if (!llenos.length) return setError('Agrega al menos un ítem con su descripción.')
    const tasaN = leerNumero(tasa)
    if (moneda === 'VES' && (!tasaN || tasaN <= 0)) return setError('Si pagaste en Bs, escribe la tasa.')
    for (const i of llenos) {
      if (i.monto.trim() && leerNumero(i.monto) === null) return setError(`El monto de "${i.descripcion}" no es válido.`)
    }

    const tasaOk = tasaN && tasaN > 0 ? tasaN : null
    if (tasaOk) await guardarMeta('ultima_tasa', tasaOk)
    const datosVisita = {
      fecha,
      km: km.trim() ? leerEntero(km) : null,
      titulo: titulo.trim(),
      taller: taller.trim(),
      proveedor: proveedor.trim(),
      afecta_rendimiento: afecta,
      moneda,
      tasa_ves_usd: tasaOk,
      tasa_origen: !tasaOk ? null : visita && tasa === aTexto(visita.tasa_ves_usd) ? visita.tasa_origen : ('manual' as const),
      nota: nota.trim(),
    }

    await db.transaction('rw', db.service_visits, db.service_items, db.wishlist_items, async () => {
      let visitId = visita?.id
      if (visitId) await actualizar(db.service_visits, visitId, datosVisita)
      else visitId = (await crear(db.service_visits, { vehicle_id: vehiculoId, ...datosVisita })).id
      if (pendiente) await actualizar(db.wishlist_items, pendiente.id, { visit_id: visitId })

      const quedan = new Set(llenos.map((i) => i.id).filter(Boolean))
      for (const viejo of itemsGuardados) if (!quedan.has(viejo.id)) await borrar(db.service_items, viejo.id)

      for (const i of llenos) {
        const monto = i.monto.trim() ? leerNumero(i.monto) : null
        const datosItem = {
          visit_id: visitId,
          descripcion: i.descripcion.trim(),
          tipo: i.tipo,
          sistema: i.sistema,
          task_id: i.task_id || null,
          product_id: i.product_id || null,
          cantidad: i.cantidad.trim() ? leerNumero(i.cantidad) : null,
          monto,
          monto_usd: monto == null ? null : moneda === 'VES' ? monto / tasaOk! : monto,
        }
        if (i.id) await actualizar(db.service_items, i.id, datosItem)
        else await crear(db.service_items, datosItem)
      }
    })

    avisar(visita ? 'Visita actualizada' : 'Visita guardada', afecta ? 'La referencia de rendimiento empieza de cero desde esta fecha.' : undefined)
    navegar('/taller', { replace: true })
  }

  async function borrarVisita() {
    if (!visita || !window.confirm('¿Borrar esta visita, sus ítems y sus comprobantes?')) return
    await db.transaction('rw', [db.service_visits, db.service_items, db.visit_receipts, db.comprobantes_cola], async () => {
      for (const i of itemsGuardados) await borrar(db.service_items, i.id)
      // Los comprobantes también: el archivo se quita del bucket al sincronizar
      for (const c of await db.visit_receipts.where('visit_id').equals(visita.id).toArray()) {
        await db.comprobantes_cola.delete(c.path)
        if (!c.deleted) await borrar(db.visit_receipts, c.id)
      }
      await borrar(db.service_visits, visita.id)
    })
    avisar('Visita borrada')
    navegar('/taller', { replace: true })
  }

  return (
    <main className="pantalla">
      <header className="encabezado" style={{ justifyContent: 'flex-start', alignItems: 'center' }}>
        <Link to="/taller" className="btn" aria-label="Volver a Taller" style={{ padding: 0, width: 44 }}>
          <ChevronLeft size={22} strokeWidth={1.8} />
        </Link>
        <h1 className="titulo">{visita ? 'Editar visita' : 'Nueva visita'}</h1>
      </header>

      <form className="form" onSubmit={guardar} noValidate>
        <section className="tarjeta form">
          <div className="fila-campos">
            <Campo etiqueta="Fecha">
              <input className="input" type="date" value={fecha} max={hoyISO()} onChange={(e) => setFecha(e.target.value)} />
            </Campo>
            <Campo etiqueta="Km del tablero">
              <input className="input" inputMode="numeric" autoComplete="off" value={km} onChange={(e) => setKm(e.target.value)} />
            </Campo>
          </div>
          <Campo etiqueta="Título (opcional)" ayuda="Si lo dejas vacío, se arma con los ítems.">
            <input className="input" autoComplete="off" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          </Campo>
          <div className="fila-campos">
            <Campo etiqueta="Taller (opcional)">
              <input className="input" autoComplete="off" value={taller} onChange={(e) => setTaller(e.target.value)} />
            </Campo>
            <Campo etiqueta="Tienda (opcional)" ayuda="Si compraste repuestos">
              <input className="input" autoComplete="off" value={proveedor} onChange={(e) => setProveedor(e.target.value)} />
            </Campo>
          </div>
          <div className="fila-campos">
            <Campo etiqueta="Moneda de pago">
              <Segmentado etiqueta="Moneda de pago" opciones={MONEDAS} valor={moneda} onCambio={setMoneda} />
            </Campo>
            <Campo etiqueta="Tasa (Bs por USD)" ayuda={ayudaTasa(moneda, visita?.tasa_origen, Boolean(visita) && tasa === aTexto(visita?.tasa_ves_usd))}>
              <input className="input" inputMode="decimal" autoComplete="off" value={tasa} onChange={(e) => setTasa(e.target.value)} />
            </Campo>
          </div>
          <label className="check">
            <input type="checkbox" checked={afecta} onChange={(e) => setAfecta(e.target.checked)} />
            <span>
              Afecta el rendimiento de gasolina
              <span className="muted mini" style={{ display: 'block' }}>La referencia de km/L empieza de cero desde esta visita.</span>
            </span>
          </label>
        </section>

        <h2 className="titulo-seccion">Ítems</h2>
        {items.map((i, n) => (
          <section key={i.clave} className="tarjeta form">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="muted mini">Ítem {n + 1}</span>
              {items.length > 1 && (
                <button type="button" className="icono-btn" aria-label={`Quitar ítem ${n + 1}`} onClick={() => setItems((xs) => xs.filter((x) => x.clave !== i.clave))}>
                  <Trash2 size={18} strokeWidth={1.8} />
                </button>
              )}
            </div>
            <Campo etiqueta="Descripción">
              <input className="input" autoComplete="off" value={i.descripcion} onChange={(e) => cambiarItem(i.clave, { descripcion: e.target.value })} />
            </Campo>
            <div className="fila-campos">
              <Campo etiqueta="Tipo">
                <select className="input" value={i.tipo} onChange={(e) => cambiarItem(i.clave, { tipo: e.target.value as TipoItem })}>
                  {TIPOS_ITEM.map((t) => <option key={t.valor} value={t.valor}>{t.texto}</option>)}
                </select>
              </Campo>
              <Campo etiqueta="Sistema">
                <select className="input" value={i.sistema} onChange={(e) => cambiarItem(i.clave, { sistema: e.target.value })}>
                  {SISTEMAS.map((s) => <option key={s}>{s}</option>)}
                </select>
              </Campo>
            </div>
            <Campo etiqueta="Tarea periódica (opcional)" ayuda="Así la app sabe cuándo se hizo por última vez.">
              <select className="input" value={i.task_id} onChange={(e) => elegirTarea(i, e.target.value)}>
                <option value="">Ninguna</option>
                {tareas.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
              </select>
            </Campo>
            {productos.length > 0 && (
              <Campo etiqueta="Producto (opcional)">
                <select className="input" value={i.product_id} onChange={(e) => cambiarItem(i.clave, { product_id: e.target.value })}>
                  <option value="">Ninguno</option>
                  {productos.map((p) => <option key={p.id} value={p.id}>{[p.tipo, p.marca, p.especificacion].filter(Boolean).join(' · ')}</option>)}
                </select>
              </Campo>
            )}
            <div className="fila-campos">
              <Campo etiqueta="Cantidad">
                <input className="input" inputMode="decimal" autoComplete="off" value={i.cantidad} onChange={(e) => cambiarItem(i.clave, { cantidad: e.target.value })} />
              </Campo>
              <Campo etiqueta={`Monto (${moneda === 'VES' ? 'Bs' : 'USD'})`} ayuda="0 si fue sin costo">
                <input className="input" inputMode="decimal" autoComplete="off" value={i.monto} onChange={(e) => cambiarItem(i.clave, { monto: e.target.value })} />
              </Campo>
            </div>
          </section>
        ))}
        <button type="button" className="btn btn--bloque" onClick={() => setItems((xs) => [...xs, itemVacio({ sistema: xs.at(-1)?.sistema ?? 'Motor' })])}>
          <Plus size={18} strokeWidth={2} /> Agregar ítem
        </button>

        <section className="tarjeta form">
          <Campo etiqueta="Nota (opcional)">
            <textarea className="input" rows={3} style={{ paddingTop: 10 }} value={nota} onChange={(e) => setNota(e.target.value)} />
          </Campo>
          <div className="resultado">
            <span className="muted">Total</span>
            <strong className="cifra" style={{ fontSize: 22 }}>{dinero(total, moneda)}</strong>
          </div>
          {error && <p className="error" role="alert">{error}</p>}
          <button type="submit" className="btn btn--primario btn--bloque">{visita ? 'Guardar cambios' : 'Guardar visita'}</button>
          {visita && (
            <button type="button" className="btn btn--bloque btn--peligro" onClick={borrarVisita}>
              <Trash2 size={18} strokeWidth={1.8} /> Borrar visita
            </button>
          )}
        </section>
      </form>
    </main>
  )
}
