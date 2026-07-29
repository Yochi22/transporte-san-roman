let cache = { value: null, expiresAt: 0 }

const TTL_MS = 30 * 60 * 1000

const obtenerBcv = async () => {
  const now = Date.now()
  if (cache.value && cache.expiresAt > now) return cache.value

  const manual = Number(process.env.BCV_USD_RATE || 0)
  const apiUrl = (process.env.BCV_RATE_API_URL || '').trim()
  const apiKey = (process.env.BCV_RATE_API_KEY || '').trim()

  if (apiUrl) {
    try {
      const headers = { Accept: 'application/json' }
      if (apiKey) headers['X-API-Key'] = apiKey

      const response = await fetch(apiUrl, { headers })
      if (response.ok) {
        const data = await response.json()
        const tasa = extraerTasa(data)
        if (tasa) {
          return guardarCache({
            moneda: 'USD',
            tasa,
            fuente: detectarFuente(apiUrl, data),
            fecha: extraerFecha(data) || new Date().toISOString()
          })
        }
      }
    } catch (error) {}
  }

  if (manual > 0) return guardarCache({ moneda: 'USD', tasa: manual, fuente: 'ENV', fecha: new Date().toISOString() })
  return { moneda: 'USD', tasa: null, fuente: 'SIN_CONFIGURAR', fecha: new Date().toISOString() }
}

const guardarCache = (value) => {
  cache = { value, expiresAt: Date.now() + TTL_MS }
  return value
}

const extraerTasa = (data) => {
  const candidates = [
    data?.mid, data?.precio, data?.tasa, data?.rate, data?.usd, data?.USD, data?.price, data?.bcv,
    data?.monitors?.usd?.price, data?.monitors?.bcv?.price, data?.dollar?.bcv,
    data?.data?.mid, data?.data?.precio, data?.data?.tasa, data?.data?.rate, data?.data?.price,
    data?.rates?.USD?.mid, data?.rates?.usd?.mid,
  ]
  for (const candidate of candidates) {
    const number = Number(String(candidate ?? '').replace(',', '.'))
    if (Number.isFinite(number) && number > 0) return number
  }
  return null
}

const extraerFecha = (data) => {
  const candidates = [
    data?.updated_at, data?.updatedAt, data?.fecha, data?.date, data?.timestamp,
    data?.data?.updated_at, data?.data?.updatedAt, data?.data?.fecha, data?.data?.date, data?.data?.timestamp,
  ]
  for (const candidate of candidates) {
    if (!candidate) continue
    const fecha = new Date(candidate)
    if (!Number.isNaN(fecha.getTime())) return fecha.toISOString()
  }
  return null
}

const detectarFuente = (apiUrl, data) => {
  const url = apiUrl.toLowerCase()
  if (url.includes('cotizave')) return 'COTIZAVE'
  if (url.includes('dolarflow')) return 'DOLARFLOW'
  if (url.includes('dolarvzla')) return 'DOLARVZLA'
  return String(data?.source || data?.fuente || data?.provider || 'API').trim().toUpperCase().slice(0, 80)
}

module.exports = { obtenerBcv }