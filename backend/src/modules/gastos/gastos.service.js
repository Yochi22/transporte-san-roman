const prisma = require('../../config/database')
const TIPOS_GASTO = new Set(['COMBUSTIBLE', 'PEAJE', 'COMIDA', 'HOSPEDAJE', 'REPARACION', 'OTRO'])

const crear = async (datos, origen = 'ADMIN') => {
  const { viajeId, tipo, monto, descripcion } = datos
  const viaje = await prisma.viaje.findUniqueOrThrow({ where: { id: viajeId } })
  const montoNumerico = Number(monto)
  const descripcionNormalizada = descripcion?.trim() || null

  if (!TIPOS_GASTO.has(tipo)) throw { status: 400, message: 'Tipo de gasto invalido' }
  if (!Number.isFinite(montoNumerico) || montoNumerico <= 0 || montoNumerico > 1_000_000_000) {
    throw { status: 400, message: 'Monto de gasto invalido' }
  }
  if (descripcionNormalizada?.length > 500) {
    throw { status: 400, message: 'Descripcion demasiado larga' }
  }
  if (viaje.estadoFinanciero === 'LIQUIDADO') {
    throw { status: 409, message: 'No se pueden registrar gastos en un viaje liquidado' }
  }

  return prisma.$transaction(async (tx) => {
    const gasto = await tx.gasto.create({
      data: {
        viajeId,
        choferId: viaje.choferId,
        tipo,
        origen,
        monto: montoNumerico,
        descripcion: descripcionNormalizada
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

module.exports = { crear, eliminar }
