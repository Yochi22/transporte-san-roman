const prisma = require('../../config/database')

const TIPOS_RETORNABLE = new Set(['CARTON', 'PALETA', 'SEPARADOR', 'OTRO'])
const TIPOS_MOVIMIENTO = new Set(['REGISTRO', 'UBICACION', 'TRANSFERENCIA', 'DEVOLUCION_PARCIAL', 'DEVOLUCION_TOTAL', 'AJUSTE'])
const ESTADOS_ABIERTOS = ['PENDIENTE', 'PARCIAL']

const includeRetornable = {
  viajeOrigen: { select: { id: true, codigo: true, paradas: { orderBy: { orden: 'asc' }, select: { ciudad: true, lugar: true, orden: true } } } },
  movimientos: {
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      viaje: { select: { id: true, codigo: true } },
      chofer: { select: { id: true, nombre: true } },
      camion: { select: { id: true, placa: true, tipoVehiculo: true } },
      registradoPor: { select: { id: true, nombre: true } }
    }
  }
}

const listar = async (filtros = {}) => {
  const page = Math.max(1, Number(filtros.page) || 1)
  const pageSize = Math.min(50, Math.max(1, Number(filtros.pageSize) || 20))
  const where = {}
  const q = String(filtros.q || '').trim()

  if (filtros.estado === 'abiertos' || !filtros.estado) where.estado = { in: ESTADOS_ABIERTOS }
  else if (filtros.estado !== 'todos') where.estado = filtros.estado
  if (filtros.tipo) where.tipo = filtros.tipo
  if (q) {
    where.OR = [
      { empresa: { contains: q, mode: 'insensitive' } },
      { observacion: { contains: q, mode: 'insensitive' } },
      { viajeOrigen: { codigo: { contains: q, mode: 'insensitive' } } },
      { movimientos: { some: { ubicacion: { contains: q, mode: 'insensitive' } } } },
      { movimientos: { some: { origen: { contains: q, mode: 'insensitive' } } } },
      { movimientos: { some: { destino: { contains: q, mode: 'insensitive' } } } },
      { movimientos: { some: { observacion: { contains: q, mode: 'insensitive' } } } },
    ]
  }

  const [items, total] = await prisma.$transaction([
    prisma.retornable.findMany({
      where,
      include: includeRetornable,
      orderBy: [{ estado: 'asc' }, { updatedAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    prisma.retornable.count({ where })
  ])

  return { items, total, page, pageSize }
}

const listarPorViaje = async (viajeId) => prisma.retornable.findMany({
  where: {
    OR: [
      { viajeOrigenId: viajeId },
      { movimientos: { some: { viajeId } } }
    ]
  },
  include: includeRetornable,
  orderBy: { updatedAt: 'desc' },
  take: 100
})

const crear = async (datos, usuarioId) => {
  const tipo = normalizarTipoRetornable(datos.tipo)
  const empresa = normalizarTexto(datos.empresa, 'Empresa', 120)
  const cantidad = normalizarCantidad(datos.cantidad, 'Cantidad')
  const observacion = normalizarTextoOpcional(datos.observacion, 500)
  await validarReferencias(datos)

  return prisma.$transaction(async (tx) => {
    const retornable = await tx.retornable.create({
      data: {
        tipo,
        empresa,
        cantidadInicial: cantidad,
        cantidadPendiente: cantidad,
        estado: 'PENDIENTE',
        viajeOrigenId: datos.viajeId || null,
        observacion
      }
    })

    await tx.retornableMovimiento.create({
      data: datosMovimiento(retornable.id, 'REGISTRO', cantidad, datos, usuarioId)
    })

    return tx.retornable.findUniqueOrThrow({ where: { id: retornable.id }, include: includeRetornable })
  })
}

const mover = async (id, datos, usuarioId) => {
  const tipoMovimiento = datos.tipoMovimiento
  if (!['DEVOLUCION_PARCIAL', 'DEVOLUCION_TOTAL'].includes(tipoMovimiento)) {
    throw { status: 400, message: 'Solo se permiten devoluciones parciales o totales' }
  }
  const actual = await prisma.retornable.findUniqueOrThrow({ where: { id } })
  const cantidad = tipoMovimiento === 'DEVOLUCION_TOTAL' ? Number(actual.cantidadPendiente) : normalizarCantidad(datos.cantidad, 'Cantidad')
  if (cantidad <= 0) throw { status: 409, message: 'No hay saldo pendiente por devolver' }
  await validarReferencias(datos)

  return prisma.$transaction(async (tx) => {
    const cantidadPendiente = calcularPendiente(actual.cantidadPendiente, cantidad, tipoMovimiento)
    const estado = calcularEstado(actual.cantidadInicial, cantidadPendiente, tipoMovimiento)

    if (cantidadPendiente < 0) throw { status: 409, message: 'La cantidad excede el saldo pendiente' }

    await tx.retornableMovimiento.create({
      data: datosMovimiento(id, tipoMovimiento, cantidad, datos, usuarioId)
    })

    return tx.retornable.update({
      where: { id },
      data: { cantidadPendiente, estado },
      include: includeRetornable
    })
  })
}

const calcularPendiente = (actual, cantidad, tipoMovimiento) => {
  const pendiente = Number(actual)
  if (['DEVOLUCION_PARCIAL', 'DEVOLUCION_TOTAL'].includes(tipoMovimiento)) return pendiente - cantidad
  if (tipoMovimiento === 'AJUSTE') return cantidad
  return pendiente
}

const calcularEstado = (cantidadInicial, cantidadPendiente, tipoMovimiento) => {
  if (tipoMovimiento === 'AJUSTE') return cantidadPendiente <= 0 ? 'AJUSTADO' : cantidadPendiente < Number(cantidadInicial) ? 'PARCIAL' : 'PENDIENTE'
  if (cantidadPendiente <= 0) return 'DEVUELTO'
  if (cantidadPendiente < Number(cantidadInicial)) return 'PARCIAL'
  return 'PENDIENTE'
}

const datosMovimiento = (retornableId, tipoMovimiento, cantidad, datos, usuarioId) => ({
  retornableId,
  tipoMovimiento,
  cantidad,
  viajeId: datos.viajeId || null,
  choferId: datos.choferId || null,
  camionId: datos.camionId || null,
  ubicacion: normalizarTextoOpcional(datos.ubicacion, 160),
  origen: normalizarTextoOpcional(datos.origen, 160),
  destino: normalizarTextoOpcional(datos.destino, 160),
  observacion: normalizarTextoOpcional(datos.observacion, 500),
  registradoPorId: usuarioId || null
})

const validarReferencias = async (datos) => {
  const checks = []
  if (datos.viajeId) checks.push(prisma.viaje.findUniqueOrThrow({ where: { id: datos.viajeId }, select: { id: true } }))
  if (datos.choferId) checks.push(prisma.chofer.findUniqueOrThrow({ where: { id: datos.choferId }, select: { id: true } }))
  if (datos.camionId) checks.push(prisma.camion.findUniqueOrThrow({ where: { id: datos.camionId }, select: { id: true } }))
  await Promise.all(checks)
}

const normalizarTipoRetornable = (tipo) => {
  if (!TIPOS_RETORNABLE.has(tipo)) throw { status: 400, message: 'Tipo de retornable invalido' }
  return tipo
}

const normalizarCantidad = (valor, campo) => {
  const cantidad = Number(valor)
  if (!Number.isInteger(cantidad) || cantidad <= 0 || cantidad > 1_000_000) {
    throw { status: 400, message: `${campo} invalida` }
  }
  return cantidad
}

const normalizarTexto = (valor, campo, max) => {
  const texto = String(valor || '').trim()
  if (!texto || texto.length > max) throw { status: 400, message: `${campo} invalida` }
  return texto
}

const normalizarTextoOpcional = (valor, max) => {
  const texto = String(valor || '').trim()
  if (!texto) return null
  if (texto.length > max) throw { status: 400, message: 'Texto demasiado largo' }
  return texto
}

module.exports = { listar, listarPorViaje, crear, mover }