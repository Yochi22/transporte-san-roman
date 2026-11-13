const prisma = require('../../config/database')
const { camionPanelSelect } = require('../../utils/prismaSelects')

const filtroActivo = (estado) => {
  if (estado === 'todos') return undefined
  if (estado === 'inactivos') return false
  return true
}

const listar = async (filtros = {}) => {
  return prisma.camion.findMany({
    where: { activo: filtroActivo(filtros.estado) },
    select: camionPanelSelect,
    orderBy: { placa: 'asc' },
    take: 500
  })
}

const obtener = async (id) => {
  return prisma.camion.findUniqueOrThrow({ where: { id }, select: camionPanelSelect })
}

const crear = async (datos) => {
  const data = normalizarDatosCamion(datos)
  return prisma.camion.create({
    data,
    select: camionPanelSelect
  })
}

const actualizar = async (id, datos) => {
  return prisma.camion.update({
    where: { id },
    data: normalizarDatosCamion(datos),
    select: camionPanelSelect
  })
}

const normalizarDatosCamion = (datos) => {
  const tipoVehiculo = datos.tipoVehiculo || 'NPR'
  if (!['NPR', 'TORONTO', 'FURGON', 'CHUTO', 'CORTINERO', 'BATEA'].includes(tipoVehiculo)) {
    throw { status: 400, message: 'Tipo de vehiculo invalido' }
  }
  const placaFurgon = null
  const placaChuto = null
  const placa = datos.placa?.trim().toUpperCase()
  const marcaModelo = datos.marcaModelo?.trim() || tipoVehiculo
  const gpsImei = datos.gpsImei?.trim() || null

  if (!placa) throw { status: 400, message: 'La placa es requerida' }
  if (placa.length > 20) {
    throw { status: 400, message: 'La placa es invalida' }
  }
  if (marcaModelo.length > 100) throw { status: 400, message: 'Marca o modelo invalido' }
  if (gpsImei && !/^\d{10,20}$/.test(gpsImei)) {
    throw { status: 400, message: 'IMEI GPS invalido' }
  }
  return {
    tipoVehiculo,
    placa,
    gpsImei,
    placaFurgon,
    placaChuto,
    marcaModelo,
  }
}

const inactivar = async (id) => {
  const viajesActivos = await prisma.viaje.count({
    where: {
      estadoLogistico: 'EN_CURSO',
      OR: [
        { camionId: id },
        { unidades: { some: { camionId: id } } }
      ]
    }
  })
  if (viajesActivos > 0) throw { status: 409, message: 'No se puede eliminar una unidad con viajes activos' }
  return prisma.$transaction(async (tx) => {
    await tx.choferUnidad.deleteMany({ where: { camionId: id } })
    return tx.camion.update({
      where: { id },
      data: { activo: false, estado: 'DISPONIBLE' }
    })
  })
}

const reactivar = async (id) => {
  return prisma.camion.update({
    where: { id },
    data: { activo: true },
    select: camionPanelSelect
  })
}

// La eliminacion fisica solo procede si la unidad no tiene historial. Si ya
// participo en viajes, taller, retornables o combustible, se debe inactivar:
// borrarla arrastraria viajes (incluso liquidados), gastos y reportes reales.
const eliminar = async (id) => {
  await prisma.camion.findUniqueOrThrow({ where: { id } })
  const [viajes, mantenimientos, retornables, controles] = await Promise.all([
    prisma.viaje.count({ where: { OR: [{ camionId: id }, { unidades: { some: { camionId: id } } }] } }),
    prisma.mantenimientoVehiculo.count({ where: { camionId: id } }),
    prisma.retornableMovimiento.count({ where: { camionId: id } }),
    prisma.controlCombustible.count({ where: { camionId: id } })
  ])
  if (viajes > 0 || mantenimientos > 0 || retornables > 0 || controles > 0) {
    throw { status: 409, message: 'Esta unidad tiene historial (viajes, taller, retornables o combustible). Inactivala en lugar de eliminarla.' }
  }

  return prisma.$transaction(async (tx) => {
    await tx.configuracionCombustibleCamion.deleteMany({ where: { camionId: id } })
    await tx.truckPosition.deleteMany({ where: { truckId: id } })
    await tx.choferUnidad.deleteMany({ where: { camionId: id } })
    return tx.camion.delete({ where: { id } })
  })
}

module.exports = { listar, obtener, crear, actualizar, eliminar, inactivar, reactivar }
