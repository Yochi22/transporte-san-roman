const prisma = require('../src/config/database')

const main = async () => {
  const completedTrips = await prisma.viaje.findMany({
    where: { estadoLogistico: 'COMPLETADO' },
    select: { id: true },
  })

  const result = await prisma.parada.updateMany({
    where: {
      viajeId: { in: completedTrips.map((viaje) => viaje.id) },
      estado: { not: 'COMPLETADA' },
    },
    data: {
      estado: 'COMPLETADA',
      completadaAt: new Date(),
    },
  })

  console.log(`Aligned completed trip stops: ${result.count}`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
