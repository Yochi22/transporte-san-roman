require('dotenv').config()
const { validarEntorno } = require('./config/env')
validarEntorno()
const http = require('http')
const { Server } = require('socket.io')
const app = require('./app')
const { crearUsuarioInicial } = require('./modules/auth/auth.service')
const { iniciarWhatsApp } = require('./services/messaging/whatsapp')
const { depurarReportesCerrados } = require('./modules/reportes/reportes.service')
const { iniciarSincronizacionTraccar } = require('./modules/gps/traccar-sync.service')
const { verificarToken } = require('./config/jwt')
const prisma = require('./config/database')
const { SESSION_COOKIE_NAME } = require('./config/session')

const PORT = process.env.PORT || 3000
const configuredOrigins = (process.env.FRONTEND_URL || '')
  .split(',')
  .map((origin) => origin.trim().replace(/\/$/, ''))
  .filter(Boolean)
const allowedOrigins = process.env.NODE_ENV === 'production'
  ? configuredOrigins
  : [...new Set([...configuredOrigins, 'http://localhost:5173', 'http://127.0.0.1:5173'])]

const server = http.createServer(app)
const DIAS_RETENCION_REPORTES = Math.max(1, Number(process.env.DIAS_RETENCION_REPORTES) || 7)
const INTERVALO_DEPURACION = 24 * 60 * 60 * 1000

const ejecutarDepuracionReportes = async () => {
  try {
    const resultado = await depurarReportesCerrados(DIAS_RETENCION_REPORTES)
    if (resultado.count > 0) console.log(`Reportes antiguos eliminados: ${resultado.count}`)
  } catch (error) {
    console.error('No se pudieron depurar los reportes antiguos:', error.message)
  }
}

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
  perMessageDeflate: false,
  maxHttpBufferSize: 100_000
})

io.use(async (socket, next) => {
  try {
    const cookies = Object.fromEntries(
      (socket.handshake.headers.cookie || '')
        .split(';')
        .map((item) => item.trim().split('='))
        .filter(([key, value]) => key && value)
    )
    const token = cookies[SESSION_COOKIE_NAME]
    const origin = socket.handshake.headers.origin
    const originPermitido = origin
      ? allowedOrigins.includes(origin)
      : process.env.NODE_ENV !== 'production'

    if (!token || !originPermitido) {
      return next(new Error('No autorizado'))
    }

    const payload = verificarToken(decodeURIComponent(token))
    const usuario = await prisma.usuario.findUnique({
      where: { id: payload.id },
      select: { id: true, rol: true, activo: true, sessionVersion: true }
    })
    if (!usuario?.activo || usuario.sessionVersion !== payload.sessionVersion) {
      return next(new Error('No autorizado'))
    }
    socket.usuario = { id: usuario.id, rol: usuario.rol }
    return next()
  } catch {
    return next(new Error('No autorizado'))
  }
})

io.on('connection', (socket) => {
  console.log('Panel conectado via WebSocket')
  socket.on('disconnect', () => {
    console.log('Panel desconectado')
  })
})

server.listen(PORT, async () => {
  console.log(`Transporte San Román API corriendo en puerto ${PORT}`)
  console.log(`Ambiente: ${process.env.NODE_ENV}`)
  try {
    await crearUsuarioInicial()
    await ejecutarDepuracionReportes()
    setInterval(ejecutarDepuracionReportes, INTERVALO_DEPURACION).unref()
    iniciarSincronizacionTraccar()
    await iniciarWhatsApp(io)
  } catch (error) {
    console.error('Error durante el arranque:', {
      name: error.name,
      code: error.code,
      message: process.env.NODE_ENV === 'production' ? undefined : error.message
    })
  }
})
