const prisma = require('../../config/database')

const porViaje = async (viajeId) => {
  return prisma.gasto.findMany({
    where: { viajeId },
    orderBy: { createdAt: 'desc' }
  })
}

const crear = async (datos, origen = 'ADMIN') => {
  const { viajeId, tipo, monto, descripcion } = datos
  const viaje = await prisma.viaje.findUniqueOrThrow({ where: { id: viajeId } })
  const montoNumerico = Number(monto)

  return prisma.$transaction(async (tx) => {
    const gasto = await tx.gasto.create({
      data: {
        viajeId,
        choferId: viaje.choferId,
        tipo,
        origen,
        monto: montoNumerico,
        descripcion
      }
    })

    await tx.viaje.update({
      where: { id: viajeId },
      data: { viaticosGastados: { increment: montoNumerico } }
    })

    return gasto
  })
}

const eliminar = async (id) => {
  return prisma.$transaction(async (tx) => {
    const gasto = await tx.gasto.delete({ where: { id } })
    await tx.viaje.update({
      where: { id: gasto.viajeId },
      data: { viaticosGastados: { decrement: Number(gasto.monto) } }
    })
    return gasto
  })
}

module.exports = { porViaje, crear, eliminar }
