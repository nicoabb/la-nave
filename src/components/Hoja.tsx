import { useEffect, type ReactNode } from 'react'

/** Hoja inferior (bottom sheet) reutilizable. */
export function Hoja({ titulo, onCerrar, children }: { titulo: string; onCerrar: () => void; children: ReactNode }) {
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar()
    window.addEventListener('keydown', tecla)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', tecla)
      document.body.style.overflow = overflow
    }
  }, [onCerrar])

  return (
    <div className="hoja-fondo" onClick={onCerrar}>
      <div className="hoja" role="dialog" aria-modal="true" aria-label={titulo} onClick={(e) => e.stopPropagation()}>
        <div className="hoja__agarre" />
        <h2 className="titulo-seccion" style={{ marginBottom: 4 }}>{titulo}</h2>
        {children}
      </div>
    </div>
  )
}
