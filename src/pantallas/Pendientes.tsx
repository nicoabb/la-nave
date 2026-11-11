import { ListChecks, Plus } from 'lucide-react'
import { ChipEstado, Encabezado, Vacio } from '../components/comunes'

export default function Pendientes() {
  return (
    <main className="pantalla">
      <Encabezado
        titulo="Pendientes"
        subtitulo="Ordenado por prioridad"
        accion={
          <button className="btn btn--primario" disabled>
            <Plus size={18} strokeWidth={2} /> Añadir
          </button>
        }
      />

      <section className="tarjeta">
        <span className="muted mini">Urgente + pronto</span>
        <div className="cifra" style={{ marginTop: 6 }}>— USD</div>
        <p className="muted mini" style={{ margin: '6px 0 0' }}>No incluye lo que está en orden</p>
      </section>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <ChipEstado estado="urgente" />
        <ChipEstado estado="pronto" />
        <ChipEstado estado="en-orden" />
      </div>

      <Vacio Icono={ListChecks}>
        <p>Todavía no hay pendientes.</p>
      </Vacio>
    </main>
  )
}
