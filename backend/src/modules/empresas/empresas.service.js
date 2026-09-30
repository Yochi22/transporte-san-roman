const prisma = require('../../config/database')

const normalizarNombre = (valor, campo = 'Nombre', max = 120) => {
  const texto = String(valor || '').trim()
  if (texto.length < 2 || texto.length > max) {
    throw { status: 400, message: `${campo} invalido` }
  }
  return texto
}

const normalizarOpcional = (valor, max = 250) => {
  const texto = String(valor || '').trim()
  if (!texto) return null
  if (texto.length > max) throw { status: 400, message: 'Texto demasiado largo' }
  return texto
}

const normalizarSede = (datos) => ({
  nombre: normalizarNombre(datos.nombre, 'Nombre de sede', 120),
  ciudad: normalizarNombre(datos.ciudad, 'Ciudad', 100),
  direccion: normalizarOpcional(datos.direccion),
})

const filtroActivo = (estado) => {
  if (estado === 'todos') return undefined
  if (estado === 'inactivos') return false
  return true
}

const agruparConteos = (filas) => new Map(
  filas.filter((fila) => fila.empresaId).map((fila) => [fila.empresaId, fila._count._all])
)

const listar = async (filtros = {}) => {
  const activo = filtroActivo(filtros.estado)
  const q = String(filtros.q || '').trim()
  const where = {
    activo,
    ...(q ? {
      OR: [
        { nombre: { contains: q, mode: 'insensitive' } },
        { sedes: { some: { nombre: { contains: q, mode: 'insensitive' } } } },
        { sedes: { some: { ciudad: { contains: q, mode: 'insensitive' } } } },
      ]
    } : {})
  }

  const [empresas, totales, activos, finalizados, liquidados] = await prisma.$transaction([
    prisma.empresa.findMany({
      where,
      include: {
        sedes: { orderBy: [{ activo: 'desc' }, { nombre: 'asc' }] }
      },
      orderBy: [{ activo: 'desc' }, { nombre: 'asc' }],
      take: 500
    }),
    prisma.viaje.groupBy({
      by: ['empresaId'],
      where: { empresaId: { not: null }, estadoLogistico: { not: 'CANCELADO' } },
      _count: { _all: true }
    }),
    prisma.viaje.groupBy({
      by: ['empresaId'],
      where: {
        empresaId: { not: null },
        estadoLogistico: 'EN_CURSO',
        paradas: { some: { estado: { not: 'COMPLETADA' } } }
      },
      _count: { _all: true }
    }),
    prisma.viaje.groupBy({
      by: ['empresaId'],
      where: {
        empresaId: { not: null },
        estadoLogistico: { not: 'CANCELADO' },
        paradas: { every: { estado: 'COMPLETADA' } }
      },
      _count: { _all: true }
    }),
    prisma.viaje.groupBy({
      by: ['empresaId'],
      where: { empresaId: { not: null }, estadoFinanciero: 'LIQUIDADO' },
      _count: { _all: true }
    })
  ])

  const mapas = [totales, activos, finalizados, liquidados].map(agruparConteos)
  return empresas.map((empresa) => ({
    ...empresa,
    estadisticas: {
      totalViajes: mapas[0].get(empresa.id) || 0,
      activos: mapas[1].get(empresa.id) || 0,
      finalizados: mapas[2].get(empresa.id) || 0,
      liquidados: mapas[3].get(empresa.id) || 0,
    }
  }))
}

const obtener = async (id) => prisma.empresa.findUniqueOrThrow({
  where: { id },
  include: { sedes: { orderBy: [{ activo: 'desc' }, { nombre: 'asc' }] } }
})

const asegurarNombreEmpresaUnico = async (nombre, excluirId = null) => {
  const existente = await prisma.empresa.findFirst({
    where: {
      nombre: { equals: nombre, mode: 'insensitive' },
      ...(excluirId ? { id: { not: excluirId } } : {})
    },
    select: { id: true }
  })
  if (existente) throw { status: 409, message: 'Ya existe una empresa con ese nombre' }
}

const crear = async (datos) => {
  const nombre = normalizarNombre(datos.nombre, 'Nombre de empresa')
  await asegurarNombreEmpresaUnico(nombre)
  const sedesInput = Array.isArray(datos.sedes) ? datos.sedes : []
  if (sedesInput.length > 50) throw { status: 400, message: 'Demasiadas sedes' }
  const sedes = sedesInput.map(normalizarSede)

  return prisma.empresa.create({
    data: {
      nombre,
      sedes: sedes.length > 0 ? { create: sedes } : undefined
    },
    include: { sedes: { orderBy: { nombre: 'asc' } } }
  })
}

const actualizar = async (id, datos) => {
  const actual = await prisma.empresa.findUniqueOrThrow({ where: { id } })
  const nombre = datos.nombre === undefined
    ? actual.nombre
    : normalizarNombre(datos.nombre, 'Nombre de empresa')
  await asegurarNombreEmpresaUnico(nombre, id)
  return prisma.empresa.update({
    where: { id },
    data: {
      nombre,
      activo: typeof datos.activo === 'boolean' ? datos.activo : undefined
    },
    include: { sedes: { orderBy: [{ activo: 'desc' }, { nombre: 'asc' }] } }
  })
}

const cambiarEstado = async (id, activo) => prisma.empresa.update({
  where: { id },
  data: { activo },
  include: { sedes: { orderBy: [{ activo: 'desc' }, { nombre: 'asc' }] } }
})

const eliminar = async (id) => {
  const empresa = await prisma.empresa.findUniqueOrThrow({
    where: { id },
    select: {
      _count: {
        select: {
          viajes: true,
          sedes: { where: { paradas: { some: {} } } }
        }
      }
    }
  })
  if (empresa._count.viajes > 0 || empresa._count.sedes > 0) {
    throw { status: 409, message: 'La empresa tiene historial. Inactivala para conservar las estadisticas.' }
  }
  return prisma.empresa.delete({ where: { id } })
}

const crearSede = async (empresaId, datos) => {
  const empresa = await prisma.empresa.findUniqueOrThrow({ where: { id: empresaId } })
  if (!empresa.activo) throw { status: 409, message: 'Reactiva la empresa antes de agregar sedes' }
  const sede = normalizarSede(datos)
  return prisma.empresaSede.create({ data: { ...sede, empresaId } })
}

const actualizarSede = async (empresaId, sedeId, datos) => {
  await prisma.empresaSede.findFirstOrThrow({ where: { id: sedeId, empresaId } })
  const sede = normalizarSede(datos)
  return prisma.empresaSede.update({
    where: { id: sedeId },
    data: {
      ...sede,
      activo: typeof datos.activo === 'boolean' ? datos.activo : undefined
    }
  })
}

const cambiarEstadoSede = async (empresaId, sedeId, activo) => {
  await prisma.empresaSede.findFirstOrThrow({ where: { id: sedeId, empresaId } })
  if (activo) {
    const empresa = await prisma.empresa.findUniqueOrThrow({ where: { id: empresaId } })
    if (!empresa.activo) throw { status: 409, message: 'Reactiva primero la empresa' }
  }
  return prisma.empresaSede.update({ where: { id: sedeId }, data: { activo } })
}

const eliminarSede = async (empresaId, sedeId) => {
  const sede = await prisma.empresaSede.findFirstOrThrow({
    where: { id: sedeId, empresaId },
    select: { id: true, _count: { select: { paradas: true } } }
  })
  if (sede._count.paradas > 0) {
    throw { status: 409, message: 'La sede tiene viajes asociados. Inactivala para conservar el historial.' }
  }
  return prisma.empresaSede.delete({ where: { id: sedeId } })
}

module.exports = {
  listar,
  obtener,
  crear,
  actualizar,
  cambiarEstado,
  eliminar,
  crearSede,
  actualizarSede,
  cambiarEstadoSede,
  eliminarSede,
}
