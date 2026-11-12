import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ClipboardCheck,
  Droplet,
  Fuel,
  Gauge,
  ListPlus,
  Plus,
  Settings,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import { BarraProgreso, ChipEstado, EstadoRed, PuntoEstado } from '../components/comunes'
import { Hoja } from '../components/Hoja'
import { HojaCorreccion } from '../components/HojaCorreccion'
import type { TareaMantenimiento } from '../db/esquema'
import {
  descripcionVehiculo,
  useGasolina,
  useKilometraje,
  useMantenimiento,
  usePendientes,
  useUmbralPronto,
  useVehiculoActivo,
} from '../db/hooks'
import { dinero, km, kmPorLitro, numero } from '../lib/formato'
import { duracion, estadoDe, type EstadoTarea } from '../lib/tareas'
import { rutaParaHacer } from '../lib/rutas'

export default function Inicio() {
  const vehiculo = useVehiculoActivo()
  const kmTotal = useKilometraje(vehiculo.id)
  const { analisis, kmDia } = useGasolina(vehiculo.id)
  const mant = useMantenimiento(vehiculo.id)
  const pendientes = usePendientes(vehiculo.id)
  const umbral = useUmbralPronto()
  const navegar = useNavigate()
  const aceite = mant?.estados.find((e) => e.tarea.clave === 'aceite_motor')
  const [hoja, setHoja] = useState<'registrar' | 'corregir' | null>(null)
  const cerrar = () => setHoja(null)

  return (
    <main className="pantalla">
      <header style={{ paddingTop: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <p className="subtitulo" style={{ margin: 0 }}>{descripcionVehiculo(vehiculo)}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <EstadoRed />
            <Link to="/configuracion" className="icono-btn" aria-label="Configuración">
              <Settings size={20} strokeWidth={1.8} />
            </Link>
          </div>
        </div>
        <div className="cifra" style={{ marginTop: 4 }}>{kmTotal != null ? km(kmTotal) : '— km'}</div>
        <p className="subtitulo">
          Se suma solo con cada carga ·{' '}
          <button className="enlace" onClick={() => setHoja('corregir')}>Corregir</button>
        </p>
      </header>

      {aceite && <TarjetaAceite estado={aceite} costo={mant!.costo(aceite.tarea.id)} umbral={umbral} />}

      <div className="fila-2">
        <TarjetaChica
          Icono={Fuel}
          color="var(--cielo)"
          titulo="Rendimiento gasolina"
          valor={analisis.promedio ? numero(analisis.promedio, 1) : '—'}
          unidad="km/L"
          detalle={analisis.ultima ? `Última: ${kmPorLitro(analisis.ultima.kmL)}` : 'Sin cargas todavía'}
        />
        <TarjetaChica
          Icono={Gauge}
          color="var(--lavanda)"
          titulo="Km por día"
          valor={kmDia != null ? numero(kmDia) : '—'}
          unidad="km/día"
          detalle={kmDia != null ? 'Promedio de la semana' : 'Hacen falta 2 cargas'}
        />
      </div>

      <section className="tarjeta">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <h2 className="titulo-seccion">Lo que viene</h2>
          <Link to="/pendientes" className="enlace mini">Ver todo</Link>
        </div>
        {pendientes && pendientes.items.length === 0 && <p className="muted" style={{ margin: '12px 0 0' }}>Todavía no hay tareas.</p>}
        <div className="lista" style={{ marginTop: 4 }}>
          {pendientes?.items.slice(0, 3).map((i) => (
            <button key={i.clave} className="lista__fila" onClick={() => navegar(i.tarea ? rutaParaHacer(i.tarea) : '/pendientes')}>
              <PuntoEstado estado={i.estado} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontWeight: 600 }}>{i.titulo}</span>
                <span className="muted mini">{i.detalle || 'Pendiente puntual'}</span>
              </span>
              <ChipEstado estado={i.estado} />
            </button>
          ))}
        </div>
      </section>

      <button className="fab" aria-label="Registrar" onClick={() => setHoja('registrar')}>
        <Plus size={26} strokeWidth={2} />
      </button>

      {hoja === 'registrar' && <HojaRegistrar onCerrar={cerrar} onCorregir={() => setHoja('corregir')} />}
      {hoja === 'corregir' && <HojaCorreccion vehiculoId={vehiculo.id} kmEstimado={kmTotal} onCerrar={cerrar} />}
    </main>
  )
}

function TarjetaAceite({
  estado: e,
  costo,
  umbral,
}: {
  estado: EstadoTarea<TareaMantenimiento>
  costo: { usd: number; veces: number } | null
  umbral: number
}) {
  const navegar = useNavigate()
  return (
    <section className="tarjeta" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span className="icono-caja">
          <Droplet size={20} strokeWidth={1.8} color="var(--mantequilla)" aria-hidden />
        </span>
        <h2 className="titulo-seccion" style={{ flex: 1 }}>Próximo cambio de aceite</h2>
        <ChipEstado estado={e.estado} />
      </div>

      <div className="cifra" style={{ fontSize: 30 }}>{e.texto}</div>

      {e.desconocida ? (
        <p className="muted" style={{ margin: 0 }}>
          Anota cuándo fue el último cambio en{' '}
          <Link to="/configuracion/tareas" className="enlace">Tareas periódicas</Link>, o registra la próxima visita.
        </p>
      ) : (
        <>
          {e.pctKm !== null && (
            <BarraProgreso
              etiqueta="Kilómetros"
              pct={e.pctKm}
              estado={estadoDe(e.pctKm, umbral)}
              detalle={e.restanteKm! > 0 ? `faltan ${km(e.restanteKm!)}` : `vencido por ${km(-e.restanteKm!)}`}
            />
          )}
          {e.pctTiempo !== null && (
            <BarraProgreso
              etiqueta="Tiempo"
              pct={e.pctTiempo}
              estado={estadoDe(e.pctTiempo, umbral)}
              detalle={e.restanteDias! > 0 ? `faltan ${duracion(e.restanteDias!)}` : `vencido por ${duracion(-e.restanteDias!)}`}
            />
          )}
        </>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <span className="muted mini">
          {costo
            ? `≈ ${dinero(Math.round(costo.usd))} según ${costo.veces === 1 ? 'tu último' : `tus últimos ${costo.veces}`}`
            : 'Sin estimado'}
        </span>
        <button className="enlace mini" onClick={() => navegar(rutaParaHacer(e.tarea))}>Registrar cambio</button>
      </div>
    </section>
  )
}

function TarjetaChica({
  Icono,
  color,
  titulo,
  valor,
  unidad,
  detalle,
}: {
  Icono: LucideIcon
  color: string
  titulo: string
  valor: string
  unidad: string
  detalle: string
}) {
  return (
    <section className="tarjeta" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span className="icono-caja">
        <Icono size={20} strokeWidth={1.8} color={color} aria-hidden />
      </span>
      <span className="muted mini">{titulo}</span>
      <span>
        <span className="cifra" style={{ fontSize: 26 }}>{valor}</span>{' '}
        <span className="muted mini">{unidad}</span>
      </span>
      <span className="muted mini">{detalle}</span>
    </section>
  )
}

function HojaRegistrar({ onCerrar, onCorregir }: { onCerrar: () => void; onCorregir: () => void }) {
  const navegar = useNavigate()
  const ir = (ruta: string, state?: object) => {
    onCerrar()
    navegar(ruta, { state })
  }

  return (
    <Hoja titulo="¿Qué vas a registrar?" onCerrar={onCerrar}>
      <button className="opcion opcion--destacada" onClick={() => ir('/gasolina', { foco: true })}>
        <span className="icono-caja"><Fuel size={20} strokeWidth={1.8} /></span>
        <span className="opcion__texto">
          Carga de gasolina
          <small>Lo más frecuente · también actualiza el kilometraje</small>
        </span>
      </button>
      <Opcion Icono={Wrench} texto="Visita al taller" detalle="Repuestos, servicios y mano de obra" onClick={() => ir('/taller/visita/nueva')} />
      <Opcion Icono={ClipboardCheck} texto="Revisión semanal del capó" detalle="Aceite, refrigerante, frenos, dirección y cauchos" onClick={() => ir('/revision/revision_semanal')} />
      <Opcion Icono={ListPlus} texto="Nuevo pendiente" detalle="Algo puntual, como cambiar las plumillas" onClick={() => ir('/pendientes', { nuevo: true })} />
      <Opcion Icono={Gauge} texto="Corregir kilometraje" detalle="Si el tablero marca otra cosa" onClick={onCorregir} />

      <button className="btn btn--bloque" style={{ marginTop: 6 }} onClick={onCerrar}>Cancelar</button>
    </Hoja>
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
