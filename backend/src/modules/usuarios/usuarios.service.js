const bcrypt = require('bcryptjs')
const prisma = require('../../config/database')
const ROLES = new Set(['ADMIN', 'OPERACIONES'])

const validarUsuario = (datos, requierePassword = false) => {
  const nombre = datos.nombre?.trim()
  const email = datos.email?.trim().toLowerCase()
  const rol = datos.rol

  if (!nombre || nombre.length < 2 || nombre.length > 120) {
    throw { status: 400, message: 'Nombre invalido' }
  }
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw { status: 400, message: 'Correo invalido' }
  }
  if (!ROLES.has(rol)) throw { status: 400, message: 'Rol invalido' }
  if (requierePassword && (typeof datos.password !== 'string' || datos.password.length < 12 || datos.password.length > 128)) {
    throw { status: 400, message: 'La clave debe tener entre 12 y 128 caracteres' }
  }

  return { nombre, email, rol }
}

const listar = async () => {
  return prisma.usuario.findMany({
    where: { activo: true },
    select: {
      id: true,
      nombre: true,
      email: true,
      rol: true,
      activo: true,
      createdAt: true,
    },
    orderBy: { nombre: 'asc' },
  })
}

const crear = async (datos) => {
  const { nombre, email, rol } = validarUsuario(datos, true)
  const passwordHash = await bcrypt.hash(datos.password, 12)

  return prisma.usuario.create({
    data: { nombre, email, passwordHash, rol },
    select: {
      id: true,
      nombre: true,
      email: true,
      rol: true,
      createdAt: true,
    },
  })
}

const actualizar = async (id, datos) => {
  const { nombre, email, rol } = validarUsuario(datos)

  return prisma.usuario.update({
    where: { id },
    data: { nombre, email, rol },
    select: {
      id: true,
      nombre: true,
      email: true,
      rol: true,
    },
  })
}

const desactivar = async (id, usuarioActualId) => {
  if (id === usuarioActualId) {
    throw { status: 409, message: 'No puedes desactivar tu propio usuario' }
  }

  const usuario = await prisma.usuario.findUniqueOrThrow({ where: { id } })
  if (usuario.rol === 'ADMIN') {
    const administradores = await prisma.usuario.count({ where: { rol: 'ADMIN', activo: true } })
    if (administradores <= 1) {
      throw { status: 409, message: 'No se puede desactivar al ultimo administrador' }
    }
  }

  return prisma.usuario.update({
    where: { id },
    data: { activo: false },
  })
}

module.exports = { listar, crear, actualizar, desactivar }
