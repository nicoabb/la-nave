import { FormVehiculo } from '../components/FormVehiculo'
import { BotonRestaurar } from '../components/Respaldo'

/** Primera vez: configurar el vehículo y su odómetro. */
export default function Bienvenida() {
  return (
    <main className="pantalla" style={{ paddingBottom: 40 }}>
      <header style={{ paddingTop: 24 }}>
        <h1 className="titulo">La Nave</h1>
        <p className="subtitulo">Empecemos por tu carro. Todo se puede cambiar después.</p>
      </header>
      <section className="tarjeta">
        <FormVehiculo />
      </section>
      <section className="tarjeta" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <span className="muted mini">¿Ya usabas La Nave en este u otro teléfono?</span>
        <BotonRestaurar />
      </section>
    </main>
  )
}
