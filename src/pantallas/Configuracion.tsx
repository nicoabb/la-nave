import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { FormVehiculo } from '../components/FormVehiculo'
import { HojaCorreccion } from '../components/HojaCorreccion'
import { BotonExportar, BotonRestaurar } from '../components/Respaldo'
import { useCorrecciones, useKilometraje, useVehiculoActivo } from '../db/hooks'
import { fechaLista, km } from '../lib/formato'

export default function Configuracion() {
  const vehiculo = useVehiculoActivo()
  const correcciones = useCorrecciones(vehiculo.id) ?? []
  const kmTotal = useKilometraje(vehiculo.id)
  const [corrigiendo, setCorrigiendo] = useState(false)

  return (
    <main className="pantalla">
      <header className="encabezado" style={{ justifyContent: 'flex-start', alignItems: 'center' }}>
        <Link to="/" className="btn" aria-label="Volver a Inicio" style={{ padding: 0, width: 44 }}>
          <ChevronLeft size={22} strokeWidth={1.8} />
        </Link>
        <h1 className="titulo">Configuración</h1>
      </header>

      <section className="tarjeta" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h2 className="titulo-seccion">Vehículo</h2>
        <FormVehiculo key={vehiculo.id} vehiculo={vehiculo} />
      </section>

      <section className="tarjeta" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <h2 className="titulo-seccion">Lecturas del odómetro</h2>
          <button className="enlace" onClick={() => setCorrigiendo(true)}>Corregir</button>
        </div>
        <span className="muted mini">La más reciente es la base; luego se suman los km de cada carga.</span>
        <div className="lista">
          {[...correcciones].reverse().map((c) => (
            <div key={c.id} className="lista__fila">
              <span style={{ flex: 1 }}>
                <span style={{ display: 'block', fontWeight: 600 }}>{km(c.km_total)}</span>
                <span className="muted mini">{fechaLista(c.fecha)}{c.nota && ` · ${c.nota}`}</span>
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="tarjeta" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h2 className="titulo-seccion">Respaldo</h2>
        <span className="muted mini">
          Por ahora tus datos se guardan solo en este dispositivo. Descarga un respaldo de vez en cuando
          (y guárdalo en Drive, por ejemplo) hasta que activemos la sincronización.
        </span>
        <BotonExportar />
        <BotonRestaurar />
      </section>

      {corrigiendo && <HojaCorreccion vehiculoId={vehiculo.id} kmEstimado={kmTotal} onCerrar={() => setCorrigiendo(false)} />}
    </main>
  )
}
