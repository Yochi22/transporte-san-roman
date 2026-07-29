let cache = { value: null, expiresAt: 0 }

const TTL_MS = 30 * 60 * 1000

const obtenerBcv = async () => {
  const now = Date.now()
  if (cache.value && cache.expiresAt > now) return cache.value

  const manual = Number(process.env.BCV_USD_RATE || 0)
  const apiUrl = (process.env.BCV_RATE_API_URL || '').trim()

  if (apiUrl) {
    try {
      const response = await fetch(apiUrl, { headers: { Accept: 'application/json' } })
      if (response.ok) {
        const data = await response.json()
        const tasa = extraerTasa(data)
        if (tasa) return guardarCache({ moneda: 'USD', tasa, fuente: 'API', fecha: new Date().toISOString() })
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
    data?.tasa, data?.rate, data?.usd, data?.USD, data?.price, data?.bcv,
    data?.monitors?.usd?.price, data?.monitors?.bcv?.price, data?.dollar?.bcv,
  ]
  for (const candidate of candidates) {
    const number = Number(String(candidate ?? '').replace(',', '.'))
    if (Number.isFinite(number) && number > 0) return number
  }
  return null
}

module.exports = { obtenerBcv }
