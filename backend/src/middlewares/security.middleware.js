const { rateLimit } = require('express-rate-limit')
const { error } = require('../utils/respuesta')

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 500,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { ok: false, mensaje: 'Demasiadas solicitudes. Intenta nuevamente más tarde.', detalle: null }
})

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { ok: false, mensaje: 'Demasiados intentos de acceso. Espera 15 minutos.', detalle: null }
})

const requerirJson = (req, res, next) => {
  const tieneCuerpo = Number(req.headers['content-length'] || 0) > 0 || req.headers['transfer-encoding']
  if (['POST', 'PUT', 'PATCH'].includes(req.method) && tieneCuerpo && !req.is('application/json')) {
    return error(res, 'Content-Type debe ser application/json', 415)
  }
  next()
}

const protegerCsrf = (req, res, next) => {
  if (
    ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) &&
    req.get('X-Requested-With') !== 'XMLHttpRequest'
  ) {
    return error(res, 'Solicitud no permitida', 403)
  }
  next()
}

module.exports = { apiLimiter, loginLimiter, requerirJson, protegerCsrf }
