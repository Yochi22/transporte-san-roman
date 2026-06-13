const { error } = require('../utils/respuesta')

const manejarErrores = (err, req, res, next) => {
  const detalle = {
    name: err.name,
    code: err.code
  }
  if (process.env.NODE_ENV !== 'production') detalle.message = err.message
  console.error(`[ERROR] ${req.method} ${req.path}:`, detalle)

  if (err.code === 'P2002') {
    return error(res, 'Ya existe un registro con esos datos', 409)
  }

  if (err.code === 'P2025') {
    return error(res, 'Registro no encontrado', 404)
  }

  if (err.status && err.status < 500) {
    return error(res, err.message, err.status)
  }

  return error(res, 'Error interno del servidor', 500)
}

module.exports = { manejarErrores }
