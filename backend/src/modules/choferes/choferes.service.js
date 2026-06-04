const prisma = require('../../config/database')
const { normalizarTelefono } = require('../../utils/normalizarTelefono')

const listar = async () => {
  return prisma.chofer.findMany({
    orderBy: { nombre: 'asc' }
  })
}

const obtener = async (id) => {
  return prisma.chofer.findUniqueOrThrow({
    where: { id }
  })
}

const crear = async (datos) => {
  const { nombre, cedula, telefono } = datos
  return prisma.chofer.create({
    data: { nombre, cedula, telefono: normalizarTelefono(telefono) }
  })
}

const actualizar = async (id, datos) => {
  const { nombre, cedula, telefono, estado, ubicacionActual } = datos
  return prisma.chofer.update({
    where: { id },
    data: {
      nombre,
      cedula,
      telefono: telefono ? normalizarTelefono(telefono) : undefined,
      estado,
      ubicacionActual
    }
  })
}

const eliminar = async (id) => {
  const viajes = await prisma.viaje.count({ where: { choferId: id } })
  if (viajes > 0) throw { status: 409, message: 'No se puede eliminar un chofer con viajes registrados' }
  return prisma.chofer.delete({ where: { id } })
}

module.exports = { listar, obtener, crear, actualizar, eliminar }
