import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { CircleCheck, Info } from 'lucide-react'

type Tono = 'ok' | 'info'
interface AvisoDatos {
  titulo: string
  detalle?: string
  tono: Tono
  id: number
}
type Mostrar = (titulo: string, detalle?: string, tono?: Tono) => void

const Contexto = createContext<Mostrar>(() => {})

/** Aviso flotante (toast) que confirma acciones: "Carga guardada", etc. */
export function ProveedorAvisos({ children }: { children: ReactNode }) {
  const [aviso, setAviso] = useState<AvisoDatos | null>(null)
  const temporizador = useRef<number | undefined>(undefined)

  const mostrar = useCallback<Mostrar>((titulo, detalle, tono = 'ok') => {
    window.clearTimeout(temporizador.current)
    setAviso({ titulo, detalle, tono, id: Date.now() })
    temporizador.current = window.setTimeout(() => setAviso(null), tono === 'info' ? 7000 : 4500)
  }, [])

  const Icono = aviso?.tono === 'info' ? Info : CircleCheck
  return (
    <Contexto.Provider value={mostrar}>
      {children}
      {aviso && (
        <div key={aviso.id} className={`toast toast--${aviso.tono}`} role="status" onClick={() => setAviso(null)}>
          <Icono size={20} strokeWidth={2} aria-hidden style={{ flexShrink: 0 }} />
          <span>
            <strong style={{ display: 'block' }}>{aviso.titulo}</strong>
            {aviso.detalle}
          </span>
        </div>
      )}
    </Contexto.Provider>
  )
}

export const useAviso = () => useContext(Contexto)
