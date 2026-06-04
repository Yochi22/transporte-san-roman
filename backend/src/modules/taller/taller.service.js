const prisma = require('../../config/database')

const listar = async (filtros = {}) => {
  const page = Math.max(1, Number(filtros.page) || 1)
  const pageSize = Math.min(50, Math.max(1, Number(filtros.pageSize) || 10))
  const where = {}
  if (filtros.estado && filtros.estado !== 'TODOS') where.estado = filtros.estado
  if (filtros.camionId) where.camionId = filtros.camionId

  const [items, total, activos] = await prisma.$transaction([
    prisma.mantenimientoVehiculo.findMany({
      where,
      include: { camion: true },
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
  if (!datos.camionId || !datos.falla?.trim()) {
    throw { status: 400, message: 'La unidad y la falla o trabajo son requeridos' }
  }

  return prisma.$transaction(async (tx) => {
    const mantenimiento = await tx.mantenimientoVehiculo.create({
      data: {
        camionId: datos.camionId,
        tipo: datos.tipo || 'REPARACION',
        falla: datos.falla.trim(),
        descripcion: datos.descripcion?.trim() || null,
        kilometraje: datos.kilometraje ? Number(datos.kilometraje) : null,
        costo: Number(datos.costo) || 0,
        fechaIngreso: datos.fechaIngreso ? new Date(datos.fechaIngreso) : new Date()
      },
      include: { camion: true }
    })

    await tx.camion.update({
      where: { id: datos.camionId },
      data: { estado: 'EN_TALLER', motivoTaller: datos.falla.trim() }
    })
    return mantenimiento
  })
}

const completar = async (id, datos = {}) => {
  const mantenimiento = await prisma.mantenimientoVehiculo.findUniqueOrThrow({ where: { id } })

  return prisma.$transaction(async (tx) => {
    const actualizado = await tx.mantenimientoVehiculo.update({
      where: { id },
      data: {
        estado: 'COMPLETADO',
        fechaSalida: datos.fechaSalida ? new Date(datos.fechaSalida) : new Date(),
        costo: datos.costo === undefined ? mantenimiento.costo : Number(datos.costo) || 0,
        descripcion: datos.descripcion?.trim() || mantenimiento.descripcion
      },
      include: { camion: true }
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
