const prisma = require('../../config/database')

const crear = async (datos) => {
  const { viajeId, choferId, paradaId, mensajeOriginal, tipoReporte, ubicacion, procesadoPorIa } = datos
  return prisma.reporteChofer.create({
    data: { viajeId, choferId, paradaId, mensajeOriginal, tipoReporte, ubicacion, procesadoPorIa }
  })
}

const depurarReportesAntiguos = async (diasRetencion = 3) => {
  const limite = new Date()
  limite.setDate(limite.getDate() - diasRetencion)

  return prisma.reporteChofer.deleteMany({
    where: {
      createdAt: { lte: limite }
    }
  })
}

module.exports = { crear, depurarReportesAntiguos }
