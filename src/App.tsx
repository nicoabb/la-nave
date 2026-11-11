import { Navigate, Route, Routes } from 'react-router-dom'
import { ProveedorAvisos } from './components/Aviso'
import { BarraInferior } from './components/BarraInferior'
import { useVehiculo, VehiculoContexto } from './db/hooks'
import Bienvenida from './pantallas/Bienvenida'
import Inicio from './pantallas/Inicio'
import Gasolina from './pantallas/Gasolina'
import Taller from './pantallas/Taller'
import Cauchos from './pantallas/Cauchos'
import Pendientes from './pantallas/Pendientes'
import Gastos from './pantallas/Gastos'
import Configuracion from './pantallas/Configuracion'

export default function App() {
  const vehiculo = useVehiculo()

  if (vehiculo === undefined) return <div className="app" />
  if (vehiculo === null) {
    return (
      <div className="app">
        <Bienvenida />
      </div>
    )
  }

  return (
    <VehiculoContexto.Provider value={vehiculo}>
      <ProveedorAvisos>
      <div className="app">
        <Routes>
          <Route path="/" element={<Inicio />} />
          <Route path="/gasolina" element={<Gasolina />} />
          <Route path="/taller" element={<Taller />} />
          <Route path="/taller/cauchos" element={<Cauchos />} />
          <Route path="/pendientes" element={<Pendientes />} />
          <Route path="/gastos" element={<Gastos />} />
          <Route path="/configuracion" element={<Configuracion />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <BarraInferior />
      </div>
      </ProveedorAvisos>
    </VehiculoContexto.Provider>
  )
}
