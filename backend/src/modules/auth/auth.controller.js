const { login } = require('./auth.service')
const { ok, error } = require('../../utils/respuesta')
const { SESSION_COOKIE_NAME, sessionCookieOptions, CHOFER_SESSION_MAX_AGE_MS } = require('../../config/session')
const prisma = require('../../config/database')

const loginController = async (req, res) => {
  const { email, password } = req.body

  if (
    typeof email !== 'string' ||
    typeof password !== 'string' ||
    email.length > 254 ||
    password.length < 8 ||
    password.length > 128
  ) {
    return error(res, 'Credenciales inválidas', 400)
  }

  const resultado = await login(email, password)
  const opciones = resultado.esChofer
    ? sessionCookieOptions({ maxAgeMs: CHOFER_SESSION_MAX_AGE_MS })
    : sessionCookieOptions()
  res.cookie(SESSION_COOKIE_NAME, resultado.token, opciones)
  return ok(res, { usuario: resultado.usuario }, 'Login exitoso')
}

const perfil = async (req, res) => ok(res, req.usuario, 'Perfil del usuario autenticado')

const logout = async (req, res) => {
  await prisma.usuario.update({
    where: { id: req.usuario.id },
    data: { sessionVersion: { increment: 1 } }
  })
  const opciones = sessionCookieOptions()
  delete opciones.maxAge
  res.clearCookie(SESSION_COOKIE_NAME, opciones)
  return ok(res, null, 'Sesión cerrada')
}

module.exports = { loginController, perfil, logout }
