const bcrypt = require('bcryptjs')
const prisma = require('../../config/database')

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
  const { nombre, email, password, rol } = datos
  const passwordHash = await bcrypt.hash(password, 10)

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
  const { nombre, email, rol } = datos

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

const desactivar = async (id) => {
  return prisma.usuario.update({
    where: { id },
    data: { activo: false },
  })
}

module.exports = { listar, crear, actualizar, desactivar }