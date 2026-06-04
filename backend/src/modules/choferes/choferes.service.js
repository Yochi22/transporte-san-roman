const prisma = require('../../config/database')
const { normalizarTelefono } = require('../../utils/normalizarTelefono')

const listar = async () => {
  return prisma.chofer.findMany({
    where: { activo: true },
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
  const viajesActivos = await prisma.viaje.count({
    where: { choferId: id, estadoLogistico: 'EN_CURSO' }
  })
  if (viajesActivos > 0) throw { status: 409, message: 'No se puede eliminar un chofer con viajes activos' }
  return prisma.chofer.update({
    where: { id },
    data: { activo: false, estado: 'DISPONIBLE', whatsappChatId: null }
  })
}

module.exports = { listar, obtener, crear, actualizar, eliminar }
