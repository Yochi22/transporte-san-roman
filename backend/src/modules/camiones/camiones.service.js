const prisma = require('../../config/database')
const { camionPanelSelect } = require('../../utils/prismaSelects')

const listar = async () => {
  return prisma.camion.findMany({
    where: { activo: true },
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

const eliminar = async (id) => {
  const viajesActivos = await prisma.viaje.count({
    where: { camionId: id, estadoLogistico: 'EN_CURSO' }
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

module.exports = { listar, obtener, crear, actualizar, eliminar }
