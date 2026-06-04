require('dotenv').config()
const http = require('http')
const { Server } = require('socket.io')
const app = require('./app')
const { crearUsuarioInicial } = require('./modules/auth/auth.service')
const { iniciarWhatsApp } = require('./services/messaging/whatsapp')

const PORT = process.env.PORT || 3000
const allowedOrigins = (process.env.FRONTEND_URL || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

const server = http.createServer(app)

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
    await iniciarWhatsApp(io)
  } catch (error) {
    console.error('Error durante el arranque:', error)
  }
})
