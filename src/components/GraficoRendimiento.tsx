import { AJUSTES, type Tramo } from '../lib/gasolina'
import { kmPorLitro, numero } from '../lib/formato'

/** Barras de km/L de las últimas cargas; anómalas en coral; referencia punteada. */
export function GraficoRendimiento({
  tramos,
  referencia,
  anomalos,
}: {
  tramos: readonly Tramo[]
  referencia: number | null
  anomalos: Set<string>
}) {
  const W = 320
  const H = 150
  const arriba = 18
  const abajo = 4
  const ranura = W / AJUSTES.grafico
  const max = Math.max(...tramos.map((t) => t.kmL), referencia ?? 0) * 1.12
  const y = (v: number) => H - abajo - (v / max) * (H - arriba - abajo)

  const descripcion =
    `Rendimiento de las últimas ${tramos.length} cargas: ` +
    tramos.map((t) => kmPorLitro(t.kmL)).join(', ') +
    (referencia ? `. Referencia ${kmPorLitro(referencia)}` : '')

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={descripcion} style={{ display: 'block' }}>
      {tramos.map((t, i) => {
        const x = i * ranura + 4
        const top = y(t.kmL)
        const anomalo = anomalos.has(t.id)
        return (
          <g key={t.id}>
            <rect x={x} y={top} width={ranura - 8} height={H - abajo - top} rx={6} style={{ fill: anomalo ? 'var(--coral)' : 'var(--cielo)' }} />
            <text
              x={x + (ranura - 8) / 2}
              y={top - 5}
              textAnchor="middle"
              style={{ fill: anomalo ? 'var(--coral)' : 'var(--text-muted)', fontSize: 10, fontFamily: 'var(--font-display)', fontWeight: 600 }}
            >
              {numero(t.kmL, 1)}
            </text>
          </g>
        )
      })}
      {referencia !== null && (
        <line x1={0} x2={W} y1={y(referencia)} y2={y(referencia)} style={{ stroke: 'var(--text)', strokeWidth: 1.5, strokeDasharray: '5 5', opacity: 0.7 }} />
      )}
    </svg>
  )
}
