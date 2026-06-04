const { error } = require('../utils/respuesta')

const manejarErrores = (err, req, res, next) => {
  console.error(`[ERROR] ${req.method} ${req.path}:`, err.message)

  if (err.name === 'ZodError') {
    return error(res, 'Datos inválidos', 422, err.errors)
  }

  if (err.code === 'P2002') {
    return error(res, 'Ya existe un registro con esos datos', 409)
  }

  if (err.code === 'P2025') {
    return error(res, 'Registro no encontrado', 404)
  }

  return error(res, err.message || 'Error interno del servidor', err.status || 500)
}

module.exports = { manejarErrores }