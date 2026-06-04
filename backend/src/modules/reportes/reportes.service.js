const prisma = require('../../config/database')

const listar = async () => {
  return prisma.reporteChofer.findMany({
    include: {
      chofer: true,
      viaje: { select: { codigo: true } },
      parada: true
    },
    orderBy: { createdAt: 'desc' },
    take: 100
  })
}

const porViaje = async (viajeId) => {
  return prisma.reporteChofer.findMany({
    where: { viajeId },
    include: {
      chofer: true,
      parada: true
    },
    orderBy: { createdAt: 'desc' }
  })
}

const crear = async (datos) => {
  const { viajeId, choferId, paradaId, mensajeOriginal, tipoReporte, ubicacion, procesadoPorIa } = datos
  return prisma.reporteChofer.create({
    data: { viajeId, choferId, paradaId, mensajeOriginal, tipoReporte, ubicacion, procesadoPorIa }
  })
}

module.exports = { listar, porViaje, crear }
