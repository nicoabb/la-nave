import { useState, type FormEvent } from 'react'
import { LogOut, RefreshCw } from 'lucide-react'
import { supabase } from '../sync/cliente'
import { useEstadoSync, usePendientesSync, useSesion } from '../sync/hooks'
import { alIniciarSesion, cerrarSesion, leerError, sincronizar } from '../sync/motor'
import { useAviso } from './Aviso'
import { Campo } from './Campo'

function traducir(mensaje: string): string {
  const m = mensaje.toLowerCase()
  if (m.includes('invalid login credentials')) return 'Correo o contraseña incorrectos.'
  if (m.includes('email not confirmed')) return 'Falta confirmar tu correo: revisa tu bandeja de entrada (y el spam).'
  if (m.includes('already registered') || m.includes('already been registered')) return 'Ese correo ya tiene cuenta. Usa «Entrar».'
  if (m.includes('password') && m.includes('6')) return 'La contraseña debe tener al menos 6 caracteres.'
  if (m.includes('signups not allowed') || m.includes('signup is disabled')) return 'La creación de cuentas está desactivada.'
  if (m.includes('fetch') || m.includes('network')) return 'No hay conexión. Inténtalo cuando tengas internet.'
  return mensaje
}

/** Iniciar sesión o crear cuenta (correo y contraseña). */
export function FormCuenta() {
  const avisar = useAviso()
  const [correo, setCorreo] = useState('')
  const [clave, setClave] = useState('')
  const [modo, setModo] = useState<'entrar' | 'crear'>('entrar')
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState('')

  if (!supabase) {
    return <p className="muted mini" style={{ margin: 0 }}>Esta versión de la app no tiene la sincronización configurada.</p>
  }

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!correo.trim() || !clave) return setError('Escribe tu correo y tu contraseña.')
    setOcupado(true)
    try {
      if (modo === 'entrar') {
        const { data, error } = await supabase!.auth.signInWithPassword({ email: correo.trim(), password: clave })
        if (error) return setError(traducir(error.message))
        await alIniciarSesion(data.user.id)
        avisar('Sesión iniciada', 'Tus datos se están sincronizando.')
      } else {
        // El enlace del correo vuelve a la app (no a la raíz del dominio)
        const volverA = window.location.origin + window.location.pathname
        const { data, error } = await supabase!.auth.signUp({
          email: correo.trim(),
          password: clave,
          options: { emailRedirectTo: volverA },
        })
        if (error) return setError(traducir(error.message))
        if (data.session) {
          await alIniciarSesion(data.user!.id)
          avisar('Cuenta creada', 'Tus datos se están subiendo.')
        } else {
          avisar('Revisa tu correo', 'Te enviamos un enlace para confirmar la cuenta. Después vuelve aquí y toca «Entrar».', 'info')
          setModo('entrar')
        }
      }
    } catch (e) {
      setError(traducir(e instanceof Error ? e.message : String(e)))
    } finally {
      setOcupado(false)
    }
  }

  return (
    <form className="form" onSubmit={enviar} noValidate>
      <Campo etiqueta="Correo">
        <input className="input" type="email" autoComplete="email" inputMode="email" value={correo} onChange={(e) => setCorreo(e.target.value)} />
      </Campo>
      <Campo etiqueta="Contraseña" ayuda={modo === 'crear' ? 'Mínimo 6 caracteres' : undefined}>
        <input
          className="input"
          type="password"
          autoComplete={modo === 'crear' ? 'new-password' : 'current-password'}
          value={clave}
          onChange={(e) => setClave(e.target.value)}
        />
      </Campo>
      {error && <p className="error" role="alert">{error}</p>}
      <button type="submit" className="btn btn--primario btn--bloque" disabled={ocupado}>
        {ocupado ? 'Un momento…' : modo === 'entrar' ? 'Entrar' : 'Crear cuenta'}
      </button>
      <button type="button" className="enlace" style={{ alignSelf: 'center', minHeight: 36 }} onClick={() => setModo(modo === 'entrar' ? 'crear' : 'entrar')}>
        {modo === 'entrar' ? '¿No tienes cuenta? Créala' : 'Ya tengo cuenta: entrar'}
      </button>
    </form>
  )
}

/** Sección "Cuenta y sincronización" de Configuración. */
export function SeccionCuenta() {
  const sesion = useSesion()
  const estado = useEstadoSync()
  const pendientes = usePendientesSync()
  const avisar = useAviso()

  if (sesion === undefined) return null
  if (!sesion) {
    return (
      <>
        <span className="muted mini">
          Con una cuenta, tus datos se respaldan en la nube y se sincronizan entre el teléfono y la computadora.
        </span>
        <FormCuenta />
      </>
    )
  }

  return (
    <>
      <span>
        Conectado como <strong>{sesion.user.email}</strong>
      </span>
      <span className="muted mini">
        {estado === 'sincronizando'
          ? 'Sincronizando…'
          : estado === 'error'
            ? `Error al sincronizar: ${leerError()}`
            : estado === 'sin-conexion'
              ? 'Sin conexión: se sincronizará al volver el internet.'
              : pendientes > 0
                ? `${pendientes} ${pendientes === 1 ? 'cambio pendiente' : 'cambios pendientes'} de subir.`
                : 'Todo sincronizado.'}
      </span>
      <button className="btn btn--bloque" onClick={() => sincronizar()} disabled={estado === 'sincronizando'}>
        <RefreshCw size={18} strokeWidth={1.8} /> Sincronizar ahora
      </button>
      <button
        className="btn btn--bloque btn--peligro"
        onClick={async () => {
          if (await cerrarSesion()) {
            avisar('Sesión cerrada')
            window.location.reload()
          }
        }}
      >
        <LogOut size={18} strokeWidth={1.8} /> Cerrar sesión
      </button>
    </>
  )
}
