import { useState } from 'react'
import { FormCuenta } from '../components/Cuenta'
import { FormVehiculo } from '../components/FormVehiculo'
import { BotonRestaurar } from '../components/Respaldo'
import { supabase } from '../sync/cliente'
import { useEstadoSync, useSesion } from '../sync/hooks'

/** Primera vez: configurar el vehículo, o entrar a la cuenta para bajar los datos. */
export default function Bienvenida() {
  const sesion = useSesion()
  const estado = useEstadoSync()
  const [entrar, setEntrar] = useState(false)

  // Con sesión y sin vehículo: lo normal es que los datos estén bajando
  if (sesion && (estado === 'sincronizando' || estado === 'sin-sesion')) {
    return (
      <main className="pantalla" style={{ paddingBottom: 40 }}>
        <header style={{ paddingTop: 24 }}>
          <h1 className="titulo">La Nave</h1>
          <p className="subtitulo">Descargando tus datos…</p>
        </header>
      </main>
    )
  }

  return (
    <main className="pantalla" style={{ paddingBottom: 40 }}>
      <header style={{ paddingTop: 24 }}>
        <h1 className="titulo">La Nave</h1>
        <p className="subtitulo">
          {entrar ? 'Entra a tu cuenta para traer tus datos.' : 'Empecemos por tu carro. Todo se puede cambiar después.'}
        </p>
      </header>

      {entrar ? (
        <section className="tarjeta">
          <FormCuenta />
        </section>
      ) : (
        <section className="tarjeta">
          <FormVehiculo />
        </section>
      )}

      <section className="tarjeta" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {supabase && !sesion && (
          <button className="btn btn--bloque" onClick={() => setEntrar(!entrar)}>
            {entrar ? 'Mejor configuro un carro nuevo' : 'Ya tengo cuenta: entrar'}
          </button>
        )}
        <span className="muted mini">¿Tienes un archivo de respaldo?</span>
        <BotonRestaurar />
      </section>
    </main>
  )
}
