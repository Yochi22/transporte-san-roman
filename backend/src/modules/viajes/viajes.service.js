const prisma = require('../../config/database')
const { generarCodigoViaje } = require('../../utils/generarCodigo')

const listar = async (filtros = {}) => {
  const where = {}
  if (filtros.estadoLogistico) where.estadoLogistico = filtros.estadoLogistico
  if (filtros.estadoFinanciero) where.estadoFinanciero = filtros.estadoFinanciero

  return prisma.viaje.findMany({
    where,
    include: {
      chofer: true,
      camion: true,
      paradas: { orderBy: { orden: 'asc' } },
      reportes: { orderBy: { createdAt: 'desc' } },
      gastos: { orderBy: { createdAt: 'desc' } }
    },
    orderBy: { createdAt: 'desc' }
  })
}

const obtener = async (id) => {
  return prisma.viaje.findUniqueOrThrow({
    where: { id },
    include: {
      chofer: true,
      camion: true,
      paradas: { orderBy: { orden: 'asc' } },
      reportes: { orderBy: { createdAt: 'desc' } },
      gastos: { orderBy: { createdAt: 'desc' } }
    }
  })
}

const crear = async (datos, creadoPorId) => {
  const { camionId, choferId, viaticosDepositados, paradas } = datos
  const camion = await prisma.camion.findUniqueOrThrow({ where: { id: camionId } })
  if (camion.estado === 'EN_TALLER') {
    throw { status: 409, message: 'La unidad esta fuera de servicio y no puede ser despachada' }
  }

  const viajeActivo = await prisma.viaje.findFirst({
    where: { camionId, choferId, estadoLogistico: 'EN_CURSO' },
    include: { paradas: { orderBy: { orden: 'asc' } } }
  })

  if (viajeActivo) {
    return agregarTramo(viajeActivo.id, { paradas, viaticosDepositados })
  }

  const codigo = generarCodigoViaje()

  const viaje = await prisma.viaje.create({
    data: {
      codigo,
      camionId,
      choferId,
      creadoPorId,
      viaticosDepositados: Number(viaticosDepositados) || 0,
      estadoLogistico: 'EN_CURSO',
      paradas: {
        create: paradas.map((p, i) => ({
          orden: i + 1,
          tramo: 1,
          tipo: p.tipo,
          lugar: p.lugar,
          ciudad: p.ciudad
        }))
      }
    }
  })

  await prisma.camion.update({ where: { id: camionId }, data: { estado: 'EN_RUTA' } })
  await prisma.chofer.update({ where: { id: choferId }, data: { estado: 'EN_RUTA' } })

  return viaje
}

const agregarTramo = async (id, datos) => {
  const { paradas = [], viaticosDepositados = 0 } = datos
  const viaje = await prisma.viaje.findUniqueOrThrow({
    where: { id },
    include: { paradas: true }
  })

  const ultimoOrden = viaje.paradas.reduce((max, parada) => Math.max(max, parada.orden), 0)
  const nuevoTramo = viaje.paradas.reduce((max, parada) => Math.max(max, parada.tramo || 1), 1) + 1

  await prisma.$transaction([
    prisma.parada.createMany({
      data: paradas.map((parada, index) => ({
        viajeId: id,
        orden: ultimoOrden + index + 1,
        tramo: nuevoTramo,
        tipo: parada.tipo,
        lugar: parada.lugar,
        ciudad: parada.ciudad
      }))
    }),
    prisma.viaje.update({
      where: { id },
      data: {
        viaticosDepositados: { increment: Number(viaticosDepositados) || 0 },
        estadoLogistico: 'EN_CURSO',
        estadoFinanciero: 'PENDIENTE',
        fechaCierre: null
      }
    })
  ])

  return obtener(id)
}

const actualizarParada = async (viajeId, paradaId, estado) => {
  const parada = await prisma.parada.findFirstOrThrow({
    where: { id: paradaId, viajeId }
  })

  return prisma.parada.update({
    where: { id: parada.id },
    data: {
      estado,
      completadaAt: estado === 'COMPLETADA' ? new Date() : null
    }
  })
}

const actualizar = async (id, datos) => {
  return prisma.viaje.update({
    where: { id },
    data: datos
  })
}

const eliminar = async (id) => {
  const viaje = await prisma.viaje.findUnique({ where: { id } })
  if (!viaje) return null

  return prisma.$transaction(async (tx) => {
    await tx.viaje.delete({ where: { id } })

    const [otrosViajesChofer, otrosViajesCamion] = await Promise.all([
      tx.viaje.count({ where: { choferId: viaje.choferId, estadoLogistico: 'EN_CURSO' } }),
      tx.viaje.count({ where: { camionId: viaje.camionId, estadoLogistico: 'EN_CURSO' } })
    ])

    if (otrosViajesChofer === 0) {
      await tx.chofer.update({ where: { id: viaje.choferId }, data: { estado: 'DISPONIBLE' } })
    }
    if (otrosViajesCamion === 0) {
      await tx.camion.update({ where: { id: viaje.camionId }, data: { estado: 'DISPONIBLE' } })
    }

    return viaje
  })
}

const recargarViaticos = async (id, monto) => {
  return prisma.viaje.update({
    where: { id },
    data: { 
      viaticosDepositados: { increment: Number(monto) }
    }
  })
}

const confirmarDocumentacion = async (id) => {
  return prisma.viaje.update({
    where: { id },
    data: { documentacionRecibida: true }
  })
}

const obtenerLiquidacion = async (id) => {
  const viaje = await prisma.viaje.findUniqueOrThrow({
    where: { id },
    include: {
      chofer: true,
      camion: true,
      gastos: { orderBy: { createdAt: 'asc' } }
    }
  })

  const totalGastado = viaje.gastos.reduce((total, gasto) => total + Number(gasto.monto), 0)
  const depositado = Number(viaje.viaticosDepositados)

  return {
    viaje,
    depositado,
    totalGastado,
    balance: depositado - totalGastado
  }
}

const listarLiquidaciones = async (filtros = {}) => {
  const where = { estadoFinanciero: 'LIQUIDADO' }
  if (filtros.choferId) where.choferId = filtros.choferId
  if (filtros.desde || filtros.hasta) {
    where.fechaLiquidacion = {}
    if (filtros.desde) where.fechaLiquidacion.gte = new Date(filtros.desde)
    if (filtros.hasta) {
      const hasta = new Date(filtros.hasta)
      hasta.setHours(23, 59, 59, 999)
      where.fechaLiquidacion.lte = hasta
    }
  }

  return prisma.viaje.findMany({
    where,
    include: {
      chofer: true,
      camion: true,
      paradas: { orderBy: { orden: 'asc' } },
      gastos: true
    },
    orderBy: { fechaLiquidacion: 'desc' }
  })
}

const actualizarHonorarios = async (id, honorariosChofer) => {
  return prisma.viaje.update({
    where: { id },
    data: { honorariosChofer: Number(honorariosChofer) || 0 }
  })
}

const cerrar = async (id, soloLogistica = false, numeroGuia = null) => {
  const viaje = await prisma.viaje.findUniqueOrThrow({
    where: { id },
    include: { chofer: true, camion: true, gastos: true }
  })

  const totalGastado = viaje.gastos.reduce((acc, g) => acc + Number(g.monto), 0)
  const guia = numeroGuia?.trim() || viaje.numeroGuia

  return prisma.$transaction(async (tx) => {
    await tx.parada.updateMany({
      where: { viajeId: id, estado: { not: 'COMPLETADA' } },
      data: { estado: 'COMPLETADA', completadaAt: new Date() }
    })

    return tx.viaje.update({
      where: { id },
      data: {
        estadoLogistico: 'COMPLETADO',
        numeroGuia: guia,
        viaticosGastados: totalGastado,
        estadoFinanciero: soloLogistica ? 'PENDIENTE' : 'LIQUIDADO',
        fechaLiquidacion: soloLogistica ? null : new Date(),
        fechaCierre: new Date()
      }
    })
  })
}

module.exports = {
  listar,
  obtener,
  crear,
  actualizar,
  eliminar,
  cerrar,
  recargarViaticos,
  confirmarDocumentacion,
  obtenerLiquidacion,
  listarLiquidaciones,
  actualizarHonorarios,
  agregarTramo,
  actualizarParada
}
