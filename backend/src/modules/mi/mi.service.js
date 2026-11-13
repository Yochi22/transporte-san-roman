const prisma = require('../../config/database')
const { aplicarReporteChofer } = require('../../services/reportes/aplicarReporte.service')
const combustibleService = require('../combustible/combustible.service')

const TIPOS_VALIDOS = new Set(['LLEGADA', 'CARGANDO', 'DESCARGADO', 'ESPERANDO_INSTRUCCIONES', 'LIBRE', 'NOVEDAD', 'OTRO'])
const ESTADOS_PARADA_VALIDOS = new Set(['EN_CURSO', 'COMPLETADA'])
const TIPOS_CON_PARADA = new Set(['CARGANDO', 'DESCARGADO'])

const TEXTO_POR_DEFECTO = {
  LLEGADA: 'Llegue al sitio',
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
      llegadaAt: true,
    },
  },
  reportes: {
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: { id: true, tipoReporte: true, ubicacion: true, mensajeOriginal: true, origen: true, createdAt: true },
  },
}

// El chofer solo debe ver la etapa actual (y las ya completadas). Las etapas
// futuras (ej. el destino de descarga) se ocultan hasta que le toque: a veces
// el propio operador aun no conoce o no cargo ese dato, igual que hoy pasa por
// WhatsApp (el aviso de agendamiento tampoco revela paradas que no sean la
// vigente al momento de cada reporte).
const ocultarEtapasFuturas = (paradas) => {
  const indiceActual = paradas.findIndex((parada) => parada.estado !== 'COMPLETADA')
  return paradas.map((parada, indice) => {
    if (indiceActual === -1 || indice <= indiceActual) return parada
    return {
      id: parada.id,
      orden: parada.orden,
      tramo: parada.tramo,
      tipo: parada.tipo,
      estado: parada.estado,
      lugar: null,
      ciudad: null,
      fechaProgramada: null,
      cargarAlDescargar: false,
      oculta: true,
    }
  })
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
  return {
    chofer,
    viajes: viajes.map((viaje) => ({ ...viaje, paradas: ocultarEtapasFuturas(viaje.paradas) })),
  }
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
  } else if (tipoReporte === 'LLEGADA' && paradaId) {
    const parada = viaje.paradas.find((p) => p.id === paradaId)
    if (!parada) throw { status: 400, message: 'La parada no pertenece a este viaje' }
    paradaIdFinal = parada.id
    // estadoParadaFinal queda null a proposito: llegar al sitio no cambia el
    // estado de la parada (sigue pendiente hasta Cargando/Descargando).
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

// --- Combustible: el chofer carga sus propias lecturas y eventos, pero el
// modulo (combustible.service.js) es el mismo que usa el panel admin para
// supervisar/corregir - una sola fuente de verdad, igual que aplicarReporteChofer.

const camionConTanquesSelect = {
  id: true,
  placa: true,
  tipoVehiculo: true,
  configuracionCombustible: { select: { tanques: { select: { numero: true, capacidadLitros: true, requiereVarilla: true }, orderBy: { numero: 'asc' } } } },
}

// Solo expone unidades que ya tienen tanques configurados: si una unidad no
// tiene combustible configurado, abrir un control fallaria igual, mejor no
// ofrecerla en la app del chofer.
const unidadesDeViajesActivos = async (choferId) => {
  const viajes = await prisma.viaje.findMany({
    where: { choferId, estadoLogistico: 'EN_CURSO' },
    select: {
      id: true,
      camionId: true,
      camion: { select: camionConTanquesSelect },
      unidades: { select: { camion: { select: camionConTanquesSelect } } },
    },
  })
  const camionesPorId = new Map()
  for (const viaje of viajes) {
    const candidatos = viaje.unidades.length > 0 ? viaje.unidades.map((u) => u.camion) : [viaje.camion]
    for (const camion of candidatos.filter((c) => c?.configuracionCombustible?.tanques?.length > 0)) {
      if (!camionesPorId.has(camion.id)) {
        camionesPorId.set(camion.id, {
          id: camion.id,
          placa: camion.placa,
          tipoVehiculo: camion.tipoVehiculo,
          tanques: camion.configuracionCombustible.tanques,
          viajeId: viaje.id,
        })
      }
    }
  }
  return [...camionesPorId.values()]
}

const obtenerMiCombustible = async (choferId) => {
  const unidades = await unidadesDeViajesActivos(choferId)
  // Cualquier control abierto de una unidad de su propio viaje activo cuenta
  // como "abierto" para el chofer, aunque lo haya abierto operaciones/admin
  // como respaldo sin asignarle chofer todavia (ver requerirControlPropio).
  const controlesAbiertos = await combustibleService.obtenerControlesAbiertosPorCamiones(unidades.map((u) => u.id))
  return { controlesAbiertos, unidadesDisponibles: unidades }
}

const abrirMiControlCombustible = async (choferId, datos, actorUsuarioId) => {
  const unidades = await unidadesDeViajesActivos(choferId)
  const unidad = unidades.find((u) => u.id === datos.camionId)
  if (!unidad) throw { status: 403, message: 'Esa unidad no corresponde a tu viaje activo' }

  return combustibleService.abrirControl({
    viajeId: unidad.viajeId,
    camionId: unidad.id,
    choferId,
    odometroInicial: datos.odometroInicial,
    lecturas: datos.lecturas,
    creadoPorId: actorUsuarioId || null,
  })
}

const requerirControlPropio = async (choferId, controlId) => {
  const control = await combustibleService.obtenerControl(controlId)
  if (control.chofer?.id === choferId) return control
  if (control.chofer) throw { status: 403, message: 'Ese control de combustible no te pertenece' }

  // Sin chofer asignado todavia (lo abrio operaciones/admin como respaldo): si
  // la unidad es de un viaje activo de este chofer, puede operarlo y queda
  // asignado a el desde este momento (igual que si lo hubiera abierto el).
  const unidades = await unidadesDeViajesActivos(choferId)
  if (!unidades.some((unidad) => unidad.id === control.camion.id)) {
    throw { status: 403, message: 'Ese control de combustible no te pertenece' }
  }
  await prisma.controlCombustible.update({ where: { id: controlId }, data: { choferId } })
  return control
}

const registrarMiEventoCombustible = async (choferId, controlId, datos, actorUsuarioId) => {
  await requerirControlPropio(choferId, controlId)
  return combustibleService.registrarEvento(controlId, datos, actorUsuarioId || null)
}

const cerrarMiControlCombustible = async (choferId, controlId, datos, actorUsuarioId) => {
  await requerirControlPropio(choferId, controlId)
  return combustibleService.cerrarControl(controlId, datos, actorUsuarioId || null)
}

// Historico de sus propios controles cerrados, para que el chofer vea si su
// desempeno viene saliendo optimo/deficiente/critico en sus ultimos viajes.
const obtenerMiHistoricoCombustible = async (choferId, { page, pageSize } = {}) => {
  return combustibleService.listarControles({ choferId, estado: 'CERRADO', page, pageSize })
}

module.exports = {
  obtenerMiViaje,
  registrarReporte,
  obtenerMiCombustible,
  abrirMiControlCombustible,
  registrarMiEventoCombustible,
  cerrarMiControlCombustible,
  obtenerMiHistoricoCombustible,
}
