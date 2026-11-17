const fs = require('fs/promises')
const path = require('path')
const crypto = require('crypto')

// Las fotos de la relacion de gastos viven en disco, no en la base de datos
// (bytea inflaria Postgres con imagenes). La base solo guarda el nombre de
// archivo; esta carpeta es un volumen de Docker montado aparte (ver
// docker-compose.yml), igual que .whatsapp-auth.
const DIRECTORIO = process.env.RELACION_GASTOS_PATH || path.resolve(__dirname, '../../.relacion-gastos')

const EXTENSION_POR_MIME = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp'
}

const CONTENT_TYPE_POR_EXTENSION = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp'
}

const asegurarDirectorio = async () => {
  await fs.mkdir(DIRECTORIO, { recursive: true })
}

// Nombre generado por el servidor (nunca el del cliente): evita path
// traversal y cualquier caracter raro en el nombre original de la foto.
const guardarArchivo = async (buffer, mimetype) => {
  const extension = EXTENSION_POR_MIME[mimetype]
  if (!extension) throw { status: 400, message: 'Tipo de imagen no soportado' }
  await asegurarDirectorio()
  const nombreArchivo = `${crypto.randomUUID()}.${extension}`
  await fs.writeFile(path.join(DIRECTORIO, nombreArchivo), buffer)
  return nombreArchivo
}

const rutaCompleta = (nombreArchivo) => path.join(DIRECTORIO, nombreArchivo)

const contentTypeDeArchivo = (nombreArchivo) => {
  const extension = nombreArchivo.split('.').pop().toLowerCase()
  return CONTENT_TYPE_POR_EXTENSION[extension] || 'application/octet-stream'
}

// Nunca falla si el archivo ya no existe: la depuracion automatica puede
// correr dos veces sobre el mismo registro sin romperse.
const eliminarArchivo = async (nombreArchivo) => {
  if (!nombreArchivo) return
  await fs.unlink(rutaCompleta(nombreArchivo)).catch((err) => {
    if (err.code !== 'ENOENT') throw err
  })
}

module.exports = { guardarArchivo, rutaCompleta, contentTypeDeArchivo, eliminarArchivo }
