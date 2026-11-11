import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ClipboardCheck,
  Droplet,
  Fuel,
  Gauge,
  ListPlus,
  Plus,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import { EstadoRed } from '../components/comunes'

export default function Inicio() {
  const [hojaAbierta, setHojaAbierta] = useState(false)

  return (
    <main className="pantalla">
      <header style={{ paddingTop: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p className="subtitulo" style={{ margin: 0 }}>Tu vehículo</p>
          <EstadoRed />
        </div>
        <div className="cifra" style={{ marginTop: 8 }}>— km</div>
        <p className="subtitulo">
          Se suma solo con cada carga ·{' '}
          <button className="enlace" disabled>Corregir</button>
        </p>
      </header>

      {/* Próximo cambio de aceite */}
      <section className="tarjeta">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="icono-caja">
            <Droplet size={20} strokeWidth={1.8} color="var(--mantequilla)" aria-hidden />
          </span>
          <h2 className="titulo-seccion">Próximo cambio de aceite</h2>
        </div>
        <p className="muted" style={{ margin: '14px 0 0' }}>
          Aquí verás cuántos km y días faltan, con sus barras de progreso.
        </p>
      </section>

      <div className="fila-2">
        <TarjetaChica Icono={Fuel} color="var(--cielo)" titulo="Rendimiento gasolina" />
        <TarjetaChica Icono={Gauge} color="var(--lavanda)" titulo="Km por día" />
      </div>

      <section className="tarjeta">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <h2 className="titulo-seccion">Lo que viene</h2>
          <Link to="/pendientes" className="enlace mini">Ver todo</Link>
        </div>
        <p className="muted" style={{ margin: '12px 0 0' }}>Todavía no hay tareas.</p>
      </section>

      <button className="fab" aria-label="Registrar" onClick={() => setHojaAbierta(true)}>
        <Plus size={26} strokeWidth={2} />
      </button>

      {hojaAbierta && <HojaRegistrar onCerrar={() => setHojaAbierta(false)} />}
    </main>
  )
}

function TarjetaChica({ Icono, color, titulo }: { Icono: LucideIcon; color: string; titulo: string }) {
  return (
    <section className="tarjeta" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <span className="icono-caja">
        <Icono size={20} strokeWidth={1.8} color={color} aria-hidden />
      </span>
      <span className="muted mini">{titulo}</span>
      <span className="cifra" style={{ fontSize: 24 }}>—</span>
    </section>
  )
}

function HojaRegistrar({ onCerrar }: { onCerrar: () => void }) {
  const navegar = useNavigate()
  const ir = (ruta: string) => {
    onCerrar()
    navegar(ruta)
  }

  return (
    <div className="hoja-fondo" onClick={onCerrar}>
      <div className="hoja" role="dialog" aria-modal="true" aria-labelledby="hoja-titulo" onClick={(e) => e.stopPropagation()}>
        <div className="hoja__agarre" />
        <h2 id="hoja-titulo" className="titulo-seccion" style={{ marginBottom: 4 }}>¿Qué vas a registrar?</h2>

        <button className="opcion opcion--destacada" onClick={() => ir('/gasolina')}>
          <span className="icono-caja"><Fuel size={20} strokeWidth={1.8} /></span>
          <span className="opcion__texto">
            Carga de gasolina
            <small>Lo más frecuente · también actualiza el kilometraje</small>
          </span>
        </button>
        <Opcion Icono={Wrench} texto="Visita al taller" onClick={() => ir('/taller')} />
        <Opcion Icono={ClipboardCheck} texto="Revisión semanal del capó" detalle="Aceite, refrigerante, frenos, dirección y cauchos" />
        <Opcion Icono={ListPlus} texto="Nuevo pendiente" onClick={() => ir('/pendientes')} />
        <Opcion Icono={Gauge} texto="Corregir kilometraje" />

        <button className="btn btn--bloque" style={{ marginTop: 6 }} onClick={onCerrar}>Cancelar</button>
      </div>
    </div>
  )
}

function Opcion({ Icono, texto, detalle, onClick }: { Icono: LucideIcon; texto: string; detalle?: string; onClick?: () => void }) {
  return (
    <button className="opcion" onClick={onClick} disabled={!onClick}>
      <span className="icono-caja" style={{ background: 'var(--surface)' }}>
        <Icono size={20} strokeWidth={1.8} color="var(--lavanda)" />
      </span>
      <span className="opcion__texto">
        {texto}
        <small className="muted">{onClick ? detalle : 'Disponible pronto'}</small>
      </span>
    </button>
  )
}
