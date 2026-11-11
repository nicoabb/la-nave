import { useEffect } from 'react'
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
import Tareas from './pantallas/Tareas'
import Visita from './pantallas/Visita'
import Revision from './pantallas/Revision'
import { asegurarTareas } from './db/siembra'

export default function App() {
  const vehiculo = useVehiculo()

  useEffect(() => {
    if (vehiculo) asegurarTareas(vehiculo).catch(console.error)
  }, [vehiculo?.id]) // eslint-disable-line react-hooks/exhaustive-deps

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
          <Route path="/configuracion/tareas" element={<Tareas />} />
          <Route path="/taller/visita/nueva" element={<Visita />} />
          <Route path="/taller/visita/:id" element={<Visita />} />
          <Route path="/revision/:ref" element={<Revision />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <BarraInferior />
      </div>
      </ProveedorAvisos>
    </VehiculoContexto.Provider>
  )
}
