require('dotenv').config()
const prisma = require('../src/config/database')

const main = async () => {
  if (process.env.ALLOW_TRIPS_RESET !== 'true') {
    throw new Error('Define ALLOW_TRIPS_RESET=true para ejecutar esta limpieza')
  }

  const resumen = await prisma.$transaction(async (tx) => {
    const movimientos = await tx.retornableMovimiento.deleteMany()
    const retornables = await tx.retornable.deleteMany()
    const gastos = await tx.gasto.deleteMany()
    const reportes = await tx.reporteChofer.deleteMany()
    const paradas = await tx.parada.deleteMany()
    const viajeUnidades = await tx.viajeUnidad.deleteMany()
    const viajes = await tx.viaje.deleteMany()

    const choferes = await tx.chofer.updateMany({
      data: { estado: 'DISPONIBLE', ubicacionActual: 'Sede', ultimoReporteAt: null }
    })
    const camiones = await tx.camion.updateMany({
      data: { estado: 'DISPONIBLE', ubicacionActual: 'Sede' }
    })

    return { movimientos, retornables, gastos, reportes, paradas, viajeUnidades, viajes, choferes, camiones }
  })

  console.log('Viajes y datos relacionados eliminados:')
  console.log(`  Viajes: ${resumen.viajes.count}`)
  console.log(`  Paradas: ${resumen.paradas.count}`)
  console.log(`  Unidades por viaje: ${resumen.viajeUnidades.count}`)
  console.log(`  Reportes de chofer: ${resumen.reportes.count}`)
  console.log(`  Gastos: ${resumen.gastos.count}`)
  console.log(`  Retornables: ${resumen.retornables.count}`)
  console.log(`  Movimientos de retornables: ${resumen.movimientos.count}`)
  console.log(`Choferes reseteados a DISPONIBLE: ${resumen.choferes.count}`)
  console.log(`Camiones reseteados a DISPONIBLE: ${resumen.camiones.count}`)
  console.log('Choferes, camiones, usuarios y empresas se conservaron intactos (solo se reseteo estado/ubicacion de choferes y camiones).')
}

main()
  .catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
