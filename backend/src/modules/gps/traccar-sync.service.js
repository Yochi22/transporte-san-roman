const { registrarPosicionPorImei } = require('./gps.service')

let intervalo = null
let sincronizando = false

const normalizarBaseUrl = () => (process.env.TRACCAR_BASE_URL || '').trim().replace(/\/$/, '')

const traccarConfig = () => ({
  enabled: process.env.TRACCAR_SYNC_ENABLED === 'true',
  baseUrl: normalizarBaseUrl(),
  email: process.env.TRACCAR_EMAIL || '',
  password: process.env.TRACCAR_PASSWORD || '',
  intervalMs: Math.max(15, Number(process.env.TRACCAR_SYNC_INTERVAL_SECONDS) || 30) * 1000,
})

const traccarFetch = async (path, config) => {
  const auth = Buffer.from(`${config.email}:${config.password}`).toString('base64')
  const response = await fetch(`${config.baseUrl}${path}`, {
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Traccar API ${response.status} ${response.statusText}`)
  }

  return response.json()
}

const obtenerPosiciones = async (devices, config) => {
  const positions = await traccarFetch('/api/positions', config)
  if (positions.length > 0) return positions

  const positionIds = devices
    .map((device) => device.positionId)
    .filter(Boolean)

  if (positionIds.length === 0) return []

  return traccarFetch(`/api/positions?${positionIds.map((id) => `id=${encodeURIComponent(id)}`).join('&')}`, config)
}

const normalizarEstadoMotor = (attributes = {}) => {
  const value = attributes.ignition ?? attributes.acc ?? attributes.ACC ?? attributes.motion
  if (value === undefined || value === null || value === '') return null
  if (typeof value === 'boolean') return value ? 'ENCENDIDO' : 'APAGADO'
  const text = String(value).trim().toLowerCase()
  if (['true', '1', 'on', 'encendido', 'yes', 'si'].includes(text)) return 'ENCENDIDO'
  if (['false', '0', 'off', 'apagado', 'no'].includes(text)) return 'APAGADO'
  return null
}

const sincronizarPosicionesTraccar = async () => {
  const config = traccarConfig()
  if (!config.enabled) return { enabled: false, count: 0 }
  if (!config.baseUrl || !config.email || !config.password) {
    throw new Error('TRACCAR_BASE_URL, TRACCAR_EMAIL y TRACCAR_PASSWORD son requeridos para sincronizar Traccar')
  }
  if (sincronizando) return { skipped: true, count: 0 }

  sincronizando = true
  try {
    const devices = await traccarFetch('/api/devices', config)
    const positions = await obtenerPosiciones(devices, config)
    const devicesById = new Map(devices.map((device) => [device.id, device]))
    let count = 0
    let ignored = 0

    for (const position of positions) {
      const device = devicesById.get(position.deviceId)
      const imei = String(device?.uniqueId || '').trim()
      if (!/^\d{10,20}$/.test(imei)) {
        ignored += 1
        continue
      }

      try {
        await registrarPosicionPorImei({
          imei,
          latitude: Number(position.latitude),
          longitude: Number(position.longitude),
          speed: Number(position.speed || 0),
          engineStatus: normalizarEstadoMotor(position.attributes || {}),
        })
        count += 1
      } catch (error) {
        ignored += 1
        if (error.status !== 404) throw error
      }
    }

    console.log(`Traccar sync: ${devices.length} dispositivos, ${positions.length} posiciones, ${count} guardadas, ${ignored} ignoradas`)
    return { enabled: true, count }
  } finally {
    sincronizando = false
  }
}

const iniciarSincronizacionTraccar = () => {
  const config = traccarConfig()
  if (intervalo) return
  if (!config.enabled) {
    console.log('Traccar sync desactivado')
    return
  }

  console.log(`Traccar sync activado: ${config.baseUrl || 'sin URL'} cada ${Math.round(config.intervalMs / 1000)}s`)

  sincronizarPosicionesTraccar().catch((error) => {
    console.error('No se pudo sincronizar Traccar:', error.message)
  })

  intervalo = setInterval(() => {
    sincronizarPosicionesTraccar().catch((error) => {
      console.error('No se pudo sincronizar Traccar:', error.message)
    })
  }, config.intervalMs)
  intervalo.unref()
}

module.exports = { iniciarSincronizacionTraccar, sincronizarPosicionesTraccar }
