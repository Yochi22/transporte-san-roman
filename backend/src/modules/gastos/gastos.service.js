const prisma = require('../../config/database')

const TIPOS_GASTO = new Set(['PEAJE', 'COMIDA', 'HOSPEDAJE', 'REPARACION', 'OTRO'])
const MONEDAS = new Set(['VES', 'USD'])

const crear = async (datos, origen = 'ADMIN') => {
  const { viajeId, tipo, descripcion } = datos
  const viaje = await prisma.viaje.findUniqueOrThrow({ where: { id: viajeId } })
  const descripcionNormalizada = descripcion?.trim() || null
  const moneda = normalizarMoneda(datos.moneda || (tipo === 'COMIDA' ? 'USD' : 'VES'))
  const montoOriginal = normalizarMonto(datos.monto, 'Monto de gasto')
  const tasaBcv = moneda === 'USD' ? normalizarMonto(datos.tasaBcv, 'Tasa BCV') : null
  const montoNumerico = moneda === 'USD' ? redondearMonto(montoOriginal * tasaBcv) : montoOriginal

  if (!TIPOS_GASTO.has(tipo)) throw { status: 400, message: 'Tipo de gasto invalido' }
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
        moneda,
        montoOriginal,
        tasaBcv,
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

const normalizarMoneda = (moneda) => {
  const value = String(moneda || '').trim().toUpperCase()
  if (!MONEDAS.has(value)) throw { status: 400, message: 'Moneda invalida' }
  return value
}

const normalizarMonto = (valor, campo) => {
  const monto = Number(valor)
  if (!Number.isFinite(monto) || monto <= 0 || monto > 1_000_000_000) {
    throw { status: 400, message: campo + ' invalido' }
  }
  return monto
}

const redondearMonto = (valor) => Math.round(Number(valor) * 100) / 100

module.exports = { crear, eliminar }
