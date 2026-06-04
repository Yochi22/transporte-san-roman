const { login } = require('./auth.service')
const { ok, error } = require('../../utils/respuesta')

const loginController = async (req, res) => {
  const { email, password } = req.body

  if (!email || !password) {
    return error(res, 'Email y password son requeridos', 400)
  }

  const resultado = await login(email, password)
  return ok(res, resultado, 'Login exitoso')
}

const perfil = async (req, res) => {
  return ok(res, req.usuario, 'Perfil del usuario autenticado')
}

module.exports = { loginController, perfil }