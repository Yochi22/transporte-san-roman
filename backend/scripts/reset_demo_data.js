require('dotenv').config()
const prisma = require('../src/config/database')

const main = async () => {
  if (process.env.ALLOW_DEMO_RESET !== 'true') {
    throw new Error('Define ALLOW_DEMO_RESET=true para ejecutar esta limpieza')
  }

  await prisma.$transaction(async (tx) => {
    await tx.gasto.deleteMany()
    await tx.reporteChofer.deleteMany()
    await tx.parada.deleteMany()
    await tx.viajeUnidad.deleteMany()
    await tx.viaje.deleteMany()
    await tx.mantenimientoVehiculo.deleteMany()
    await tx.truckPosition.deleteMany()
    await tx.choferUnidad.deleteMany()
    await tx.camion.deleteMany()
    await tx.chofer.deleteMany()
  })

  console.log('Datos demo eliminados: choferes, camiones, viajes, reportes, gastos, liquidaciones, taller y posiciones GPS.')
}

main()
  .catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
