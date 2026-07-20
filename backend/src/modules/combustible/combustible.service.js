const prisma = require('../../config/database')

const TIPOS_EVENTO = ['CARGA', 'TRANSFERENCIA_SALIDA', 'TRANSFERENCIA_ENTRADA', 'AJUSTE', 'PERDIDA']
const MONEDAS = ['USD', 'BS']

const validarNumero = (valor, campo, { requerido = true, max = 1_000_000 } = {}) => {
  if (valor === undefined || valor === null || valor === '') {
    if (!requerido) return null
    throw { status: 400, message: `${campo} es requerido` }
  }
  const numero = Number(valor)
  if (!Number.isFinite(numero) || numero < 0 || numero > max) {
    throw { status: 400, message: `${campo} invalido` }
  }
  return numero
}

const normalizarTexto = (valor, max = 160) => {
  if (valor === undefined || valor === null) return null
  const texto = String(valor).trim()
  if (!texto) return null
  if (texto.length > max) throw { status: 400, message: 'Texto demasiado largo' }
  return texto
}

const obtenerViaje = async (viajeId) => prisma.viaje.findUniqueOrThrow({
  where: { id: viajeId },
  include: {
    chofer: { select: { id: true, nombre: true } },
    camion: true,
    unidades: { include: { camion: true } },
    paradas: { orderBy: { orden: 'asc' } },
    combustibleEventos: {
      include: { camion: { select: { id: true, placa: true, tipoVehiculo: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200
    }
  }
})

const crearEvento = async (viajeId, datos) => {
  const viaje = await prisma.viaje.findUniqueOrThrow({
    where: { id: viajeId },
    include: { unidades: true }
  })
  const camionIds = [...new Set([viaje.camionId, ...(viaje.unidades || []).map((unidad) => unidad.camionId)].filter(Boolean))]
  const camionId = datos.camionId || camionIds[0]
  if (!camionIds.includes(camionId)) {
    throw { status: 409, message: 'La unidad no pertenece a este viaje' }
  }

  const tipo = datos.tipo
  if (!TIPOS_EVENTO.includes(tipo)) throw { status: 400, message: 'Tipo de evento invalido' }
  const moneda = datos.moneda || 'USD'
  if (!MONEDAS.includes(moneda)) throw { status: 400, message: 'Moneda invalida' }

  await prisma.combustibleEvento.create({
    data: {
      viajeId,
      choferId: viaje.choferId,
      camionId,
      tipo,
      litros: validarNumero(datos.litros, 'Litros'),
      monto: validarNumero(datos.monto, 'Monto', { requerido: false }) || 0,
      moneda,
      tasaBcv: validarNumero(datos.tasaBcv, 'Tasa BCV', { requerido: false }),
      ubicacion: normalizarTexto(datos.ubicacion, 120),
      descripcion: normalizarTexto(datos.descripcion, 500)
    }
  })

  return resumenViaje(viajeId)
}

const eliminarEvento = async (id) => {
  const evento = await prisma.combustibleEvento.delete({ where: { id } })
  return resumenViaje(evento.viajeId)
}

const crearEstandar = async (datos) => {
  const origen = normalizarTexto(datos.origen, 100)
  const destino = normalizarTexto(datos.destino, 100)
  if (!origen || !destino) throw { status: 400, message: 'Origen y destino son requeridos' }
  const tipoVehiculo = datos.tipoVehiculo || null
  if (tipoVehiculo && !['NPR', 'TORONTO', 'FURGON', 'CHUTO', 'CORTINERO', 'BATEA'].includes(tipoVehiculo)) {
    throw { status: 400, message: 'Tipo de vehiculo invalido' }
  }

  return prisma.combustibleEstandarRuta.create({
    data: {
      origen,
      destino,
      tipoVehiculo,
      camionId: datos.camionId || null,
      litrosEsperados: validarNumero(datos.litrosEsperados, 'Litros esperados'),
      toleranciaPct: validarNumero(datos.toleranciaPct, 'Tolerancia', { requerido: false }) ?? 10,
    }
  })
}

const listarEstandares = async () => prisma.combustibleEstandarRuta.findMany({
  where: { activo: true },
  include: { camion: { select: { id: true, placa: true, tipoVehiculo: true } } },
  orderBy: { createdAt: 'desc' },
  take: 200
})

const resumenViaje = async (viajeId) => calcularResumen(await obtenerViaje(viajeId))

const calcularResumen = async (viaje) => {
  const kms = viaje.odometroInicial !== null && viaje.odometroFinal !== null
    ? Math.max(0, Number(viaje.odometroFinal) - Number(viaje.odometroInicial))
    : null

  const eventos = viaje.combustibleEventos || []
  const carga = sumarLitros(eventos, ['CARGA'])
  const recibido = sumarLitros(eventos, ['TRANSFERENCIA_ENTRADA'])
  const salida = sumarLitros(eventos, ['TRANSFERENCIA_SALIDA', 'PERDIDA'])
  const ajuste = sumarLitros(eventos, ['AJUSTE'])
  const inicial = viaje.combustibleInicial === null ? null : Number(viaje.combustibleInicial)
  const final = viaje.combustibleFinal === null ? null : Number(viaje.combustibleFinal)
  const consumoReal = inicial !== null && final !== null
    ? Math.max(0, inicial + carga + recibido + ajuste - salida - final)
    : null

  const estandar = await buscarEstandar(viaje)
  const rendimientoReferencia = rendimientoReferenciaViaje(viaje)
  const consumoEsperado = estandar
    ? Number(estandar.litrosEsperados)
    : kms !== null && rendimientoReferencia
      ? kms / rendimientoReferencia
      : null
  const toleranciaPct = Number(estandar?.toleranciaPct ?? toleranciaReferenciaViaje(viaje) ?? 10)
  const desviacionPct = consumoReal !== null && consumoEsperado
    ? ((consumoReal - consumoEsperado) / consumoEsperado) * 100
    : null
  const estado = desviacionPct === null
    ? 'SIN_DATOS'
    : desviacionPct <= toleranciaPct
      ? 'NORMAL'
      : desviacionPct <= toleranciaPct * 1.8
        ? 'OBSERVAR'
        : 'CRITICO'

  return {
    viajeId: viaje.id,
    kmRecorridos: kms,
    combustibleInicial: inicial,
    combustibleFinal: final,
    litrosCargados: carga,
    litrosRecibidos: recibido,
    litrosTransferidos: salida,
    consumoRealLitros: consumoReal,
    consumoEsperadoLitros: consumoEsperado,
    desviacionPct,
    toleranciaPct,
    estado,
    referencia: estandar ? 'RUTA' : rendimientoReferencia ? 'UNIDAD' : 'SIN_REFERENCIA',
    estandar,
    eventos
  }
}

const buscarEstandar = async (viaje) => {
  const paradas = viaje.paradas || []
  const origen = paradas[0]?.ciudad
  const destino = paradas[paradas.length - 1]?.ciudad
  if (!origen || !destino) return null
  const unidades = unidadesViaje(viaje)
  const camionIds = unidades.map((camion) => camion.id).filter(Boolean)
  const tipos = unidades.map((camion) => camion.tipoVehiculo).filter(Boolean)

  const estandares = await prisma.combustibleEstandarRuta.findMany({
    where: {
      activo: true,
      origen: { equals: origen, mode: 'insensitive' },
      destino: { equals: destino, mode: 'insensitive' },
      OR: [
        { camionId: { in: camionIds } },
        { tipoVehiculo: { in: tipos } },
        { camionId: null, tipoVehiculo: null }
      ]
    },
    orderBy: { createdAt: 'desc' },
    take: 20
  })
  return estandares
    .sort((a, b) => prioridadEstandar(b, camionIds, tipos) - prioridadEstandar(a, camionIds, tipos))
    [0] || null
}

const prioridadEstandar = (estandar, camionIds, tipos) => {
  if (estandar.camionId && camionIds.includes(estandar.camionId)) return 3
  if (estandar.tipoVehiculo && tipos.includes(estandar.tipoVehiculo)) return 2
  return 1
}

const unidadesViaje = (viaje) => {
  const unidades = (viaje.unidades || []).map((unidad) => unidad.camion).filter(Boolean)
  return unidades.length > 0 ? unidades : [viaje.camion].filter(Boolean)
}

const rendimientoReferenciaViaje = (viaje) => {
  const referencias = unidadesViaje(viaje)
    .map((camion) => Number(camion.rendimientoEsperadoKmL || 0))
    .filter((valor) => valor > 0)
  if (referencias.length === 0) return null
  return referencias.reduce((total, valor) => total + valor, 0) / referencias.length
}

const toleranciaReferenciaViaje = (viaje) => {
  const referencias = unidadesViaje(viaje)
    .map((camion) => Number(camion.toleranciaCombustiblePct || 0))
    .filter((valor) => valor > 0)
  if (referencias.length === 0) return null
  return referencias.reduce((total, valor) => total + valor, 0) / referencias.length
}

const sumarLitros = (eventos, tipos) =>
  eventos.filter((evento) => tipos.includes(evento.tipo)).reduce((total, evento) => total + Number(evento.litros || 0), 0)

module.exports = {
  crearEvento,
  eliminarEvento,
  resumenViaje,
  crearEstandar,
  listarEstandares
}
