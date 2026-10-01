const prisma = require('../../config/database')
const { aplicarReporteChofer } = require('../../services/reportes/aplicarReporte.service')

const TIPOS_VALIDOS = new Set(['CARGANDO', 'DESCARGADO', 'ESPERANDO_INSTRUCCIONES', 'LIBRE', 'NOVEDAD', 'OTRO'])
const ESTADOS_PARADA_VALIDOS = new Set(['EN_CURSO', 'COMPLETADA'])
const TIPOS_CON_PARADA = new Set(['CARGANDO', 'DESCARGADO'])

const TEXTO_POR_DEFECTO = {
  'CARGANDO:EN_CURSO': 'Estoy cargando',
  'CARGANDO:COMPLETADA': 'Lista la carga',
  'DESCARGADO:EN_CURSO': 'Estoy descargando',
  'DESCARGADO:COMPLETADA': 'Lista la descarga',
  ESPERANDO_INSTRUCCIONES: 'Esperando instrucciones',
}

const viajeChoferSelect = {
  id: true,
  codigo: true,
  camionId: true,
  choferId: true,
  estadoLogistico: true,
  createdAt: true,
  empresa: { select: { nombre: true } },
  camion: { select: { id: true, placa: true, tipoVehiculo: true } },
  unidades: { select: { camion: { select: { id: true, placa: true, tipoVehiculo: true } } } },
  paradas: {
    orderBy: { orden: 'asc' },
    select: {
      id: true,
      orden: true,
      tramo: true,
      tipo: true,
      lugar: true,
      ciudad: true,
      estado: true,
      fechaProgramada: true,
      cargarAlDescargar: true,
    },
  },
  reportes: {
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: { id: true, tipoReporte: true, ubicacion: true, mensajeOriginal: true, origen: true, createdAt: true },
  },
}

const obtenerMiViaje = async (choferId) => {
  const chofer = await prisma.chofer.findUniqueOrThrow({
    where: { id: choferId },
    select: { id: true, nombre: true, telefono: true, ubicacionActual: true },
  })
  const viajes = await prisma.viaje.findMany({
    where: { choferId, estadoLogistico: 'EN_CURSO' },
    orderBy: { createdAt: 'asc' },
    select: viajeChoferSelect,
  })
  return { chofer, viajes }
}

const registrarReporte = async ({ choferId, viajeId, paradaId, tipoReporte, estadoParada, ubicacion, mensaje }, socketIO) => {
  if (!TIPOS_VALIDOS.has(tipoReporte)) {
    throw { status: 400, message: 'Tipo de reporte invalido' }
  }
  if (typeof viajeId !== 'string' || !viajeId.trim()) {
    throw { status: 400, message: 'Viaje requerido' }
  }
  if ((tipoReporte === 'NOVEDAD' || tipoReporte === 'OTRO') && !mensaje?.trim()) {
    throw { status: 400, message: 'Escribe el reporte' }
  }
  if (tipoReporte === 'LIBRE' && !ubicacion?.trim()) {
    throw { status: 400, message: 'Escribe donde quedaron disponibles' }
  }
  if (estadoParada && !ESTADOS_PARADA_VALIDOS.has(estadoParada)) {
    throw { status: 400, message: 'Estado de parada invalido' }
  }

  const chofer = await prisma.chofer.findUniqueOrThrow({ where: { id: choferId } })
  const viaje = await prisma.viaje.findFirst({
    where: { id: viajeId, choferId, estadoLogistico: 'EN_CURSO' },
    include: { paradas: { orderBy: { orden: 'asc' } }, unidades: true },
  })
  if (!viaje) {
    throw { status: 404, message: 'El viaje no existe o ya no esta en curso' }
  }

  let paradaIdFinal = null
  let estadoParadaFinal = null
  if (TIPOS_CON_PARADA.has(tipoReporte) && paradaId) {
    const parada = viaje.paradas.find((p) => p.id === paradaId)
    if (!parada) throw { status: 400, message: 'La parada no pertenece a este viaje' }
    paradaIdFinal = parada.id
    estadoParadaFinal = estadoParada || 'EN_CURSO'
  }

  const mensajeOriginal = mensaje?.trim()
    || TEXTO_POR_DEFECTO[`${tipoReporte}:${estadoParadaFinal}`]
    || TEXTO_POR_DEFECTO[tipoReporte]
    || (tipoReporte === 'LIBRE' ? `Disponible: ${ubicacion.trim()}` : 'Reporte enviado desde la app')

  return aplicarReporteChofer({
    chofer,
    viaje,
    paradaId: paradaIdFinal,
    estadoParada: estadoParadaFinal,
    tipoReporte,
    ubicacion: ubicacion?.trim() || null,
    mensajeOriginal,
    procesadoPorIa: null,
    origen: 'APP',
    socketIO,
  })
}

module.exports = { obtenerMiViaje, registrarReporte }
