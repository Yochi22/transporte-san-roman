const prisma = require('../../config/database')
const { TIPOS_CHOFER, TIPOS_CAMION, DIAS_POR_VENCER, DIAS_PROXIMO, etiquetaTipo } = require('./documentos.catalogo')
const { parsearFecha, formatearFecha, hoyCaracas, sumarDias, diasEntre } = require('../../utils/fechasCaracas')

const ESTADOS = new Set(['VENCIDO', 'POR_VENCER', 'PROXIMO', 'VIGENTE', 'NO_VENCE'])

const documentoInclude = {
  chofer: { select: { id: true, nombre: true, cedula: true, activo: true } },
  camion: { select: { id: true, placa: true, tipoVehiculo: true, activo: true } },
}

const calcularEstado = (fechaVencimiento, hoy) => {
  if (!fechaVencimiento) return { estado: 'NO_VENCE', diasRestantes: null }
  const diasRestantes = diasEntre(hoy, fechaVencimiento)
  if (diasRestantes < 0) return { estado: 'VENCIDO', diasRestantes }
  if (diasRestantes <= DIAS_POR_VENCER) return { estado: 'POR_VENCER', diasRestantes }
  if (diasRestantes <= DIAS_PROXIMO) return { estado: 'PROXIMO', diasRestantes }
  return { estado: 'VIGENTE', diasRestantes }
}

const presentar = (documento, hoy) => ({
  id: documento.id,
  entidad: documento.choferId ? 'chofer' : 'camion',
  choferId: documento.choferId,
  camionId: documento.camionId,
  titular: documento.chofer?.nombre || documento.camion?.placa || null,
  titularDetalle: documento.chofer?.cedula || documento.camion?.tipoVehiculo || null,
  titularActivo: documento.chofer ? documento.chofer.activo : Boolean(documento.camion?.activo),
  tipo: documento.tipo,
  tipoEtiqueta: etiquetaTipo(documento.tipo),
  numero: documento.numero,
  fechaVencimiento: formatearFecha(documento.fechaVencimiento),
  nota: documento.nota,
  updatedAt: documento.updatedAt,
  ...calcularEstado(documento.fechaVencimiento, hoy),
})

// Condicion Prisma equivalente a cada estado, para filtrar en la base.
const condicionEstado = (estado, hoy) => {
  const limitePorVencer = sumarDias(hoy, DIAS_POR_VENCER)
  const limiteProximo = sumarDias(hoy, DIAS_PROXIMO)
  if (estado === 'VENCIDO') return { fechaVencimiento: { lt: hoy } }
  if (estado === 'POR_VENCER') return { fechaVencimiento: { gte: hoy, lte: limitePorVencer } }
  if (estado === 'PROXIMO') return { fechaVencimiento: { gt: limitePorVencer, lte: limiteProximo } }
  if (estado === 'VIGENTE') return { fechaVencimiento: { gt: limiteProximo } }
  return { fechaVencimiento: null }
}

const soloTitularesActivos = { OR: [{ chofer: { activo: true } }, { camion: { activo: true } }] }

const listar = async (filtros = {}) => {
  const hoy = hoyCaracas()
  const condiciones = []

  if (filtros.estado && filtros.estado !== 'TODOS') {
    if (!ESTADOS.has(filtros.estado)) throw { status: 400, message: 'Estado de documento invalido' }
    condiciones.push(condicionEstado(filtros.estado, hoy))
  }

  const desde = filtros.desde ? parsearFecha(filtros.desde) : null
  const hasta = filtros.hasta ? parsearFecha(filtros.hasta) : null
  if ((filtros.desde && !desde) || (filtros.hasta && !hasta)) {
    throw { status: 400, message: 'Fecha invalida. Usa el formato AAAA-MM-DD' }
  }
  if (desde && hasta && desde > hasta) throw { status: 400, message: 'El rango de fechas esta invertido' }
  if (desde || hasta) {
    condiciones.push({ fechaVencimiento: { ...(desde ? { gte: desde } : {}), ...(hasta ? { lte: hasta } : {}) } })
  }

  if (filtros.entidad === 'chofer') condiciones.push({ choferId: { not: null } })
  else if (filtros.entidad === 'camion') condiciones.push({ camionId: { not: null } })
  if (typeof filtros.choferId === 'string' && filtros.choferId) condiciones.push({ choferId: filtros.choferId })
  if (typeof filtros.camionId === 'string' && filtros.camionId) condiciones.push({ camionId: filtros.camionId })
  if (typeof filtros.tipo === 'string' && filtros.tipo) condiciones.push({ tipo: filtros.tipo })

  // La ficha de un chofer/unidad muestra sus documentos aunque este inactivo;
  // la lista general solo considera recursos activos salvo que se pida lo contrario.
  const esFicha = Boolean(filtros.choferId || filtros.camionId)
  if (!esFicha && filtros.incluirInactivos !== 'true') condiciones.push(soloTitularesActivos)

  const q = typeof filtros.q === 'string' ? filtros.q.trim().slice(0, 80) : ''
  if (q) {
    condiciones.push({
      OR: [
        { chofer: { nombre: { contains: q, mode: 'insensitive' } } },
        { chofer: { cedula: { contains: q, mode: 'insensitive' } } },
        { camion: { placa: { contains: q, mode: 'insensitive' } } },
      ],
    })
  }

  const documentos = await prisma.documentoVencimiento.findMany({
    where: { AND: condiciones },
    include: documentoInclude,
    // Lo mas urgente primero; los que no vencen (fecha nula) quedan al final.
    orderBy: [{ fechaVencimiento: { sort: 'asc', nulls: 'last' } }, { tipo: 'asc' }],
    take: 2000,
  })
  return documentos.map((documento) => presentar(documento, hoy))
}

// Conteos y peor estado por recurso, para el contador del menu y las marcas
// en las tablas de choferes/unidades. Es liviano: va en el refresco general.
const obtenerResumen = async () => {
  const hoy = hoyCaracas()
  const documentos = await prisma.documentoVencimiento.findMany({
    where: { AND: [soloTitularesActivos, { fechaVencimiento: { lte: sumarDias(hoy, DIAS_PROXIMO) } }] },
    select: { choferId: true, camionId: true, fechaVencimiento: true },
  })

  const resumen = { vencidos: 0, porVencer: 0, proximos: 0, choferes: {}, camiones: {} }
  const prioridad = { VENCIDO: 3, POR_VENCER: 2, PROXIMO: 1 }
  for (const documento of documentos) {
    const { estado } = calcularEstado(documento.fechaVencimiento, hoy)
    if (estado === 'VENCIDO') resumen.vencidos += 1
    else if (estado === 'POR_VENCER') resumen.porVencer += 1
    else resumen.proximos += 1

    const mapa = documento.choferId ? resumen.choferes : resumen.camiones
    const id = documento.choferId || documento.camionId
    if (!mapa[id] || prioridad[estado] > prioridad[mapa[id]]) mapa[id] = estado
  }
  return resumen
}

const textoOpcional = (valor, max, campo) => {
  if (valor === undefined || valor === null) return null
  if (typeof valor !== 'string') throw { status: 400, message: `${campo} invalido` }
  const texto = valor.trim()
  if (!texto) return null
  if (texto.length > max) throw { status: 400, message: `${campo} demasiado largo` }
  return texto
}

const validarFechaVencimiento = (valor) => {
  if (valor === undefined || valor === null || valor === '') return null
  const fecha = parsearFecha(valor)
  if (!fecha) throw { status: 400, message: 'Fecha de vencimiento invalida. Usa el formato AAAA-MM-DD' }
  const anio = fecha.getUTCFullYear()
  if (anio < 2000 || anio > 2100) throw { status: 400, message: 'Fecha de vencimiento fuera de rango' }
  return fecha
}

const crear = async (datos = {}) => {
  const choferId = typeof datos.choferId === 'string' && datos.choferId.trim() ? datos.choferId.trim() : null
  const camionId = typeof datos.camionId === 'string' && datos.camionId.trim() ? datos.camionId.trim() : null
  if (Boolean(choferId) === Boolean(camionId)) {
    throw { status: 400, message: 'El documento debe pertenecer a un chofer o a una unidad' }
  }
  const catalogo = choferId ? TIPOS_CHOFER : TIPOS_CAMION
  if (typeof datos.tipo !== 'string' || !Object.hasOwn(catalogo, datos.tipo)) {
    throw { status: 400, message: 'Tipo de documento invalido' }
  }
  const data = {
    choferId,
    camionId,
    tipo: datos.tipo,
    numero: textoOpcional(datos.numero, 60, 'Numero'),
    fechaVencimiento: validarFechaVencimiento(datos.fechaVencimiento),
    nota: textoOpcional(datos.nota, 300, 'Nota'),
  }

  if (choferId) await prisma.chofer.findUniqueOrThrow({ where: { id: choferId }, select: { id: true } })
  else await prisma.camion.findUniqueOrThrow({ where: { id: camionId }, select: { id: true } })

  const existente = await prisma.documentoVencimiento.findFirst({
    where: { choferId, camionId, tipo: data.tipo },
    select: { id: true },
  })
  if (existente) {
    throw { status: 409, message: `Ya existe un documento "${etiquetaTipo(data.tipo)}" para este registro. Editalo para renovar la fecha.` }
  }

  const documento = await prisma.documentoVencimiento.create({ data, include: documentoInclude })
  return presentar(documento, hoyCaracas())
}

// El tipo y el dueno no se editan: para cambiarlos se elimina y se crea otro.
const actualizar = async (id, datos = {}) => {
  await prisma.documentoVencimiento.findUniqueOrThrow({ where: { id }, select: { id: true } })
  const data = {}
  if (datos.fechaVencimiento !== undefined) data.fechaVencimiento = validarFechaVencimiento(datos.fechaVencimiento)
  if (datos.numero !== undefined) data.numero = textoOpcional(datos.numero, 60, 'Numero')
  if (datos.nota !== undefined) data.nota = textoOpcional(datos.nota, 300, 'Nota')
  if (Object.keys(data).length === 0) throw { status: 400, message: 'No hay cambios para guardar' }

  const documento = await prisma.documentoVencimiento.update({ where: { id }, data, include: documentoInclude })
  return presentar(documento, hoyCaracas())
}

const eliminar = async (id) => {
  await prisma.documentoVencimiento.delete({ where: { id } })
}

const obtenerCatalogo = () => ({
  chofer: Object.entries(TIPOS_CHOFER).map(([valor, etiqueta]) => ({ valor, etiqueta })),
  camion: Object.entries(TIPOS_CAMION).map(([valor, etiqueta]) => ({ valor, etiqueta })),
  diasPorVencer: DIAS_POR_VENCER,
  diasProximo: DIAS_PROXIMO,
})

module.exports = { listar, obtenerResumen, crear, actualizar, eliminar, obtenerCatalogo, calcularEstado }
