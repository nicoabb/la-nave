import { NavLink } from 'react-router-dom'
import { Fuel, Home, ListChecks, Wallet, Wrench } from 'lucide-react'

const PESTANAS = [
  { a: '/', texto: 'Inicio', Icono: Home },
  { a: '/gasolina', texto: 'Gasolina', Icono: Fuel },
  { a: '/taller', texto: 'Taller', Icono: Wrench },
  { a: '/pendientes', texto: 'Pendientes', Icono: ListChecks },
  { a: '/gastos', texto: 'Gastos', Icono: Wallet },
]

export function BarraInferior() {
  return (
    <nav className="nav" aria-label="Navegación principal">
      <div className="nav__lista">
        {PESTANAS.map(({ a, texto, Icono }) => (
          <NavLink key={a} to={a} end={a === '/'} className="nav__item">
            <Icono size={22} strokeWidth={1.8} aria-hidden />
            {texto}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
