const jwt = require('jsonwebtoken')

const JWT_SECRET = process.env.JWT_SECRET
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h'
const JWT_OPTIONS = {
  algorithm: 'HS256',
  issuer: 'transporte-san-roman',
  audience: 'panel-operativo'
}

const generarToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, { ...JWT_OPTIONS, expiresIn: JWT_EXPIRES_IN })
}

const verificarToken = (token) => {
  return jwt.verify(token, JWT_SECRET, JWT_OPTIONS)
}

module.exports = { generarToken, verificarToken }
