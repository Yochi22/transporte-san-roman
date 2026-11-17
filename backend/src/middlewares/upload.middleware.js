const multer = require('multer')
const { error } = require('../utils/respuesta')

// La app del chofer ya comprime la foto en el telefono antes de subirla
// (canvas, calidad reducida). Este tope es la ultima linea de defensa en el
// servidor: si algo llega mas pesado que esto, se rechaza antes de escribir
// nada a disco, no se intenta comprimir aqui.
const LIMITE_RELACION_GASTOS_BYTES = 1_200_000
const TIPOS_IMAGEN_PERMITIDOS = new Set(['image/jpeg', 'image/png', 'image/webp'])

const subidaRelacionGastos = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: LIMITE_RELACION_GASTOS_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    if (!TIPOS_IMAGEN_PERMITIDOS.has(file.mimetype)) {
      return cb({ status: 400, message: 'Solo se aceptan imagenes JPEG, PNG o WEBP' })
    }
    cb(null, true)
  }
}).single('imagen')

// Envuelve multer para que sus errores pasen por el formato de error normal
// de la API (y no revienten como excepcion sin manejar).
const manejarSubidaRelacionGastos = (req, res, next) => {
  subidaRelacionGastos(req, res, (err) => {
    if (!err) return next()
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return error(res, `La imagen supera el limite de ${Math.round(LIMITE_RELACION_GASTOS_BYTES / 1024)} KB`, 413)
    }
    return error(res, err.message || 'No se pudo procesar la imagen', err.status || 400)
  })
}

module.exports = { manejarSubidaRelacionGastos, TIPOS_IMAGEN_PERMITIDOS }
