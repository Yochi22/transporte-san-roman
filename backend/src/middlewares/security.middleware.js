const { rateLimit, ipKeyGenerator } = require('express-rate-limit')
const { error } = require('../utils/respuesta')
const { verificarToken } = require('../config/jwt')
const { SESSION_COOKIE_NAME } = require('../config/session')

// Con sesion valida el cupo es por usuario, no por IP: varios operadores en
// la misma oficina (misma IP publica) no se agotan el limite entre si. Solo
// una cookie con firma valida cambia la clave; cualquier otra cosa sigue
// contando por IP, asi un atacante no puede inventar cookies para saltarse
// el limite.
const identidadLimite = (req) => {
  if (req.identidadLimite) return req.identidadLimite
  let identidad = null
  const token = req.cookies?.[SESSION_COOKIE_NAME]
  if (token) {
    try {
      const payload = verificarToken(token)
      if (payload?.id) identidad = { clave: `usuario:${payload.id}`, autenticado: true }
    } catch {
      // token invalido o vencido: cae al limite por IP
    }
  }
  req.identidadLimite = identidad || { clave: ipKeyGenerator(req.ip), autenticado: false }
  return req.identidadLimite
}

// Un usuario con sesion valida es trafico legitimo del panel: el refresco
// automatico (8 llamadas cada 30 s) mas el estado de WhatsApp, varias
// pestanas y los refrescos que disparan los reportes de los choferes superan
// con facilidad 500 en 15 min. El cupo autenticado solo debe frenar abuso
// real; el anonimo (login/perfil sin sesion) si se mantiene corto.
const LIMITE_AUTENTICADO = 3000
const LIMITE_ANONIMO = 300

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: (req) => (identidadLimite(req).autenticado ? LIMITE_AUTENTICADO : LIMITE_ANONIMO),
  keyGenerator: (req) => identidadLimite(req).clave,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { ok: false, mensaje: 'Demasiadas solicitudes. Intenta nuevamente más tarde.', detalle: null }
})

// El webhook GPS es trafico de maquina (Traccar reenvia cada posicion de la
// flota) y ya va protegido por token. Fuera del limite general para que una
// flota mediana no agote el cupo ni se pierdan posiciones; con un tope alto
// propio solo para frenar abuso.
const gpsWebhookLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20000,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { ok: false, mensaje: 'Demasiadas posiciones GPS. Intenta nuevamente más tarde.', detalle: null }
})

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { ok: false, mensaje: 'Demasiados intentos de acceso. Espera 15 minutos.', detalle: null }
})

// Unica excepcion: la subida de la foto de relacion de gastos va como
// multipart/form-data (multer), no JSON. El resto de la API sigue exigiendo
// JSON estricto.
const RUTA_SUBIDA_RELACION_GASTOS = /^\/mi\/viaje\/[^/]+\/relacion-gastos$/

const requerirJson = (req, res, next) => {
  if (RUTA_SUBIDA_RELACION_GASTOS.test(req.path)) return next()
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

module.exports = { apiLimiter, gpsWebhookLimiter, loginLimiter, requerirJson, protegerCsrf }
