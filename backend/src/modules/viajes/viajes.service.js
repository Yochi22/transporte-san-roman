const prisma = require('../../config/database')
const { generarCodigoViaje } = require('../../utils/generarCodigo')
const { choferPanelSelect, camionPanelSelect, reportePanelSelect } = require('../../utils/prismaSelects')

const viajePanelInclude = {
  chofer: { select: choferPanelSelect },
  camion: { select: camionPanelSelect },
  unidades: { include: { camion: { select: camionPanelSelect } } },
  paradas: { orderBy: { orden: 'asc' } },
  reportes: { select: reportePanelSelect, orderBy: { createdAt: 'desc' }, take: 100 },
  combustibleEventos: { include: { camion: { select: { id: true, placa: true, tipoVehiculo: true } } }, orderBy: { createdAt: 'desc' }, take: 200 },
  gastos: { orderBy: { createdAt: 'desc' }, take: 200 }
}

const validarMonto = (valor, campo) => {
  const numero = Number(valor || 0)
  if (!Number.isFinite(numero) || numero < 0 || numero > 1_000_000_000) {
    throw { status: 400, message: `${campo} invalido` }
  }
  return numero
}

const validarNumeroOpcional = (valor, campo, { entero = false } = {}) => {
  if (valor === undefined || valor === null || valor === '') return null
  const numero = Number(valor)
  if (!Number.isFinite(numero) || numero < 0 || numero > 10_000_000) {
    throw { status: 400, message: `${campo} invalido` }
  }
  return entero ? Math.round(numero) : numero
}

const validarParadas = (paradas) => {
  if (!Array.isArray(paradas) || paradas.length < 2 || paradas.length > 50) {
    throw { status: 400, message: 'El viaje debe tener entre 2 y 50 paradas' }
  }

  return paradas.map((parada) => {
    const tipo = parada.tipo
    const lugar = parada.lugar?.trim()
    const ciudad = parada.ciudad?.trim()
    if (!['CARGA', 'DESCARGA', 'PERNOCTA'].includes(tipo) || !lugar || !ciudad) {
      throw { status: 400, message: 'Datos de parada invalidos' }
    }
    if (lugar.length > 160 || ciudad.length > 100) {
      throw { status: 400, message: 'Lugar o ciudad demasiado largo' }
    }
    const fechaProgramada = parada.fechaProgramada ? new Date(parada.fechaProgramada) : null
    if (fechaProgramada && Number.isNaN(fechaProgramada.getTime())) {
      throw { status: 400, message: 'Fecha programada invalida' }
    }
    return { ...parada, tipo, lugar, ciudad, fechaProgramada }
  })
}

const normalizarUnidadIdsViaje = (datos) => {
  const ids = Array.isArray(datos.camionIds) ? datos.camionIds : [datos.camionId]
  return [...new Set(ids.filter((id) => typeof id === 'string' && id.trim()).map((id) => id.trim()))]
}

const tripUnitIds = (viaje) => {
  const ids = (viaje.unidades || []).map((unidad) => unidad.camionId).filter(Boolean)
  return ids.length > 0 ? ids : [viaje.camionId].filter(Boolean)
}

const sameSet = (a, b) => {
  if (a.length !== b.length) return false
  const set = new Set(a)
  return b.every((item) => set.has(item))
}

const listar = async (filtros = {}) => {
  const where = {}
  if (filtros.estadoLogistico) where.estadoLogistico = filtros.estadoLogistico
  if (filtros.estadoFinanciero) where.estadoFinanciero = filtros.estadoFinanciero

  return prisma.viaje.findMany({
    where,
    include: viajePanelInclude,
    orderBy: { createdAt: 'desc' },
    take: 500
  })
}

const listarArchivo = async (filtros = {}) => {
  const page = Math.max(1, Number(filtros.page) || 1)
  const pageSize = Math.min(50, Math.max(1, Number(filtros.pageSize) || 10))
  const where = { estadoLogistico: 'COMPLETADO' }
  const rango = construirRangoArchivo(filtros.periodo, filtros.fecha)

  if (rango) {
    where.fechaCierre = { gte: rango.desde, lte: rango.hasta }
  }

  const [items, total] = await prisma.$transaction([
    prisma.viaje.findMany({
      where,
      include: viajePanelInclude,
      orderBy: { fechaCierre: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    prisma.viaje.count({ where })
  ])

  return { items, total, page, pageSize }
}

const construirRangoArchivo = (periodo, fecha) => {
  if (!periodo || periodo === 'todos') return null
  const base = fecha ? new Date(`${fecha}T12:00:00`) : new Date()
  if (Number.isNaN(base.getTime())) return null
  const desde = new Date(base)
  const hasta = new Date(base)

  if (periodo === 'dia') {
    desde.setHours(0, 0, 0, 0)
    hasta.setHours(23, 59, 59, 999)
  } else if (periodo === 'semana') {
    const day = desde.getDay()
    const offset = day === 0 ? -6 : 1 - day
    desde.setDate(desde.getDate() + offset)
    desde.setHours(0, 0, 0, 0)
    hasta.setTime(desde.getTime())
    hasta.setDate(hasta.getDate() + 6)
    hasta.setHours(23, 59, 59, 999)
  } else if (periodo === 'mes') {
    desde.setDate(1)
    desde.setHours(0, 0, 0, 0)
    hasta.setMonth(hasta.getMonth() + 1, 0)
    hasta.setHours(23, 59, 59, 999)
  } else {
    return null
  }

  return { desde, hasta }
}

const obtener = async (id) => {
  return prisma.viaje.findUniqueOrThrow({
    where: { id },
    include: viajePanelInclude
  })
}

const crear = async (datos, creadoPorId) => {
  const { choferId } = datos
  let unidadIds = normalizarUnidadIdsViaje(datos)
  if (typeof choferId !== 'string') {
    throw { status: 400, message: 'Chofer es requerido' }
  }
  const paradas = validarParadas(datos.paradas)
  const viaticosDepositados = validarMonto(datos.viaticosDepositados, 'Monto de viaticos')
  const odometroInicial = validarNumeroOpcional(datos.odometroInicial, 'Odometro inicial', { entero: true })
  const combustibleInicial = validarNumeroOpcional(datos.combustibleInicial, 'Combustible inicial')
  const chofer = await prisma.chofer.findUniqueOrThrow({
    where: { id: choferId },
    include: {
      unidadesAsignadas: {
        include: { camion: true }
      }
    }
  })
  if (!chofer.activo) {
    throw { status: 409, message: 'El chofer no esta activo' }
  }
  const unidadesAsignadas = chofer.unidadesAsignadas.map((asignacion) => asignacion.camion).filter((camion) => camion?.activo)
  if (unidadIds.length === 0 && unidadesAsignadas.length === 1) {
    unidadIds = [unidadesAsignadas[0].id]
  }
  if (unidadIds.length === 0) {
    throw { status: 400, message: 'Selecciona al menos una unidad asignada al chofer' }
  }
  const unidadesSeleccionadas = unidadIds.map((id) => unidadesAsignadas.find((unidad) => unidad.id === id))
  if (unidadesSeleccionadas.some((unidad) => !unidad)) {
    throw { status: 409, message: 'Una o mas unidades seleccionadas no estan asignadas a este chofer' }
  }
  if (unidadesSeleccionadas.some((unidad) => !unidad.activo)) {
    throw { status: 409, message: 'Una o mas unidades no estan activas' }
  }
  if (unidadesSeleccionadas.some((unidad) => unidad.estado === 'EN_TALLER')) {
    throw { status: 409, message: 'Una o mas unidades estan fuera de servicio y no pueden ser despachadas' }
  }
  const camionId = unidadIds[0]

  const asignacionConflictiva = await prisma.viaje.findFirst({
    where: {
      estadoLogistico: 'EN_CURSO',
      OR: [
        { choferId: { not: choferId }, unidades: { some: { camionId: { in: unidadIds } } } },
        { choferId, unidades: { some: { camionId: { notIn: unidadIds } } } }
      ]
    },
    select: { id: true }
  })
  if (asignacionConflictiva) {
    throw { status: 409, message: 'El chofer o la unidad ya tienen otra asignacion activa' }
  }

  const viajesActivosChofer = await prisma.viaje.findMany({
    where: { choferId, estadoLogistico: 'EN_CURSO' },
    include: { paradas: { orderBy: { orden: 'asc' } }, unidades: true }
  })
  const viajeActivo = viajesActivosChofer.find((viaje) => sameSet(unidadIds, tripUnitIds(viaje)))

  if (viajeActivo) {
    return agregarTramo(viajeActivo.id, { paradas, viaticosDepositados })
  }

  const codigo = generarCodigoViaje()
  const primeraCarga = paradas.find((parada) => parada.tipo === 'CARGA' && parada.fechaProgramada)

  const viaje = await prisma.viaje.create({
    data: {
      codigo,
      camionId,
      choferId,
      creadoPorId,
      viaticosDepositados,
      odometroInicial,
      combustibleInicial,
      estadoLogistico: 'EN_CURSO',
      fechaInicio: primeraCarga ? new Date(primeraCarga.fechaProgramada) : null,
      unidades: {
        create: unidadIds.map((id) => ({ camionId: id }))
      },
      paradas: {
        create: paradas.map((p, i) => ({
          orden: i + 1,
          tramo: 1,
          tipo: p.tipo,
          lugar: p.lugar,
          ciudad: p.ciudad,
          fechaProgramada: p.fechaProgramada,
          cargarAlDescargar: p.tipo === 'CARGA' && !!p.cargarAlDescargar
        }))
      }
    }
  })

  await prisma.camion.updateMany({ where: { id: { in: unidadIds } }, data: { estado: 'EN_RUTA' } })
  await prisma.chofer.update({ where: { id: choferId }, data: { estado: 'EN_RUTA' } })

  return obtener(viaje.id)
}

const agregarTramo = async (id, datos) => {
  const paradas = validarParadas(datos.paradas)
  const viaticosDepositados = validarMonto(datos.viaticosDepositados, 'Monto de viaticos')
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
        ciudad: parada.ciudad,
        fechaProgramada: parada.fechaProgramada,
        cargarAlDescargar: parada.tipo === 'CARGA' && !!parada.cargarAlDescargar
      }))
    }),
    prisma.viaje.update({
      where: { id },
      data: {
        viaticosDepositados: { increment: viaticosDepositados },
        estadoLogistico: 'EN_CURSO',
        estadoFinanciero: 'PENDIENTE',
        fechaCierre: null
      }
    })
  ])

  return obtener(id)
}

const actualizarParada = async (viajeId, paradaId, estado) => {
  if (!['PENDIENTE', 'EN_CURSO', 'COMPLETADA'].includes(estado)) {
    throw { status: 400, message: 'Estado de parada invalido' }
  }
  const parada = await prisma.parada.findFirstOrThrow({
    where: { id: paradaId, viajeId },
    include: { viaje: { select: { estadoLogistico: true } } }
  })
  if (parada.viaje.estadoLogistico === 'COMPLETADO') {
    throw { status: 409, message: 'No se puede modificar una parada de un viaje cerrado' }
  }

  return prisma.parada.update({
    where: { id: parada.id },
    data: {
      estado,
      completadaAt: estado === 'COMPLETADA' ? new Date() : null
    }
  })
}

const recargarViaticos = async (id, monto) => {
  const montoNumerico = validarMonto(monto, 'Monto de recarga')
  if (montoNumerico === 0) throw { status: 400, message: 'La recarga debe ser mayor que cero' }
  const viaje = await prisma.viaje.findUniqueOrThrow({
    where: { id },
    select: { estadoFinanciero: true }
  })
  if (viaje.estadoFinanciero === 'LIQUIDADO') {
    throw { status: 409, message: 'No se pueden recargar viaticos a un viaje liquidado' }
  }
  return prisma.viaje.update({
    where: { id },
    data: {
      viaticosDepositados: { increment: montoNumerico }
    }
  })
}

const confirmarDocumentacion = async (id) => {
  return prisma.viaje.update({
    where: { id },
    data: { documentacionRecibida: true }
  })
}

const listarPendientesLiquidacion = async (filtros = {}) => {
  const page = Math.max(1, Number(filtros.page) || 1)
  const pageSize = Math.min(50, Math.max(1, Number(filtros.pageSize) || 10))
  const where = {
    estadoLogistico: 'COMPLETADO',
    estadoFinanciero: 'PENDIENTE'
  }

  const [items, total] = await prisma.$transaction([
    prisma.viaje.findMany({
      where,
      include: viajePanelInclude,
      orderBy: [{ fechaCierre: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    prisma.viaje.count({ where })
  ])

  return { items, total, page, pageSize }
}

const actualizarHonorarios = async (id, honorariosChofer) => {
  const monto = validarMonto(honorariosChofer, 'Monto de honorarios')
  return prisma.viaje.update({
    where: { id },
    data: { honorariosChofer: monto }
  })
}

const cerrar = async (id, soloLogistica = false, numeroGuia = null, control = {}) => {
  if (numeroGuia !== null && (typeof numeroGuia !== 'string' || numeroGuia.trim().length > 100)) {
    throw { status: 400, message: 'Numero de guia invalido' }
  }
  const viaje = await prisma.viaje.findUniqueOrThrow({
    where: { id },
    include: { gastos: true, unidades: true }
  })
  if (viaje.estadoFinanciero === 'LIQUIDADO') {
    throw { status: 409, message: 'El viaje ya fue liquidado' }
  }
  if (soloLogistica && viaje.estadoLogistico === 'COMPLETADO') {
    throw { status: 409, message: 'La logistica del viaje ya fue completada' }
  }

  const totalGastado = viaje.gastos.reduce((acc, g) => acc + Number(g.monto), 0)
  const guia = numeroGuia?.trim() || viaje.numeroGuia
  const odometroFinal = validarNumeroOpcional(control.odometroFinal, 'Odometro final', { entero: true })
  const combustibleFinal = validarNumeroOpcional(control.combustibleFinal, 'Combustible final')

  return prisma.$transaction(async (tx) => {
    await tx.parada.updateMany({
      where: { viajeId: id, estado: { not: 'COMPLETADA' } },
      data: { estado: 'COMPLETADA', completadaAt: new Date() }
    })

    const actualizado = await tx.viaje.update({
      where: { id },
      data: {
        estadoLogistico: 'COMPLETADO',
        numeroGuia: guia,
        viaticosGastados: totalGastado,
        estadoFinanciero: soloLogistica ? 'PENDIENTE' : 'LIQUIDADO',
        fechaLiquidacion: soloLogistica ? null : new Date(),
        fechaCierre: new Date(),
        odometroFinal: odometroFinal ?? viaje.odometroFinal,
        combustibleFinal: combustibleFinal ?? viaje.combustibleFinal
      }
    })

    await recalcularEstadoRecursos(tx, viaje.choferId, tripUnitIds(viaje))
    return actualizado
  })
}

const recalcularEstadoRecursos = async (tx, choferId, camionIds) => {
  const unidadIds = Array.isArray(camionIds) ? camionIds : [camionIds]
  const [viajesChofer, camiones] = await Promise.all([
    tx.viaje.count({ where: { choferId, estadoLogistico: 'EN_CURSO' } }),
    tx.camion.findMany({ where: { id: { in: unidadIds } }, select: { id: true, estado: true } })
  ])

  await tx.chofer.update({
    where: { id: choferId },
    data: { estado: viajesChofer > 0 ? 'EN_RUTA' : 'DISPONIBLE' }
  })

  const disponibles = camiones.filter((camion) => camion.estado !== 'EN_TALLER').map((camion) => camion.id)
  for (const camionId of disponibles) {
    const viajesCamion = await tx.viaje.count({
      where: {
        estadoLogistico: 'EN_CURSO',
        OR: [
          { camionId },
          { unidades: { some: { camionId } } }
        ]
      }
    })
    await tx.camion.update({
      where: { id: camionId },
      data: { estado: viajesCamion > 0 ? 'EN_RUTA' : 'DISPONIBLE' }
    })
  }
}

module.exports = {
  listar,
  listarArchivo,
  obtener,
  crear,
  cerrar,
  recargarViaticos,
  confirmarDocumentacion,
  listarPendientesLiquidacion,
  actualizarHonorarios,
  agregarTramo,
  actualizarParada
}
