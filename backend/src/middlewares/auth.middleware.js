const { verificarToken } = require('../config/jwt')
const prisma = require('../config/database')
const { error } = require('../utils/respuesta')
const { SESSION_COOKIE_NAME } = require('../config/session')

const autenticar = async (req, res, next) => {
  const token = req.cookies?.[SESSION_COOKIE_NAME]

  if (!token) {
    return error(res, 'Token requerido', 401)
  }

  try {
    const payload = verificarToken(token)
    const usuario = await prisma.usuario.findUnique({
      where: { id: payload.id },
      select: { id: true, nombre: true, email: true, rol: true, activo: true, sessionVersion: true }
    })

    if (!usuario?.activo || usuario.sessionVersion !== payload.sessionVersion) {
      return error(res, 'Sesión no válida', 401)
    }

    const { sessionVersion, ...usuarioSeguro } = usuario
    req.usuario = usuarioSeguro
    next()
  } catch {
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
  if (!['ADMIN', 'OPERACIONES'].includes(req.usuario?.rol)) {
    return error(res, 'Acceso no autorizado', 403)
  }
  next()
}

module.exports = { autenticar, soloAdmin, adminOOperaciones }
