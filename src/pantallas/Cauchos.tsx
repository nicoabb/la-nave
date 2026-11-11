import { Link } from 'react-router-dom'
import { ChevronLeft, CircleDot } from 'lucide-react'
import { Vacio } from '../components/comunes'

export default function Cauchos() {
  return (
    <main className="pantalla">
      <header className="encabezado" style={{ justifyContent: 'flex-start', alignItems: 'center' }}>
        <Link to="/taller" className="btn" aria-label="Volver a Taller" style={{ padding: 0, width: 44 }}>
          <ChevronLeft size={22} strokeWidth={1.8} />
        </Link>
        <h1 className="titulo">Cauchos</h1>
      </header>

      <Vacio Icono={CircleDot} color="var(--lavanda)">
        <p>Aquí verás los 4 cauchos y el repuesto, con su edad, estado y servicios (presión, rotación, balanceo y alineación).</p>
      </Vacio>
    </main>
  )
}
