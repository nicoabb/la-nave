import { useState } from 'react'
import { Receipt } from 'lucide-react'
import { Encabezado, Vacio } from '../components/comunes'

export default function Gastos() {
  const [moneda, setMoneda] = useState<'USD' | 'Bs'>('USD')

  return (
    <main className="pantalla">
      <Encabezado
        titulo="Gastos"
        accion={
          <div className="segmentado" role="group" aria-label="Moneda" style={{ width: 120 }}>
            {(['USD', 'Bs'] as const).map((m) => (
              <button key={m} aria-pressed={moneda === m} onClick={() => setMoneda(m)}>{m}</button>
            ))}
          </div>
        }
      />

      <section className="tarjeta">
        <span className="muted mini">Total desde la compra</span>
        <div className="cifra" style={{ marginTop: 6 }}>— {moneda}</div>
      </section>

      <Vacio Icono={Receipt}>
        <p>Todavía no hay gastos registrados.</p>
      </Vacio>
    </main>
  )
}
