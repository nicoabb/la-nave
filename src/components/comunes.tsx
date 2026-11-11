import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { CircleAlert, CircleCheck, Clock } from 'lucide-react'
import { useEnLinea } from '../lib/useEnLinea'
import type { Estado } from '../lib/tareas'

export type { Estado }

const ESTADOS: Record<Estado, { texto: string; Icono: LucideIcon }> = {
  urgente: { texto: 'Urgente', Icono: CircleAlert },
  pronto: { texto: 'Pronto', Icono: Clock },
  'en-orden': { texto: 'En orden', Icono: CircleCheck },
}

/** Chip del semáforo: siempre lleva texto e ícono además del color. */
export function ChipEstado({ estado, texto }: { estado: Estado; texto?: string }) {
  const { texto: base, Icono } = ESTADOS[estado]
  return (
    <span className={`chip chip--${estado}`}>
      <Icono size={13} strokeWidth={2} aria-hidden />
      {texto ?? base}
    </span>
  )
}

export function Encabezado({
  titulo,
  subtitulo,
  accion,
}: {
  titulo: string
  subtitulo?: string
  accion?: ReactNode
}) {
  return (
    <header className="encabezado">
      <div>
        <h1 className="titulo">{titulo}</h1>
        {subtitulo && <p className="subtitulo">{subtitulo}</p>}
      </div>
      {accion}
    </header>
  )
}

export function Vacio({ Icono, children, color = 'var(--text-muted)' }: { Icono: LucideIcon; children: ReactNode; color?: string }) {
  return (
    <div className="tarjeta vacio">
      <span className="icono-caja">
        <Icono size={20} strokeWidth={1.8} color={color} aria-hidden />
      </span>
      {children}
    </div>
  )
}

const COLOR_ESTADO: Record<Estado, string> = {
  urgente: 'var(--coral)',
  pronto: 'var(--mantequilla)',
  'en-orden': 'var(--menta)',
}

export function PuntoEstado({ estado }: { estado: Estado }) {
  return <span className="punto" style={{ background: COLOR_ESTADO[estado], width: 10, height: 10 }} aria-hidden />
}

/** Barra de progreso con su % y texto; el color sigue al semáforo. */
export function BarraProgreso({ etiqueta, pct, estado, detalle }: { etiqueta: string; pct: number; estado: Estado; detalle: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-mini)' }}>
        <span style={{ fontWeight: 600 }}>{etiqueta}</span>
        <span className="muted">{Math.round(Math.max(0, pct) * 100)} % · {detalle}</span>
      </div>
      <div className="barra">
        <div className="barra__relleno" style={{ width: `${Math.min(100, Math.max(2, pct * 100))}%`, background: COLOR_ESTADO[estado] }} />
      </div>
    </div>
  )
}

/** Indicador discreto de conexión (la sincronización llega en la fase 5). */
export function EstadoRed() {
  const enLinea = useEnLinea()
  return (
    <span className="estado-red" role="status">
      <span className="punto" style={{ background: enLinea ? 'var(--menta)' : 'var(--mantequilla)' }} />
      {enLinea ? 'En línea' : 'Sin conexión'}
    </span>
  )
}
