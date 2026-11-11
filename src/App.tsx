import { Navigate, Route, Routes } from 'react-router-dom'
import { BarraInferior } from './components/BarraInferior'
import Inicio from './pantallas/Inicio'
import Gasolina from './pantallas/Gasolina'
import Taller from './pantallas/Taller'
import Cauchos from './pantallas/Cauchos'
import Pendientes from './pantallas/Pendientes'
import Gastos from './pantallas/Gastos'

export default function App() {
  return (
    <div className="app">
      <Routes>
        <Route path="/" element={<Inicio />} />
        <Route path="/gasolina" element={<Gasolina />} />
        <Route path="/taller" element={<Taller />} />
        <Route path="/taller/cauchos" element={<Cauchos />} />
        <Route path="/pendientes" element={<Pendientes />} />
        <Route path="/gastos" element={<Gastos />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <BarraInferior />
    </div>
  )
}
