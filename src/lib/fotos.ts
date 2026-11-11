// Compresión de fotos en el cliente — SPEC.md §1 (Fotos).

const aBlob = (c: HTMLCanvasElement, calidad: number) =>
  new Promise<Blob>((ok, mal) => c.toBlob((b) => (b ? ok(b) : mal(new Error('No se pudo comprimir'))), 'image/webp', calidad))

/** Máximo 1280 px por lado, WebP ~0,7, buscando quedar bajo 250 KB. */
export async function comprimirFoto(archivo: File, max = 1280, calidad = 0.7): Promise<Blob> {
  const imagen = await createImageBitmap(archivo)
  const escala = Math.min(1, max / Math.max(imagen.width, imagen.height))
  const lienzo = document.createElement('canvas')
  lienzo.width = Math.round(imagen.width * escala)
  lienzo.height = Math.round(imagen.height * escala)
  lienzo.getContext('2d')!.drawImage(imagen, 0, 0, lienzo.width, lienzo.height)
  imagen.close()

  let q = calidad
  let blob = await aBlob(lienzo, q)
  while (blob.size > 250_000 && q > 0.35) {
    q -= 0.1
    blob = await aBlob(lienzo, q)
  }
  return blob
}
