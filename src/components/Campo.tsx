import type { ReactNode } from 'react'

export function Campo({ etiqueta, ayuda, children }: { etiqueta: string; ayuda?: ReactNode; children: ReactNode }) {
  return (
    <label className="campo">
      <span className="campo__etiqueta">{etiqueta}</span>
      {children}
      {ayuda && <span className="campo__ayuda">{ayuda}</span>}
    </label>
  )
}

/** Selector segmentado tipo USD | Bs */
export function Segmentado<T extends string>({
  opciones,
  valor,
  onCambio,
  etiqueta,
}: {
  opciones: readonly { valor: T; texto: string }[]
  valor: T
  onCambio: (v: T) => void
  etiqueta: string
}) {
  return (
    <div className="segmentado" role="group" aria-label={etiqueta}>
      {opciones.map((o) => (
        <button key={o.valor} type="button" aria-pressed={valor === o.valor} onClick={() => onCambio(o.valor)}>
          {o.texto}
        </button>
      ))}
    </div>
  )
}
