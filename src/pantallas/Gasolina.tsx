import { BarChart3, Fuel } from 'lucide-react'
import { Encabezado, Vacio } from '../components/comunes'

export default function Gasolina() {
  return (
    <main className="pantalla">
      <Encabezado titulo="Gasolina" subtitulo="Tanque lleno a tanque lleno" />

      <Vacio Icono={BarChart3} color="var(--cielo)">
        <p>Aquí aparecerá el rendimiento de tus últimas 10 cargas.</p>
      </Vacio>

      <section className="tarjeta">
        <h2 className="titulo-seccion">Nueva carga</h2>
        <p className="muted" style={{ margin: '10px 0 0' }}>
          El formulario (km recorridos y litros) llega en la siguiente fase.
        </p>
      </section>

      <Vacio Icono={Fuel} color="var(--cielo)">
        <p>Todavía no hay cargas registradas.</p>
      </Vacio>
    </main>
  )
}
