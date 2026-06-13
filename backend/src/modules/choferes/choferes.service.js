const prisma = require('../../config/database')
const { normalizarTelefono } = require('../../utils/normalizarTelefono')
const { choferPanelSelect } = require('../../utils/prismaSelects')

const validarDatos = (datos, parcial = false) => {
  const nombre = datos.nombre?.trim()
  const cedula = datos.cedula?.trim()
  const telefono = datos.telefono?.trim()

  if (!parcial && (!nombre || !cedula || !telefono)) {
    throw { status: 400, message: 'Nombre, cedula y telefono son requeridos' }
  }
  if (nombre !== undefined && (nombre.length < 2 || nombre.length > 120)) {
    throw { status: 400, message: 'Nombre invalido' }
  }
  if (cedula !== undefined && (cedula.length < 5 || cedula.length > 20)) {
    throw { status: 400, message: 'Cedula invalida' }
  }
  if (telefono !== undefined && (telefono.length < 7 || telefono.length > 20)) {
    throw { status: 400, message: 'Telefono invalido' }
  }

  return { nombre, cedula, telefono }
}

const listar = async () => {
  return prisma.chofer.findMany({
    where: { activo: true },
    select: choferPanelSelect,
    orderBy: { nombre: 'asc' },
    take: 500
  })
}

const obtener = async (id) => {
  return prisma.chofer.findUniqueOrThrow({
    where: { id },
    select: choferPanelSelect
  })
}

const crear = async (datos) => {
  const { nombre, cedula, telefono } = validarDatos(datos)
  return prisma.chofer.create({
    data: { nombre, cedula, telefono: normalizarTelefono(telefono) },
    select: choferPanelSelect
  })
}

const actualizar = async (id, datos) => {
  const { nombre, cedula, telefono } = validarDatos(datos, true)
  const actual = await prisma.chofer.findUniqueOrThrow({
    where: { id },
    select: { telefono: true }
  })
  const telefonoNormalizado = telefono ? normalizarTelefono(telefono) : undefined
  return prisma.chofer.update({
    where: { id },
    data: {
      nombre,
      cedula,
      telefono: telefonoNormalizado,
      whatsappChatId: telefonoNormalizado && telefonoNormalizado !== actual.telefono ? null : undefined
    },
    select: choferPanelSelect
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
