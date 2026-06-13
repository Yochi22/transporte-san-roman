const bcrypt = require('bcryptjs')
const prisma = require('../../config/database')
const { generarToken } = require('../../config/jwt')

const HASH_FALSO = '$2b$10$8VEqvDgZgVTTpNQWut9NuO9t0rf6F9vraYy5caLWh6KcbA6W7VtdK'

const login = async (email, password) => {
  const emailNormalizado = email.trim().toLowerCase()
  const usuario = await prisma.usuario.findUnique({
    where: { email: emailNormalizado }
  })

  const passwordValido = await bcrypt.compare(password, usuario?.passwordHash || HASH_FALSO)
  if (!usuario?.activo || !passwordValido) {
    throw { status: 401, message: 'Credenciales inválidas' }
  }

  console.log('[AUTH] Login exitoso')

  const token = generarToken({
    id: usuario.id,
    sessionVersion: usuario.sessionVersion
  })

  return {
    token,
    usuario: {
      id: usuario.id,
      nombre: usuario.nombre,
      email: usuario.email,
      rol: usuario.rol
    }
  }
}

const crearUsuarioInicial = async () => {
  const email = (process.env.ADMIN_EMAIL || 'admin@sanroman.com').trim().toLowerCase()
  const existente = await prisma.usuario.findUnique({ where: { email } })

  if (existente && process.env.ADMIN_RESET_PASSWORD !== 'true') {
    console.log('Usuario administrador verificado')
    return
  }

  const password = process.env.ADMIN_PASSWORD
  if (!password) {
    if (!existente) {
      console.warn('ADMIN_PASSWORD no configurada; no se creó el usuario administrador inicial.')
    }
    return
  }

  if (password.length < 12) {
    throw new Error('ADMIN_PASSWORD debe tener al menos 12 caracteres')
  }

  const passwordHash = await bcrypt.hash(password, 12)

  await prisma.usuario.upsert({
    where: { email },
    update: { passwordHash, activo: true, sessionVersion: { increment: 1 } },
    create: {
      nombre: process.env.ADMIN_NAME || 'Administrador',
      email,
      passwordHash,
      rol: 'ADMIN'
    }
  })

  console.log('Usuario administrador preparado')
}

module.exports = { login, crearUsuarioInicial }
