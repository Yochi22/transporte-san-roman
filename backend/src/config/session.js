const SESSION_COOKIE_NAME = process.env.NODE_ENV === 'production'
  ? '__Host-tsr_session'
  : 'tsr_session'

const CHOFER_SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000

const sessionCookieOptions = ({ maxAgeMs } = {}) => {
  let maxAge
  if (Number.isFinite(maxAgeMs) && maxAgeMs >= 15 * 60 * 1000 && maxAgeMs <= 90 * 24 * 60 * 60 * 1000) {
    maxAge = maxAgeMs
  } else {
    const solicitado = Number(process.env.AUTH_COOKIE_MAX_AGE_MS)
    maxAge = Number.isFinite(solicitado) && solicitado >= 15 * 60 * 1000 && solicitado <= 24 * 60 * 60 * 1000
      ? solicitado
      : 8 * 60 * 60 * 1000
  }

  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge,
    path: '/'
  }
}

module.exports = { SESSION_COOKIE_NAME, sessionCookieOptions, CHOFER_SESSION_MAX_AGE_MS }
