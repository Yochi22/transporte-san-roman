const SESSION_COOKIE_NAME = process.env.NODE_ENV === 'production'
  ? '__Host-tsr_session'
  : 'tsr_session'

const sessionCookieOptions = () => {
  const solicitado = Number(process.env.AUTH_COOKIE_MAX_AGE_MS)
  const maxAge = Number.isFinite(solicitado) && solicitado >= 15 * 60 * 1000 && solicitado <= 24 * 60 * 60 * 1000
    ? solicitado
    : 8 * 60 * 60 * 1000

  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge,
    path: '/'
  }
}

module.exports = { SESSION_COOKIE_NAME, sessionCookieOptions }
