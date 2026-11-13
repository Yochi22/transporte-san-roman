const crypto = require('crypto')
const bcrypt = require('bcryptjs')
const prisma = require('../../config/database')
const { normalizarTelefono } = require('../../utils/normalizarTelefono')
const { choferPanelSelect } = require('../../utils/prismaSelects')

const ALFABETO_CLAVE = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

const generarClaveTemporal = () => {
  let clave = ''
  const bytes = crypto.randomBytes(10)
  for (let i = 0; i < 10; i += 1) {
    clave += ALFABETO_CLAVE[bytes[i] % ALFABETO_CLAVE.length]
  }
  return clave
}

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

const normalizarUnidadIds = (datos) => {
  const ids = Array.isArray(datos.unidadIds) ? datos.unidadIds : []
  return [...new Set(ids.filter((id) => typeof id === 'string' && id.trim()).map((id) => id.trim()))]
}

const filtroActivo = (estado) => {
  if (estado === 'todos') return undefined
  if (estado === 'inactivos') return false
  return true
}

const listar = async (filtros = {}) => {
  return prisma.chofer.findMany({
    where: { activo: filtroActivo(filtros.estado) },
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
  const unidadIds = normalizarUnidadIds(datos)
  return prisma.$transaction(async (tx) => {
    const chofer = await tx.chofer.create({
      data: { nombre, cedula, telefono: normalizarTelefono(telefono) },
      select: { id: true }
    })
    await guardarAsignaciones(tx, chofer.id, unidadIds)
    return tx.chofer.findUniqueOrThrow({ where: { id: chofer.id }, select: choferPanelSelect })
  })
}

const actualizar = async (id, datos) => {
  const { nombre, cedula, telefono } = validarDatos(datos, true)
  const unidadIds = normalizarUnidadIds(datos)
  const activo = typeof datos.activo === 'boolean' ? datos.activo : undefined
  const actual = await prisma.chofer.findUniqueOrThrow({
    where: { id },
    select: { telefono: true }
  })
  const telefonoNormalizado = telefono ? normalizarTelefono(telefono) : undefined
  const debeResetearWhatsapp =
    activo === false || (telefonoNormalizado && telefonoNormalizado !== actual.telefono)
  return prisma.$transaction(async (tx) => {
    await tx.chofer.update({
      where: { id },
      data: {
        nombre,
        cedula,
        telefono: telefonoNormalizado,
        activo,
        estado: activo === false ? 'DISPONIBLE' : undefined,
        whatsappChatId: debeResetearWhatsapp ? null : undefined
      }
    })
    if (activo === false) {
      await tx.choferUnidad.deleteMany({ where: { choferId: id } })
    } else {
      await guardarAsignaciones(tx, id, unidadIds)
    }
    return tx.chofer.findUniqueOrThrow({ where: { id }, select: choferPanelSelect })
  })
}

const guardarAsignaciones = async (tx, choferId, unidadIds) => {
  await tx.choferUnidad.deleteMany({ where: { choferId } })
  if (unidadIds.length === 0) return
  const unidadesActivas = await tx.camion.findMany({
    where: { id: { in: unidadIds }, activo: true },
    select: { id: true }
  })
  if (unidadesActivas.length !== unidadIds.length) {
    throw { status: 400, message: 'Una o mas unidades asignadas no existen o no estan activas' }
  }
  const asignacionesExistentes = await tx.choferUnidad.findMany({
    where: {
      camionId: { in: unidadIds },
      choferId: { not: choferId }
    },
    select: {
      camion: { select: { placa: true } },
      chofer: { select: { nombre: true } }
    }
  })
  if (asignacionesExistentes.length > 0) {
    const detalle = asignacionesExistentes
      .map((asignacion) => `${asignacion.camion.placa} esta asignada a ${asignacion.chofer.nombre}`)
      .join(', ')
    throw { status: 409, message: `Primero libera la unidad: ${detalle}` }
  }
  await tx.choferUnidad.createMany({
    data: unidadIds.map((camionId) => ({ choferId, camionId })),
    skipDuplicates: true
  })
}

const inactivar = async (id) => {
  const viajesActivos = await prisma.viaje.count({
    where: { choferId: id, estadoLogistico: 'EN_CURSO' }
  })
  if (viajesActivos > 0) throw { status: 409, message: 'No se puede eliminar un chofer con viajes activos' }
  return prisma.$transaction(async (tx) => {
    await tx.choferUnidad.deleteMany({ where: { choferId: id } })
    await tx.usuario.updateMany({
      where: { choferId: id },
      data: { activo: false, sessionVersion: { increment: 1 } }
    })
    return tx.chofer.update({
      where: { id },
      data: { activo: false, estado: 'DISPONIBLE', whatsappChatId: null }
    })
  })
}

const reactivar = async (id) => {
  return prisma.chofer.update({
    where: { id },
    data: { activo: true },
    select: choferPanelSelect
  })
}

const crearAcceso = async (choferId) => {
  const chofer = await prisma.chofer.findUniqueOrThrow({ where: { id: choferId }, select: { nombre: true, cedula: true, activo: true } })
  if (!chofer.activo) throw { status: 409, message: 'El chofer debe estar activo para crear su acceso' }
  const existente = await prisma.usuario.findUnique({ where: { choferId } })
  if (existente) throw { status: 409, message: 'Este chofer ya tiene acceso creado' }

  const clave = generarClaveTemporal()
  const passwordHash = await bcrypt.hash(clave, 12)
  await prisma.usuario.create({
    data: {
      nombre: chofer.nombre,
      username: chofer.cedula,
      passwordHash,
      rol: 'CHOFER',
      choferId
    }
  })
  return { username: chofer.cedula, claveTemporal: clave }
}

const resetearClaveAcceso = async (choferId) => {
  const usuario = await prisma.usuario.findUnique({ where: { choferId } })
  if (!usuario) throw { status: 404, message: 'Este chofer no tiene acceso creado' }

  const clave = generarClaveTemporal()
  const passwordHash = await bcrypt.hash(clave, 12)
  await prisma.usuario.update({
    where: { choferId },
    data: { passwordHash, activo: true, sessionVersion: { increment: 1 } }
  })
  return { username: usuario.username, claveTemporal: clave }
}

const revocarAcceso = async (choferId) => {
  const usuario = await prisma.usuario.findUnique({ where: { choferId } })
  if (!usuario) throw { status: 404, message: 'Este chofer no tiene acceso creado' }
  return prisma.usuario.update({
    where: { choferId },
    data: { activo: false, sessionVersion: { increment: 1 } },
    select: { id: true, username: true, activo: true }
  })
}

const reactivarAcceso = async (choferId) => {
  const usuario = await prisma.usuario.findUnique({ where: { choferId } })
  if (!usuario) throw { status: 404, message: 'Este chofer no tiene acceso creado' }
  return prisma.usuario.update({
    where: { choferId },
    data: { activo: true },
    select: { id: true, username: true, activo: true }
  })
}

// La eliminacion fisica solo procede si el chofer no tiene historial. Si ya
// tiene viajes, reportes, gastos, retornables o combustible, se debe inactivar:
// borrarlo arrastraria viajes (incluso liquidados) y su trazabilidad.
const eliminar = async (id) => {
  await prisma.chofer.findUniqueOrThrow({ where: { id } })
  const [viajes, reportes, gastos, retornables, controles] = await Promise.all([
    prisma.viaje.count({ where: { choferId: id } }),
    prisma.reporteChofer.count({ where: { choferId: id } }),
    prisma.gasto.count({ where: { choferId: id } }),
    prisma.retornableMovimiento.count({ where: { choferId: id } }),
    prisma.controlCombustible.count({ where: { choferId: id } })
  ])
  if (viajes > 0 || reportes > 0 || gastos > 0 || retornables > 0 || controles > 0) {
    throw { status: 409, message: 'Este chofer tiene historial (viajes, reportes, gastos, retornables o combustible). Inactivalo en lugar de eliminarlo.' }
  }

  return prisma.$transaction(async (tx) => {
    await tx.choferUnidad.deleteMany({ where: { choferId: id } })
    return tx.chofer.delete({ where: { id } })
  })
}

module.exports = {
  listar,
  obtener,
  crear,
  actualizar,
  eliminar,
  inactivar,
  reactivar,
  crearAcceso,
  resetearClaveAcceso,
  revocarAcceso,
  reactivarAcceso
}
