const prisma = require('../../config/database')

const listar = async () => {
  return prisma.camion.findMany({
    where: { activo: true },
    orderBy: { placa: 'asc' }
  })
}

const obtener = async (id) => {
  return prisma.camion.findUniqueOrThrow({ where: { id } })
}

const crear = async (datos) => {
  const data = normalizarDatosCamion(datos)
  return prisma.camion.create({
    data
  })
}

const actualizar = async (id, datos) => {
  return prisma.camion.update({
    where: { id },
    data: normalizarDatosCamion(datos)
  })
}

const normalizarDatosCamion = (datos) => {
  const tipoVehiculo = datos.tipoVehiculo || 'NPR'
  const placaFurgon = tipoVehiculo === 'FURGON' ? datos.placaFurgon?.trim().toUpperCase() : null
  const placaChuto = tipoVehiculo === 'FURGON' ? datos.placaChuto?.trim().toUpperCase() : null
  const placa = tipoVehiculo === 'FURGON' ? placaChuto : datos.placa?.trim().toUpperCase()

  if (!placa) throw { status: 400, message: 'La placa es requerida' }
  if (tipoVehiculo === 'FURGON' && (!placaFurgon || !placaChuto)) {
    throw { status: 400, message: 'El furgon requiere placa del furgon y placa del chuto' }
  }

  return {
    tipoVehiculo,
    placa,
    placaFurgon,
    placaChuto,
    marcaModelo: datos.marcaModelo || tipoVehiculo,
  }
}

const entrarTaller = async (id, motivo) => {
  const falla = motivo?.trim() || 'Fuera de servicio'
  return prisma.$transaction(async (tx) => {
    const activo = await tx.mantenimientoVehiculo.findFirst({
      where: { camionId: id, estado: 'EN_PROCESO' }
    })
    if (!activo) {
      await tx.mantenimientoVehiculo.create({
        data: { camionId: id, tipo: 'REPARACION', falla }
      })
    }
    return tx.camion.update({
      where: { id },
      data: { estado: 'EN_TALLER', motivoTaller: falla }
    })
  })
}

const salirTaller = async (id) => {
  return prisma.$transaction(async (tx) => {
    await tx.mantenimientoVehiculo.updateMany({
      where: { camionId: id, estado: 'EN_PROCESO' },
      data: { estado: 'COMPLETADO', fechaSalida: new Date() }
    })
    const viajesActivos = await tx.viaje.count({
      where: { camionId: id, estadoLogistico: 'EN_CURSO' }
    })
    return tx.camion.update({
      where: { id },
      data: {
        estado: viajesActivos > 0 ? 'EN_RUTA' : 'DISPONIBLE',
        motivoTaller: null
      }
    })
  })
}

const eliminar = async (id) => {
  const viajesActivos = await prisma.viaje.count({
    where: { camionId: id, estadoLogistico: 'EN_CURSO' }
  })
  if (viajesActivos > 0) throw { status: 409, message: 'No se puede eliminar una unidad con viajes activos' }
  return prisma.camion.update({
    where: { id },
    data: { activo: false, estado: 'DISPONIBLE' }
  })
}

module.exports = { listar, obtener, crear, actualizar, entrarTaller, salirTaller, eliminar }
