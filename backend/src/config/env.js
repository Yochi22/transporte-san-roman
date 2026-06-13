const validarEntorno = () => {
  const requeridas = ['DATABASE_URL', 'DIRECT_URL', 'JWT_SECRET']
  if (process.env.NODE_ENV === 'production') requeridas.push('FRONTEND_URL')
  const faltantes = requeridas.filter((nombre) => !process.env[nombre]?.trim())

  if (faltantes.length > 0) {
    throw new Error(`Faltan variables de entorno requeridas: ${faltantes.join(', ')}`)
  }

  if (process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET debe tener al menos 32 caracteres')
  }

  if (process.env.NODE_ENV === 'production') {
    const origins = process.env.FRONTEND_URL.split(',').map((origin) => origin.trim()).filter(Boolean)
    for (const origin of origins) {
      const url = new URL(origin)
      if (url.protocol !== 'https:' || url.origin !== origin.replace(/\/$/, '')) {
        throw new Error('FRONTEND_URL debe contener origenes HTTPS validos sin rutas')
      }
    }
  }
}

module.exports = { validarEntorno }
