// Comprime una foto en el navegador antes de subirla, sin que el chofer
// tenga que hacer nada: la redimensiona y la reexporta como JPEG bajando la
// calidad hasta que quede por debajo del tope, o lanza un error claro si ni
// asi entra (foto absurdamente grande/compleja).
const DIMENSION_MAXIMA = 1600
const CALIDADES = [0.7, 0.5, 0.35, 0.2]

const cargarImagen = (archivo) => new Promise((resolve, reject) => {
  const img = new Image()
  img.onload = () => resolve(img)
  img.onerror = () => reject(new Error('No se pudo leer la imagen'))
  img.src = URL.createObjectURL(archivo)
})

const canvasABlob = (canvas, calidad) => new Promise((resolve) => {
  canvas.toBlob((blob) => resolve(blob), 'image/jpeg', calidad)
})

export const comprimirImagen = async (archivo, { maxBytes = 800 * 1024 } = {}) => {
  const img = await cargarImagen(archivo)
  const escala = Math.min(1, DIMENSION_MAXIMA / Math.max(img.width, img.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.width * escala)
  canvas.height = Math.round(img.height * escala)
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  URL.revokeObjectURL(img.src)

  let resultado = null
  for (const calidad of CALIDADES) {
    const blob = await canvasABlob(canvas, calidad)
    if (!blob) continue
    resultado = blob
    if (blob.size <= maxBytes) break
  }

  if (!resultado) throw new Error('No se pudo procesar la foto')
  if (resultado.size > maxBytes) {
    throw new Error('La foto es demasiado pesada incluso comprimida. Intenta con otra toma.')
  }
  return resultado
}
