import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, ListChecks } from 'lucide-react'
import { Campo } from '../components/Campo'
import { SeccionCuenta } from '../components/Cuenta'
import { FormVehiculo } from '../components/FormVehiculo'
import { HojaCorreccion } from '../components/HojaCorreccion'
import { BotonExportar, BotonRestaurar } from '../components/Respaldo'
import { useCorrecciones, useKilometraje, useUmbralPronto, useVehiculoActivo, useVidaUtilCauchos } from '../db/hooks'
import { guardarMeta } from '../db/repo'
import { fechaLista, km, leerEntero, numero } from '../lib/formato'

export default function Configuracion() {
  const vehiculo = useVehiculoActivo()
  const correcciones = useCorrecciones(vehiculo.id) ?? []
  const kmTotal = useKilometraje(vehiculo.id)
  const umbral = useUmbralPronto()
  const vidaUtil = useVidaUtilCauchos()
  const [corrigiendo, setCorrigiendo] = useState(false)

  return (
    <main className="pantalla">
      <header className="encabezado" style={{ justifyContent: 'flex-start', alignItems: 'center' }}>
        <Link to="/" className="btn" aria-label="Volver a Inicio" style={{ padding: 0, width: 44 }}>
          <ChevronLeft size={22} strokeWidth={1.8} />
        </Link>
        <h1 className="titulo">Configuración</h1>
      </header>

      <section className="tarjeta" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h2 className="titulo-seccion">Cuenta y sincronización</h2>
        <SeccionCuenta />
      </section>

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

      <Link to="/configuracion/tareas" className="tarjeta" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span className="icono-caja">
          <ListChecks size={20} strokeWidth={1.8} color="var(--lavanda)" aria-hidden />
        </span>
        <span style={{ flex: 1 }}>
          <strong style={{ fontWeight: 600 }}>Tareas periódicas</strong>
          <span className="muted mini" style={{ display: 'block' }}>Intervalos y última vez de cada mantenimiento</span>
        </span>
        <ChevronRight size={20} strokeWidth={1.8} color="var(--text-muted)" aria-hidden />
      </Link>

      <section className="tarjeta form">
        <h2 className="titulo-seccion">Semáforo</h2>
        <Campo etiqueta="Pasar a «Pronto» desde el (%)" ayuda="Del intervalo cumplido. Al 100 % pasa a «Urgente».">
          <input
            className="input"
            inputMode="numeric"
            defaultValue={Math.round(umbral * 100)}
            key={umbral}
            onBlur={(e) => {
              const n = leerEntero(e.target.value)
              if (n && n >= 50 && n < 100) guardarMeta('umbral_pronto', n / 100)
              else e.target.value = String(Math.round(umbral * 100))
            }}
          />
        </Campo>
        <Campo etiqueta="Vida útil de los cauchos (km)" ayuda="Al llegar a estos km desde el montaje, el caucho pasa a «Urgente».">
          <input
            className="input"
            inputMode="numeric"
            defaultValue={numero(vidaUtil)}
            key={vidaUtil}
            onBlur={(e) => {
              const n = leerEntero(e.target.value)
              if (n && n >= 5000) guardarMeta('vida_util_cauchos', n)
              else e.target.value = numero(vidaUtil)
            }}
          />
        </Campo>
      </section>

      <section className="tarjeta" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h2 className="titulo-seccion">Respaldo</h2>
        <span className="muted mini">
          Una copia en un archivo, por si acaso. Con la cuenta activa tus datos ya quedan en la nube; las fotos no van en este archivo.
        </span>
        <BotonExportar />
        <BotonRestaurar />
      </section>

      {corrigiendo && <HojaCorreccion vehiculoId={vehiculo.id} kmEstimado={kmTotal} onCerrar={() => setCorrigiendo(false)} />}
    </main>
  )
}
