const bcrypt = require('bcryptjs')
const prisma = require('../../config/database')
const ROLES = new Set(['ADMIN', 'OPERACIONES'])

const selectUsuario = {
  id: true,
  nombre: true,
  email: true,
  rol: true,
  activo: true,
  createdAt: true,
  updatedAt: true,
}

const validarUsuario = (datos, requierePassword = false) => {
  const nombre = datos.nombre?.trim()
  const email = datos.email?.trim().toLowerCase()
  const rol = datos.rol
  const password = typeof datos.password === 'string' ? datos.password : ''

  if (!nombre || nombre.length < 2 || nombre.length > 120) {
    throw { status: 400, message: 'Nombre invalido' }
  }
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw { status: 400, message: 'Correo invalido' }
  }
  if (!ROLES.has(rol)) throw { status: 400, message: 'Rol invalido' }
  if ((requierePassword || password) && (password.length < 12 || password.length > 128)) {
    throw { status: 400, message: 'La clave debe tener entre 12 y 128 caracteres' }
  }

  return { nombre, email, rol, password }
}

const listar = async (filtros = {}) => {
  const where = { rol: { not: 'CHOFER' } }
  if (filtros.estado === 'inactivos') where.activo = false
  else if (filtros.estado !== 'todos') where.activo = true

  return prisma.usuario.findMany({
    where,
    select: selectUsuario,
    orderBy: [{ activo: 'desc' }, { nombre: 'asc' }],
  })
}

const crear = async (datos) => {
  const { nombre, email, rol, password } = validarUsuario(datos, true)
  const passwordHash = await bcrypt.hash(password, 12)

  return prisma.usuario.create({
    data: { nombre, email, passwordHash, rol, activo: true },
    select: selectUsuario,
  })
}

const validarCambioAdmin = async (usuario, nuevoRol, usuarioActualId) => {
  if (usuario.id === usuarioActualId && nuevoRol !== 'ADMIN') {
    throw { status: 409, message: 'No puedes quitarte tu propio rol administrador' }
  }
  if (usuario.rol === 'ADMIN' && nuevoRol !== 'ADMIN') {
    const administradores = await prisma.usuario.count({ where: { rol: 'ADMIN', activo: true, id: { not: usuario.id } } })
    if (administradores < 1) {
      throw { status: 409, message: 'No se puede dejar el sistema sin administradores activos' }
    }
  }
}

const actualizar = async (id, datos, usuarioActualId) => {
  const actual = await prisma.usuario.findUniqueOrThrow({ where: { id } })
  const { nombre, email, rol, password } = validarUsuario(datos)
  await validarCambioAdmin(actual, rol, usuarioActualId)

  const data = { nombre, email, rol }
  if (password) {
    data.passwordHash = await bcrypt.hash(password, 12)
    data.sessionVersion = { increment: 1 }
  }

  return prisma.usuario.update({
    where: { id },
    data,
    select: selectUsuario,
  })
}

const desactivar = async (id, usuarioActualId) => {
  if (id === usuarioActualId) {
    throw { status: 409, message: 'No puedes desactivar tu propio usuario' }
  }

  const usuario = await prisma.usuario.findUniqueOrThrow({ where: { id } })
  if (usuario.rol === 'ADMIN') {
    const administradores = await prisma.usuario.count({ where: { rol: 'ADMIN', activo: true, id: { not: id } } })
    if (administradores < 1) {
      throw { status: 409, message: 'No se puede desactivar al ultimo administrador' }
    }
  }

  return prisma.usuario.update({
    where: { id },
    data: { activo: false, sessionVersion: { increment: 1 } },
    select: selectUsuario,
  })
}

const reactivar = async (id) => {
  return prisma.usuario.update({
    where: { id },
    data: { activo: true },
    select: selectUsuario,
  })
}

module.exports = { listar, crear, actualizar, desactivar, reactivar }
