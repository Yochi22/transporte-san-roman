const prisma = require('../../config/database')

const toNumber = (value) => {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

const getNested = (source, paths) => {
  for (const path of paths) {
    const value = path.split('.').reduce((current, key) => current?.[key], source)
    if (value !== undefined && value !== null && value !== '') return value
  }
  return null
}

const normalizarEstadoMotor = (attributes = {}) => {
  const value = getNested({ attributes }, [
    'attributes.ignition',
    'attributes.acc',
    'attributes.ACC',
    'attributes.engine',
    'attributes.engineStatus',
    'attributes.motion'
  ])

  if (value === null) return null
  if (typeof value === 'boolean') return value ? 'ENCENDIDO' : 'APAGADO'
  const text = String(value).trim().toLowerCase()
  if (['true', '1', 'on', 'encendido', 'yes', 'si'].includes(text)) return 'ENCENDIDO'
  if (['false', '0', 'off', 'apagado', 'no'].includes(text)) return 'APAGADO'
  return null
}

const extraerPayloadTraccar = (body) => {
  const imei = String(getNested(body, [
    'device.uniqueId',
    'device.uniqueid',
    'device.imei',
    'uniqueId',
    'uniqueid',
    'imei',
    'position.deviceUniqueId',
    'position.uniqueId',
    'position.imei'
  ]) || '').trim()

  const latitude = toNumber(getNested(body, ['position.latitude', 'latitude', 'lat']))
  const longitude = toNumber(getNested(body, ['position.longitude', 'longitude', 'lon', 'lng']))
  const speed = toNumber(getNested(body, ['position.speed', 'speed'])) || 0
  const attributes = body.position?.attributes || body.attributes || {}
  const engineStatus = normalizarEstadoMotor(attributes)

  if (!/^\d{10,20}$/.test(imei)) throw { status: 400, message: 'IMEI GPS invalido o ausente' }
  if (latitude === null || longitude === null) throw { status: 400, message: 'Coordenadas GPS ausentes' }
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    throw { status: 400, message: 'Coordenadas GPS invalidas' }
  }
  if (speed < 0 || speed > 300) throw { status: 400, message: 'Velocidad GPS invalida' }

  return { imei, latitude, longitude, speed, engineStatus }
}

const registrarPosicionPorImei = async (data) => {
  const camion = await prisma.camion.findFirst({
    where: { gpsImei: data.imei, activo: true },
    select: { id: true, placa: true }
  })

  if (!camion) throw { status: 404, message: 'No existe camion activo asociado a ese IMEI GPS' }

  const ubicacionActual = `${data.latitude.toFixed(6)}, ${data.longitude.toFixed(6)}`

  const [position, viajesActivos] = await prisma.$transaction([
    prisma.truckPosition.upsert({
      where: { truckId: camion.id },
      update: {
        latitude: data.latitude,
        longitude: data.longitude,
        speed: data.speed,
        engineStatus: data.engineStatus,
        updatedAt: new Date()
      },
      create: {
        truckId: camion.id,
        latitude: data.latitude,
        longitude: data.longitude,
        speed: data.speed,
        engineStatus: data.engineStatus
      }
    }),
    prisma.viaje.findMany({
      where: { camionId: camion.id, estadoLogistico: 'EN_CURSO' },
      select: { choferId: true }
    }),
    prisma.camion.update({
      where: { id: camion.id },
      data: { ubicacionActual }
    })
  ])

  const choferIds = [...new Set(viajesActivos.map((viaje) => viaje.choferId).filter(Boolean))]
  if (choferIds.length > 0) {
    await prisma.chofer.updateMany({
      where: { id: { in: choferIds } },
      data: { ubicacionActual }
    })
  }

  return {
    camion: { ...camion, ubicacionActual },
    position
  }
}

const registrarPosicion = async (body) => registrarPosicionPorImei(extraerPayloadTraccar(body))

const obtenerPosicionCamion = async (truckId) => {
  const position = await prisma.truckPosition.findUnique({
    where: { truckId },
  })
  return position
}

module.exports = { registrarPosicion, registrarPosicionPorImei, obtenerPosicionCamion, extraerPayloadTraccar }
