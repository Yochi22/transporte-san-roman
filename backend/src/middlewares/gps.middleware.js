const { error } = require('../utils/respuesta')

const protegerWebhookGps = (req, res, next) => {
  const token = process.env.GPS_WEBHOOK_TOKEN
  if (!token && process.env.NODE_ENV !== 'production') return next()
  if (!token) return error(res, 'GPS_WEBHOOK_TOKEN requerido', 500)

  const recibido = req.get('X-GPS-Token') || req.get('Authorization')?.replace(/^Bearer\s+/i, '') || req.query.token
  if (recibido !== token) return error(res, 'Webhook GPS no autorizado', 401)
  return next()
}

module.exports = { protegerWebhookGps }
