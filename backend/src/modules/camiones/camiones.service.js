const prisma = require('../../config/database')

const listar = async () => {
  return prisma.camion.findMany({
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
  return prisma.camion.update({
    where: { id },
    data: { 
      estado: 'EN_TALLER',
      motivoTaller: motivo
    }
  })
}

const salirTaller = async (id) => {
  return prisma.camion.update({
    where: { id },
    data: { 
      estado: 'DISPONIBLE',
      motivoTaller: null
    }
  })
}

const eliminar = async (id) => {
  const viajes = await prisma.viaje.count({ where: { camionId: id } })
  if (viajes > 0) throw { status: 409, message: 'No se puede eliminar una unidad con viajes registrados' }
  return prisma.camion.delete({ where: { id } })
}

module.exports = { listar, obtener, crear, actualizar, entrarTaller, salirTaller, eliminar }
