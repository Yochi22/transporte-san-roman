require('dotenv').config()
const http = require('http')
const { Server } = require('socket.io')
const app = require('./app')
const { crearUsuarioInicial } = require('./modules/auth/auth.service')
const { iniciarWhatsApp } = require('./services/messaging/whatsapp')
const { depurarReportesCerrados } = require('./modules/reportes/reportes.service')

const PORT = process.env.PORT || 3000
const allowedOrigins = (process.env.FRONTEND_URL || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

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
    origin: allowedOrigins.length ? allowedOrigins : true,
    credentials: true,
  },
})

io.on('connection', (socket) => {
  console.log('Panel conectado via WebSocket:', socket.id)
  socket.on('disconnect', () => {
    console.log('Panel desconectado:', socket.id)
  })
})

server.listen(PORT, async () => {
  console.log(`Transporte San Román API corriendo en puerto ${PORT}`)
  console.log(`Ambiente: ${process.env.NODE_ENV}`)
  try {
    await crearUsuarioInicial()
    await ejecutarDepuracionReportes()
    setInterval(ejecutarDepuracionReportes, INTERVALO_DEPURACION).unref()
    await iniciarWhatsApp(io)
  } catch (error) {
    console.error('Error durante el arranque:', error)
  }
})
