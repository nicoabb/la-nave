import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, CircleDot, Package, Plus, Wrench } from 'lucide-react'
import { Encabezado, Vacio } from '../components/comunes'

export default function Taller() {
  const [pestana, setPestana] = useState<'visitas' | 'productos'>('visitas')

  return (
    <main className="pantalla">
      <Encabezado
        titulo="Taller"
        accion={
          <button className="btn btn--primario" disabled>
            <Plus size={18} strokeWidth={2} /> Visita
          </button>
        }
      />

      <div className="segmentado" role="group" aria-label="Sección de taller">
        <button aria-pressed={pestana === 'visitas'} onClick={() => setPestana('visitas')}>Visitas</button>
        <button aria-pressed={pestana === 'productos'} onClick={() => setPestana('productos')}>Productos que uso</button>
      </div>

      {pestana === 'visitas' ? (
        <>
          <Link to="/taller/cauchos" className="tarjeta" style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 64 }}>
            <span className="icono-caja">
              <CircleDot size={20} strokeWidth={1.8} color="var(--lavanda)" aria-hidden />
            </span>
            <span style={{ flex: 1 }}>
              <strong style={{ fontWeight: 600 }}>Cauchos</strong>
              <span className="muted mini" style={{ display: 'block' }}>Sin datos todavía</span>
            </span>
            <ChevronRight size={20} strokeWidth={1.8} color="var(--text-muted)" aria-hidden />
          </Link>
          <Vacio Icono={Wrench}>
            <p>Todavía no hay visitas al taller.</p>
          </Vacio>
        </>
      ) : (
        <Vacio Icono={Package}>
          <p>Aquí irán las fichas de aceite, refrigerante, filtros y demás productos que usas.</p>
        </Vacio>
      )}
    </main>
  )
}
