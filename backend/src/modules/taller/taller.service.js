const prisma = require('../../config/database')
const { camionPanelSelect } = require('../../utils/prismaSelects')
const TIPOS_MANTENIMIENTO = new Set(['REPARACION', 'CAMBIO_ACEITE', 'CAUCHOS', 'FRENOS', 'BATERIA', 'REVISION', 'OTRO'])

const validarNumero = (valor, campo, entero = false) => {
  if (valor === undefined || valor === null || valor === '') return null
  const numero = Number(valor)
  if (!Number.isFinite(numero) || numero < 0 || numero > 1_000_000_000 || (entero && !Number.isInteger(numero))) {
    throw { status: 400, message: `${campo} invalido` }
  }
  return numero
}

const validarFecha = (valor, campo) => {
  const fecha = valor ? new Date(valor) : new Date()
  if (Number.isNaN(fecha.getTime())) throw { status: 400, message: `${campo} invalida` }
  return fecha
}

const listar = async (filtros = {}) => {
  const page = Math.max(1, Number(filtros.page) || 1)
  const pageSize = Math.min(50, Math.max(1, Number(filtros.pageSize) || 10))
  const where = {}
  if (filtros.estado && filtros.estado !== 'TODOS') where.estado = filtros.estado
  if (filtros.camionId) where.camionId = filtros.camionId

  const [items, total, activos] = await prisma.$transaction([
    prisma.mantenimientoVehiculo.findMany({
      where,
      include: { camion: { select: camionPanelSelect } },
      orderBy: [{ estado: 'asc' }, { fechaIngreso: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    prisma.mantenimientoVehiculo.count({ where }),
    prisma.mantenimientoVehiculo.count({ where: { estado: 'EN_PROCESO' } })
  ])

  return { items, total, activos, page, pageSize }
}

const crear = async (datos) => {
  const falla = datos.falla?.trim()
  const descripcion = datos.descripcion?.trim() || null
  const tipo = datos.tipo || 'REPARACION'
  if (!datos.camionId || !falla) {
    throw { status: 400, message: 'La unidad y la falla o trabajo son requeridos' }
  }
  if (!TIPOS_MANTENIMIENTO.has(tipo)) throw { status: 400, message: 'Tipo de mantenimiento invalido' }
  if (falla.length > 200 || descripcion?.length > 1000) {
    throw { status: 400, message: 'Descripcion de mantenimiento demasiado larga' }
  }

  const kilometraje = validarNumero(datos.kilometraje, 'Kilometraje', true)
  const costo = validarNumero(datos.costo, 'Costo') || 0
  const fechaIngreso = validarFecha(datos.fechaIngreso, 'Fecha de ingreso')

  return prisma.$transaction(async (tx) => {
    const camion = await tx.camion.findUniqueOrThrow({ where: { id: datos.camionId } })
    if (!camion.activo) throw { status: 409, message: 'La unidad no esta activa' }

    const mantenimiento = await tx.mantenimientoVehiculo.create({
      data: {
        camionId: datos.camionId,
        tipo,
        falla,
        descripcion,
        kilometraje,
        costo,
        fechaIngreso
      },
      include: { camion: { select: camionPanelSelect } }
    })

    await tx.camion.update({
      where: { id: datos.camionId },
      data: { estado: 'EN_TALLER', motivoTaller: falla }
    })
    return mantenimiento
  })
}

const completar = async (id, datos = {}) => {
  const mantenimiento = await prisma.mantenimientoVehiculo.findUniqueOrThrow({ where: { id } })
  if (mantenimiento.estado === 'COMPLETADO') {
    throw { status: 409, message: 'El mantenimiento ya fue completado' }
  }
  const fechaSalida = validarFecha(datos.fechaSalida, 'Fecha de salida')
  const costo = datos.costo === undefined
    ? mantenimiento.costo
    : validarNumero(datos.costo, 'Costo') || 0
  const descripcion = datos.descripcion?.trim() || mantenimiento.descripcion
  if (descripcion?.length > 1000) throw { status: 400, message: 'Descripcion demasiado larga' }

  return prisma.$transaction(async (tx) => {
    const actualizado = await tx.mantenimientoVehiculo.update({
      where: { id },
      data: {
        estado: 'COMPLETADO',
        fechaSalida,
        costo,
        descripcion
      },
      include: { camion: { select: camionPanelSelect } }
    })

    const [otrosActivos, viajesActivos] = await Promise.all([
      tx.mantenimientoVehiculo.count({
        where: { camionId: mantenimiento.camionId, estado: 'EN_PROCESO', id: { not: id } }
      }),
      tx.viaje.count({ where: { camionId: mantenimiento.camionId, estadoLogistico: 'EN_CURSO' } })
    ])

    if (otrosActivos === 0) {
      await tx.camion.update({
        where: { id: mantenimiento.camionId },
        data: {
          estado: viajesActivos > 0 ? 'EN_RUTA' : 'DISPONIBLE',
          motivoTaller: null
        }
      })
    }
    return actualizado
  })
}

module.exports = { listar, crear, completar }
