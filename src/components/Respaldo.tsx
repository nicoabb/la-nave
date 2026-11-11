import { useRef, useState } from 'react'
import { Download, Upload } from 'lucide-react'
import { exportar, restaurar } from '../db/respaldo'

export function BotonExportar() {
  return (
    <button className="btn btn--bloque" onClick={() => exportar()}>
      <Download size={18} strokeWidth={1.8} /> Descargar respaldo (JSON)
    </button>
  )
}

export function BotonRestaurar() {
  const entrada = useRef<HTMLInputElement>(null)
  const [mensaje, setMensaje] = useState('')

  async function alElegir(archivo: File | undefined) {
    if (!archivo) return
    try {
      const n = await restaurar(archivo)
      setMensaje(n ? `Listo: se restauraron ${n} registros.` : 'No había nada nuevo en ese respaldo.')
    } catch (e) {
      setMensaje(e instanceof Error && e.message.includes('La Nave') ? e.message : 'No se pudo leer el archivo.')
    } finally {
      if (entrada.current) entrada.current.value = ''
    }
  }

  return (
    <>
      <input ref={entrada} type="file" accept="application/json,.json" hidden onChange={(e) => alElegir(e.target.files?.[0])} />
      <button className="btn btn--bloque" onClick={() => entrada.current?.click()}>
        <Upload size={18} strokeWidth={1.8} /> Restaurar desde un respaldo
      </button>
      {mensaje && <p className="muted mini" role="status" style={{ margin: 0 }}>{mensaje}</p>}
    </>
  )
}
