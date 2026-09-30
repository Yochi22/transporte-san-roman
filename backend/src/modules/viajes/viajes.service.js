const prisma = require('../../config/database')
const { generarCodigoViaje } = require('../../utils/generarCodigo')
const { choferPanelSelect, camionPanelSelect, reportePanelSelect } = require('../../utils/prismaSelects')

const DIAS_RETENCION_REPORTES = Math.max(1, Number(process.env.DIAS_RETENCION_REPORTES) || 5)

const fechaLimiteReportes = () => {
  const limite = new Date()
  limite.setDate(limite.getDate() - DIAS_RETENCION_REPORTES)
  return limite
}

const viajePanelInclude = () => ({
  empresa: { select: { id: true, nombre: true, activo: true } },
  chofer: { select: choferPanelSelect },
  camion: { select: camionPanelSelect },
  unidades: { include: { camion: { select: camionPanelSelect } } },
  paradas: {
    include: {
      empresaSede: { select: { id: true, nombre: true, ciudad: true, direccion: true, activo: true } }
    },
    orderBy: { orden: 'asc' }
  },
  reportes: { where: { createdAt: { gte: fechaLimiteReportes() } }, select: reportePanelSelect, orderBy: { createdAt: 'desc' }, take: 100 },
  gastos: { orderBy: { createdAt: 'desc' }, take: 200 }
})
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
    const empresaSedeId = tipo === 'CARGA' && typeof parada.empresaSedeId === 'string' && parada.empresaSedeId.trim()
      ? parada.empresaSedeId.trim()
      : null
    return { ...parada, tipo, lugar, ciudad, fechaProgramada, empresaSedeId }
  })
}

const validarEmpresaYSedes = async (empresaId, paradas, { exigirActiva = true } = {}) => {
  if (!empresaId || typeof empresaId !== 'string') {
    throw { status: 400, message: 'Selecciona la empresa del viaje' }
  }
  const sedeIds = [...new Set(paradas.map((parada) => parada.empresaSedeId).filter(Boolean))]
  const empresa = await prisma.empresa.findUnique({
    where: { id: empresaId },
    include: {
      sedes: {
        where: sedeIds.length > 0 ? { id: { in: sedeIds } } : undefined,
        select: { id: true, activo: true }
      }
    }
  })
  if (!empresa) throw { status: 404, message: 'Empresa no encontrada' }
  if (exigirActiva && !empresa.activo) {
    throw { status: 409, message: 'La empresa esta inactiva y no admite nuevos viajes' }
  }
  if (empresa.sedes.length !== sedeIds.length) {
    throw { status: 409, message: 'Una sede seleccionada no pertenece a la empresa' }
  }
  if (exigirActiva && empresa.sedes.some((sede) => !sede.activo)) {
    throw { status: 409, message: 'Una sede seleccionada esta inactiva' }
  }
  return empresa
}

const aplicarFiltroEmpresa = (where, empresaId) => {
  if (!empresaId) return
  where.empresaId = empresaId === 'sin_empresa' ? null : empresaId
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

const tieneTrabajoLogisticoPendienteWhere = {
  paradas: { some: { estado: { not: 'COMPLETADA' } } }
}

const estaPendienteDeLiquidacionWhere = {
  estadoFinanciero: 'PENDIENTE',
  paradas: { every: { estado: 'COMPLETADA' } }
}

const obtenerUltimaUbicacionLogistica = (viaje) => {
  const paradas = [...(viaje.paradas || [])].sort((a, b) => a.orden - b.orden)
  const parada = [...paradas].reverse().find((item) => item.tipo === 'DESCARGA') || paradas[paradas.length - 1]
  if (!parada) return null
  return parada.ciudad || parada.lugar || null
}

const listar = async (filtros = {}) => {
  const where = {}
  if (filtros.estadoLogistico) where.estadoLogistico = filtros.estadoLogistico
  if (filtros.estadoFinanciero) where.estadoFinanciero = filtros.estadoFinanciero
  aplicarFiltroEmpresa(where, filtros.empresaId)

  return prisma.viaje.findMany({
    where,
    include: viajePanelInclude(),
    orderBy: { createdAt: 'desc' },
    take: 500
  })
}

const listarArchivo = async (filtros = {}) => {
  const page = Math.max(1, Number(filtros.page) || 1)
  const pageSize = Math.min(50, Math.max(1, Number(filtros.pageSize) || 10))
  const where = {
    OR: [
      { estadoLogistico: { notIn: ['PENDIENTE', 'EN_CURSO'] } },
      estaPendienteDeLiquidacionWhere
    ]
  }
  aplicarFiltroEmpresa(where, filtros.empresaId)
  const rango = construirRangoArchivo(filtros.periodo, filtros.fecha)

  if (rango) {
    where.fechaCierre = { gte: rango.desde, lte: rango.hasta }
  }

  if (filtros.estadoFinanciero === 'LIQUIDADO' || filtros.estadoFinanciero === 'PENDIENTE') {
    where.estadoFinanciero = filtros.estadoFinanciero
  }

  const [items, total] = await prisma.$transaction([
    prisma.viaje.findMany({
      where,
      include: viajePanelInclude(),
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
    include: viajePanelInclude()
  })
}

const crear = async (datos, creadoPorId) => {
  const { choferId } = datos
  const empresaIdSolicitada = typeof datos.empresaId === 'string' && datos.empresaId.trim()
    ? datos.empresaId.trim()
    : null
  const tipoAgendamiento = datos.tipoAgendamiento === 'CONTINUAR' ? 'CONTINUAR' : 'NUEVO'
  const viajeContinuacionId = typeof datos.viajeContinuacionId === 'string' && datos.viajeContinuacionId.trim()
    ? datos.viajeContinuacionId.trim()
    : null
  if (tipoAgendamiento === 'CONTINUAR' && !viajeContinuacionId) {
    throw { status: 400, message: 'Selecciona el viaje pendiente que deseas continuar' }
  }
  let unidadIds = normalizarUnidadIdsViaje(datos)
  if (typeof choferId !== 'string') {
    throw { status: 400, message: 'Chofer es requerido' }
  }
  const paradas = validarParadas(datos.paradas)
  const viaticosDepositados = validarMonto(datos.viaticosDepositados, 'Monto de viaticos')
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
      ...tieneTrabajoLogisticoPendienteWhere,
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

  if (tipoAgendamiento === 'CONTINUAR') {
    const viajeContinuacion = await prisma.viaje.findUniqueOrThrow({
      where: { id: viajeContinuacionId },
      include: { paradas: { orderBy: { orden: 'asc' } }, unidades: true }
    })
    if (viajeContinuacion.choferId !== choferId) {
      throw { status: 409, message: 'El viaje seleccionado no pertenece al chofer' }
    }
    if (viajeContinuacion.estadoFinanciero !== 'PENDIENTE' || viajeContinuacion.estadoLogistico === 'CANCELADO') {
      throw { status: 409, message: 'El viaje seleccionado ya no admite nuevos tramos' }
    }
    if (viajeContinuacion.paradas.some((parada) => parada.estado !== 'COMPLETADA')) {
      throw { status: 409, message: 'Completa el tramo actual antes de agregar uno nuevo' }
    }
    if (!sameSet(unidadIds, tripUnitIds(viajeContinuacion))) {
      throw { status: 409, message: 'Las unidades deben coincidir con las del viaje que se continuara' }
    }
    if (viajeContinuacion.empresaId && empresaIdSolicitada && viajeContinuacion.empresaId !== empresaIdSolicitada) {
      throw { status: 409, message: 'El nuevo tramo debe conservar la empresa del viaje' }
    }
    const empresaId = viajeContinuacion.empresaId || empresaIdSolicitada
    await validarEmpresaYSedes(empresaId, paradas)
    return agregarTramo(viajeContinuacion.id, { paradas, viaticosDepositados, empresaId })
  }

  await validarEmpresaYSedes(empresaIdSolicitada, paradas)
  const codigo = generarCodigoViaje()
  const primeraCarga = paradas.find((parada) => parada.tipo === 'CARGA' && parada.fechaProgramada)

  const viaje = await prisma.viaje.create({
    data: {
      codigo,
      empresaId: empresaIdSolicitada,
      camionId,
      choferId,
      creadoPorId,
      viaticosDepositados,
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
          empresaSedeId: p.empresaSedeId,
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
    include: { paradas: true, unidades: true }
  })
  const empresaId = viaje.empresaId || datos.empresaId
  await validarEmpresaYSedes(empresaId, paradas)

  const ultimoOrden = viaje.paradas.reduce((max, parada) => Math.max(max, parada.orden), 0)
  const nuevoTramo = viaje.paradas.reduce((max, parada) => Math.max(max, parada.tramo || 1), 1) + 1

  await prisma.$transaction(async (tx) => {
    await tx.parada.createMany({
      data: paradas.map((parada, index) => ({
        viajeId: id,
        orden: ultimoOrden + index + 1,
        tramo: nuevoTramo,
        tipo: parada.tipo,
        empresaSedeId: parada.empresaSedeId,
        lugar: parada.lugar,
        ciudad: parada.ciudad,
        fechaProgramada: parada.fechaProgramada,
        cargarAlDescargar: parada.tipo === 'CARGA' && !!parada.cargarAlDescargar
      }))
    })
    await tx.viaje.update({
      where: { id },
      data: {
        empresaId,
        viaticosDepositados: { increment: viaticosDepositados },
        estadoLogistico: 'EN_CURSO',
        estadoFinanciero: 'PENDIENTE',
        fechaCierre: null
      }
    })
    await tx.camion.updateMany({ where: { id: { in: tripUnitIds(viaje) } }, data: { estado: 'EN_RUTA' } })
    await tx.chofer.update({ where: { id: viaje.choferId }, data: { estado: 'EN_RUTA' } })
  })

  const actualizado = await obtener(id)
  return { ...actualizado, tramoAgregado: nuevoTramo }
}

const actualizarParada = async (viajeId, paradaId, estado) => {
  if (!['PENDIENTE', 'EN_CURSO', 'COMPLETADA'].includes(estado)) {
    throw { status: 400, message: 'Estado de parada invalido' }
  }
  const parada = await prisma.parada.findFirstOrThrow({
    where: { id: paradaId, viajeId },
    include: { viaje: { select: { estadoLogistico: true, estadoFinanciero: true } } }
  })
  if (parada.viaje.estadoLogistico === 'COMPLETADO') {
    throw { status: 409, message: 'No se puede modificar una parada de un viaje cerrado' }
  }
  if (parada.viaje.estadoFinanciero === 'LIQUIDADO') {
    throw { status: 409, message: 'No se puede modificar un viaje liquidado' }
  }

  return prisma.$transaction(async (tx) => {
    const actualizada = await tx.parada.update({
      where: { id: parada.id },
      data: {
        estado,
        completadaAt: estado === 'COMPLETADA' ? new Date() : null
      }
    })

    const viaje = await tx.viaje.findUniqueOrThrow({
      where: { id: viajeId },
      include: { paradas: { orderBy: { orden: 'asc' } }, unidades: true }
    })
    const unidadIds = tripUnitIds(viaje)
    const tienePendientes = viaje.paradas.some((item) => item.estado !== 'COMPLETADA')

    if (tienePendientes) {
      await tx.viaje.update({ where: { id: viajeId }, data: { estadoLogistico: 'EN_CURSO', fechaCierre: null } })
      await tx.camion.updateMany({ where: { id: { in: unidadIds }, estado: { not: 'EN_TALLER' } }, data: { estado: 'EN_RUTA' } })
      await tx.chofer.update({ where: { id: viaje.choferId }, data: { estado: 'EN_RUTA' } })
    } else {
      await tx.viaje.update({ where: { id: viajeId }, data: { estadoLogistico: 'EN_CURSO', fechaCierre: viaje.fechaCierre || new Date() } })
      await recalcularEstadoRecursos(tx, viaje.choferId, unidadIds, obtenerUltimaUbicacionLogistica(viaje))
    }

    return actualizada
  })
}

const actualizarRuta = async (viajeId, paradasInput) => {
  const paradas = validarParadas(paradasInput)
  const viaje = await prisma.viaje.findUniqueOrThrow({
    where: { id: viajeId },
    include: {
      paradas: {
        include: { _count: { select: { reportes: true } } },
        orderBy: { orden: 'asc' }
      },
      unidades: true,
      empresa: { select: { id: true } }
    }
  })

  if (viaje.estadoFinanciero === 'LIQUIDADO') {
    throw { status: 409, message: 'No se puede editar la ruta de un viaje liquidado' }
  }
  const actualesPorId = new Map(viaje.paradas.map((parada) => [parada.id, parada]))
  if (viaje.empresaId) {
    const empresa = await validarEmpresaYSedes(viaje.empresaId, paradas, { exigirActiva: false })
    const sedesPorId = new Map(empresa.sedes.map((sede) => [sede.id, sede]))
    const asignaSedeInactiva = paradas.some((parada) => {
      if (!parada.empresaSedeId) return false
      const sedeAnterior = parada.id ? actualesPorId.get(parada.id)?.empresaSedeId : null
      return sedeAnterior !== parada.empresaSedeId && !sedesPorId.get(parada.empresaSedeId)?.activo
    })
    if (asignaSedeInactiva) {
      throw { status: 409, message: 'No se puede asignar una sede inactiva a una parada nueva' }
    }
  } else if (paradas.some((parada) => parada.empresaSedeId)) {
    throw { status: 409, message: 'Asigna una empresa al viaje antes de seleccionar una sede' }
  }

  const idsRecibidos = new Set(paradas.map((parada) => parada.id).filter(Boolean))

  for (const parada of paradas) {
    if (parada.id && !actualesPorId.has(parada.id)) {
      throw { status: 400, message: 'La ruta contiene una parada que no pertenece al viaje' }
    }
  }

  const omitidas = viaje.paradas.filter((parada) => !idsRecibidos.has(parada.id))
  for (const parada of omitidas) {
    if (parada.estado !== 'PENDIENTE' || parada._count.reportes > 0) {
      throw { status: 409, message: 'No se pueden eliminar paradas con avance o reportes. Ajusta sus datos o agrega una nueva parada.' }
    }
  }

  await prisma.$transaction(async (tx) => {
    for (const parada of omitidas) {
      await tx.parada.delete({ where: { id: parada.id } })
    }

    for (const [index, parada] of paradas.entries()) {
      const actual = parada.id ? actualesPorId.get(parada.id) : null
      const data = {
        orden: index + 1,
        tramo: actual?.tramo || parada.tramo || 1,
        tipo: actual && actual.estado !== 'PENDIENTE' ? actual.tipo : parada.tipo,
        empresaSedeId: parada.tipo === 'CARGA' ? parada.empresaSedeId : null,
        lugar: parada.lugar,
        ciudad: parada.ciudad,
        fechaProgramada: parada.tipo === 'CARGA' ? parada.fechaProgramada : null,
        cargarAlDescargar: parada.tipo === 'CARGA' && !!parada.cargarAlDescargar
      }

      if (actual) {
        await tx.parada.update({ where: { id: actual.id }, data })
      } else {
        await tx.parada.create({
          data: {
            ...data,
            viajeId,
            estado: 'PENDIENTE'
          }
        })
      }
    }

    const tienePendientes = paradas.some((parada) => {
      const actual = parada.id ? actualesPorId.get(parada.id) : null
      return !actual || actual.estado !== 'COMPLETADA'
    })

    await tx.viaje.update({
      where: { id: viajeId },
      data: {
        estadoLogistico: 'EN_CURSO',
        fechaCierre: tienePendientes ? null : viaje.fechaCierre
      }
    })

    if (tienePendientes) {
      const unidadIds = tripUnitIds(viaje)
      await tx.camion.updateMany({ where: { id: { in: unidadIds }, estado: { not: 'EN_TALLER' } }, data: { estado: 'EN_RUTA' } })
      await tx.chofer.update({ where: { id: viaje.choferId }, data: { estado: 'EN_RUTA' } })
    }
  })

  return obtener(viajeId)
}

const cancelar = async (id) => {
  const viaje = await prisma.viaje.findUniqueOrThrow({
    where: { id },
    include: {
      paradas: true,
      reportes: { select: { id: true }, take: 1 },
      gastos: { select: { id: true }, take: 1 },
      unidades: true,
      chofer: { select: { ubicacionActual: true } },
      retornablesOrigen: { select: { id: true }, take: 1 },
      retornableMovimientos: { select: { id: true }, take: 1 }
    }
  })

  if (viaje.estadoFinanciero === 'LIQUIDADO') {
    throw { status: 409, message: 'No se puede cancelar un viaje liquidado' }
  }
  if (viaje.estadoLogistico === 'CANCELADO') {
    throw { status: 409, message: 'El viaje ya fue cancelado' }
  }
  if (viaje.paradas.some((parada) => parada.estado !== 'PENDIENTE')) {
    throw { status: 409, message: 'Solo se puede cancelar antes de iniciar la carga o cualquier parada' }
  }
  if (viaje.reportes.length || viaje.gastos.length || viaje.retornablesOrigen.length || viaje.retornableMovimientos.length) {
    throw { status: 409, message: 'No se puede cancelar un viaje con reportes, gastos o retornables vinculados' }
  }

  return prisma.$transaction(async (tx) => {
    const actualizado = await tx.viaje.update({
      where: { id },
      data: { estadoLogistico: 'CANCELADO', fechaCierre: new Date() }
    })
    await recalcularEstadoRecursos(tx, viaje.choferId, tripUnitIds(viaje), viaje.chofer?.ubicacionActual || null)
    return actualizado
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
  const where = { ...estaPendienteDeLiquidacionWhere }
  aplicarFiltroEmpresa(where, filtros.empresaId)

  const [items, total] = await prisma.$transaction([
    prisma.viaje.findMany({
      where,
      include: viajePanelInclude(),
      orderBy: [{ fechaCierre: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    prisma.viaje.count({ where })
  ])

  return { items, total, page, pageSize }
}


const cerrar = async (id, soloLogistica = false, numeroGuia = null) => {
  if (numeroGuia !== null && (typeof numeroGuia !== 'string' || numeroGuia.trim().length > 100)) {
    throw { status: 400, message: 'Numero de guia invalido' }
  }
  const viaje = await prisma.viaje.findUniqueOrThrow({
    where: { id },
    include: { gastos: true, unidades: true, paradas: { orderBy: { orden: 'asc' } } }
  })
  if (viaje.estadoFinanciero === 'LIQUIDADO') {
    throw { status: 409, message: 'El viaje ya fue liquidado' }
  }
  const yaCompletoParadas = viaje.paradas.every((parada) => parada.estado === 'COMPLETADA')
  if (soloLogistica && yaCompletoParadas) {
    throw { status: 409, message: 'El tramo logistico ya fue completado' }
  }

  const totalGastado = viaje.gastos.reduce((acc, g) => acc + Number(g.monto), 0)
  const guia = numeroGuia?.trim() || viaje.numeroGuia
  const ultimaUbicacion = obtenerUltimaUbicacionLogistica(viaje)

  return prisma.$transaction(async (tx) => {
    await tx.parada.updateMany({
      where: { viajeId: id, estado: { not: 'COMPLETADA' } },
      data: { estado: 'COMPLETADA', completadaAt: new Date() }
    })

    const actualizado = await tx.viaje.update({
      where: { id },
      data: {
        estadoLogistico: soloLogistica ? 'EN_CURSO' : 'COMPLETADO',
        numeroGuia: guia,
        viaticosGastados: totalGastado,
        estadoFinanciero: soloLogistica ? 'PENDIENTE' : 'LIQUIDADO',
        fechaLiquidacion: soloLogistica ? null : new Date(),
        fechaCierre: new Date()
      }
    })

    await recalcularEstadoRecursos(tx, viaje.choferId, tripUnitIds(viaje), ultimaUbicacion)
    return actualizado
  })
}

const recalcularEstadoRecursos = async (tx, choferId, camionIds, ubicacion = null) => {
  const unidadIds = Array.isArray(camionIds) ? camionIds : [camionIds]
  const [viajesChofer, camiones] = await Promise.all([
    tx.viaje.count({ where: { choferId, estadoLogistico: 'EN_CURSO', ...tieneTrabajoLogisticoPendienteWhere } }),
    tx.camion.findMany({ where: { id: { in: unidadIds } }, select: { id: true, estado: true } })
  ])

  await tx.chofer.update({
    where: { id: choferId },
    data: { estado: viajesChofer > 0 ? 'EN_RUTA' : 'DISPONIBLE', ubicacionActual: ubicacion || undefined }
  })

  const disponibles = camiones.filter((camion) => camion.estado !== 'EN_TALLER').map((camion) => camion.id)
  for (const camionId of disponibles) {
    const viajesCamion = await tx.viaje.count({
      where: {
        estadoLogistico: 'EN_CURSO',
        ...tieneTrabajoLogisticoPendienteWhere,
        OR: [
          { camionId },
          { unidades: { some: { camionId } } }
        ]
      }
    })
    await tx.camion.update({
      where: { id: camionId },
      data: { estado: viajesCamion > 0 ? 'EN_RUTA' : 'DISPONIBLE', ubicacionActual: ubicacion || undefined }
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
  agregarTramo,
  actualizarRuta,
  cancelar,
  actualizarParada
}
