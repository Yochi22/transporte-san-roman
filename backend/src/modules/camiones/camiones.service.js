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
  const capacidadTanqueLitros = validarNumeroOpcional(datos.capacidadTanqueLitros, 'Capacidad del tanque')
  const rendimientoEsperadoKmL = validarNumeroOpcional(datos.rendimientoEsperadoKmL, 'Rendimiento esperado')
  const toleranciaCombustiblePct = validarNumeroOpcional(datos.toleranciaCombustiblePct, 'Tolerancia de combustible') ?? 10

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
    capacidadTanqueLitros,
    rendimientoEsperadoKmL,
    toleranciaCombustiblePct,
  }
}

const validarNumeroOpcional = (valor, campo) => {
  if (valor === undefined || valor === null || valor === '') return null
  const numero = Number(valor)
  if (!Number.isFinite(numero) || numero < 0 || numero > 1_000_000) {
    throw { status: 400, message: `${campo} invalido` }
  }
  return numero
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

const eliminar = async (id) => {
  const viajes = await prisma.viaje.findMany({
    where: {
      OR: [
        { camionId: id },
        { unidades: { some: { camionId: id } } }
      ]
    },
    select: { id: true }
  })
  const viajeIds = viajes.map((viaje) => viaje.id)

  return prisma.$transaction(async (tx) => {
    await tx.combustibleEvento.deleteMany({ where: { OR: [{ viajeId: { in: viajeIds } }, { camionId: id }] } })
    await tx.gasto.deleteMany({ where: { viajeId: { in: viajeIds } } })
    await tx.reporteChofer.deleteMany({ where: { viajeId: { in: viajeIds } } })
    await tx.parada.deleteMany({ where: { viajeId: { in: viajeIds } } })
    await tx.viajeUnidad.deleteMany({ where: { OR: [{ viajeId: { in: viajeIds } }, { camionId: id }] } })
    await tx.viaje.deleteMany({ where: { id: { in: viajeIds } } })
    await tx.mantenimientoVehiculo.deleteMany({ where: { camionId: id } })
    await tx.truckPosition.deleteMany({ where: { truckId: id } })
    await tx.choferUnidad.deleteMany({ where: { camionId: id } })
    return tx.camion.delete({ where: { id } })
  })
}

module.exports = { listar, obtener, crear, actualizar, eliminar, inactivar }
