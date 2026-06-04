const bcrypt = require('bcryptjs')
const prisma = require('../../config/database')
const { generarToken } = require('../../config/jwt')

const login = async (email, password) => {
  const usuario = await prisma.usuario.findUnique({
    where: { email },
  })

  if (!usuario) {
    console.log(`[AUTH] Intento fallido: El usuario ${email} no existe.`);
    throw { status: 401, message: 'Credenciales inválidas' }
  }

  if (!usuario.activo) {
    console.log(`[AUTH] Intento fallido: El usuario ${email} está desactivado.`);
    throw { status: 401, message: 'Usuario desactivado' }
  }

  const passwordValido = await bcrypt.compare(password, usuario.passwordHash)
  if (!passwordValido) {
    console.log(`[AUTH] Intento fallido: Clave incorrecta para ${email}.`);
    throw { status: 401, message: 'Credenciales inválidas' }
  }

  console.log(`[AUTH] Login exitoso: ${email}`);

  const token = generarToken({
    id: usuario.id,
    nombre: usuario.nombre,
    email: usuario.email,
    rol: usuario.rol,
  })

  return {
    token,
    usuario: {
      id: usuario.id,
      nombre: usuario.nombre,
      email: usuario.email,
      rol: usuario.rol,
    },
  }
}

const crearUsuarioInicial = async () => {
  const email = process.env.ADMIN_EMAIL || 'admin@sanroman.com'
  const existente = await prisma.usuario.findUnique({ where: { email } })

  if (existente && process.env.ADMIN_RESET_PASSWORD !== 'true') {
    console.log(`Usuario administrador verificado: ${email}`)
    return
  }

  const password = process.env.ADMIN_PASSWORD
  if (!password) {
    if (!existente) {
      console.warn('ADMIN_PASSWORD no configurada; no se creo el usuario administrador inicial.')
    }
    return
  }

  const passwordHash = await bcrypt.hash(password, 10)

  await prisma.usuario.upsert({
    where: { email },
    update: { passwordHash },
    create: {
      nombre: process.env.ADMIN_NAME || 'Administrador',
      email,
      passwordHash,
      rol: 'ADMIN',
    },
  })

  console.log(`Usuario administrador preparado: ${email}`)
}

module.exports = { login, crearUsuarioInicial }
