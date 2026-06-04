const { verificarToken } = require('../config/jwt')
const { error } = require('../utils/respuesta')

const autenticar = (req, res, next) => {
  const authHeader = req.headers['authorization']
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return error(res, 'Token requerido', 401)
  }
  const token = authHeader.split(' ')[1]
  try {
    const payload = verificarToken(token)
    req.usuario = payload
    next()
  } catch (e) {
    return error(res, 'Token inválido o expirado', 401)
  }
}

const soloAdmin = (req, res, next) => {
  if (req.usuario?.rol !== 'ADMIN') {
    return error(res, 'Acceso restringido a administradores', 403)
  }
  next()
}

const adminOOperaciones = (req, res, next) => {
  const roles = ['ADMIN', 'OPERACIONES']
  if (!roles.includes(req.usuario?.rol)) {
    return error(res, 'Acceso no autorizado', 403)
  }
  next()
}

module.exports = { autenticar, soloAdmin, adminOOperaciones }