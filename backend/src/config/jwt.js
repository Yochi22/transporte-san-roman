const jwt = require('jsonwebtoken')

const JWT_SECRET = process.env.JWT_SECRET
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'

const generarToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
}

const verificarToken = (token) => {
  return jwt.verify(token, JWT_SECRET)
}

module.exports = { generarToken, verificarToken }