const { 
  default: makeWASocket, 
  DisconnectReason, 
  useMultiFileAuthState,
  downloadMediaMessage,
  normalizeMessageContent
} = require('@whiskeysockets/baileys')
const { Boom } = require('@hapi/boom')
const QRCode = require('qrcode')
const pino = require('pino')
const path = require('path')
const fs = require('fs/promises')

let sock = null
let socketIO = null
let ultimoQr = null
let ultimoQrDataUrl = null
let whatsappConectado = false
let reconnectTimer = null
let reinicioManual = false
const logger = pino({ level: 'silent' })
const MAX_AUDIO_BYTES = 20 * 1024 * 1024

const obtenerAuthPath = () => (
  process.env.WHATSAPP_AUTH_PATH
    ? path.resolve(process.env.WHATSAPP_AUTH_PATH)
    : path.join(__dirname, '../../../.whatsapp-auth')
)

const enviarMensaje = async (destino, texto) => {
  if (!sock) throw new Error('WhatsApp no conectado')
  const jid = destino.includes('@') ? destino : `${destino}@s.whatsapp.net`
  try {
    await sock.sendMessage(jid, { text: texto })
  } catch (err) {
    console.error('No se pudo enviar un mensaje de WhatsApp:', err.message)
    throw err
  }
}

const iniciarWhatsApp = async (io) => {
  socketIO = io || socketIO
  const authPath = obtenerAuthPath()
  const { state, saveCreds } = await useMultiFileAuthState(authPath)

 sock = makeWASocket({
  auth: state,
  printQRInTerminal: false,
  logger,
  keepAliveIntervalMs: 30000,
  retryRequestDelayMs: 2000,
})

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update

    if (qr) {
      ultimoQr = qr
      ultimoQrDataUrl = await QRCode.toDataURL(qr, {
        margin: 2,
        width: 420,
        color: { dark: '#171717', light: '#ffffff' }
      })
      whatsappConectado = false
      console.log('QR web disponible en /whatsapp-qr')
      if (socketIO) socketIO.emit('whatsapp:qr-disponible')
    }

    if (connection === 'close') {
      whatsappConectado = false
      if (reinicioManual) return
      const shouldReconnect =
        lastDisconnect?.error instanceof Boom
          ? lastDisconnect.error.output?.statusCode !== DisconnectReason.loggedOut
          : true

      console.log('WhatsApp desconectado. Reconectando:', shouldReconnect)
      if (shouldReconnect) {
        if (reconnectTimer) clearTimeout(reconnectTimer)
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null
          iniciarWhatsApp(socketIO)
        }, 3000)
      } else {
        console.log('Sesión cerrada. Escanea el QR nuevamente.')
      }
    }

    if (connection === 'open') {
      whatsappConectado = true
      ultimoQr = null
      ultimoQrDataUrl = null
      console.log('WhatsApp conectado exitosamente')
      if (socketIO) socketIO.emit('whatsapp:conectado')
    }
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return

    const { procesarMensajeChofer } = require('./mensajes.handler')
    const { transcribirAudio } = require('./ia.parser')

    for (const msg of messages) {
      if (msg.key.fromMe) continue
      if (!msg.message) continue

      const remoteJid = msg.key.remoteJid

      if (remoteJid.endsWith('@g.us') || remoteJid === 'status@broadcast') continue

      console.log('[WhatsApp] Mensaje recibido')

      const contenido = normalizeMessageContent(msg.message)
      let texto =
        contenido?.conversation ||
        contenido?.extendedTextMessage?.text ||
        contenido?.buttonsResponseMessage?.selectedDisplayText ||
        contenido?.listResponseMessage?.title ||
        null
      if (contenido?.imageMessage) {
        const caption = contenido.imageMessage.caption?.trim()
        texto = caption ? `novedad con foto: ${caption}` : 'novedad con foto enviada por WhatsApp'
      }

      const audioMsg = contenido?.audioMessage

      if (audioMsg) {
        try {
          const fileLength = Number(audioMsg.fileLength || 0)
          if (fileLength > MAX_AUDIO_BYTES) {
            await enviarMensaje(remoteJid, 'La nota de voz supera el limite permitido de 20 MB.')
            continue
          }
          const buffer = await downloadMediaMessage(
            msg,
            'buffer',
            {},
            {
              reuploadRequest: sock.updateMediaMessage,
              logger,
            }
          )
          const transcripcion = await transcribirAudio(buffer, audioMsg.mimetype || 'audio/ogg')
          
          if (transcripcion) {
            texto = transcripcion
          } else {
            await enviarMensaje(remoteJid, '⚠️ No pude entender el audio. Por favor intenta de nuevo o escribe el reporte.')
            continue
          }
        } catch (err) {
          console.error('[WhatsApp] Error procesando audio:', err.message)
          await enviarMensaje(remoteJid, '❌ Hubo un error al procesar tu nota de voz.')
          continue
        }
      }

      if (!texto) continue

      await procesarMensajeChofer({
        remoteJid,
        texto,
        socketIO,
        enviarMensaje,
      })
    }
  })

  return sock
}

const obtenerSock = () => sock
const obtenerEstadoWhatsApp = () => ({
  conectado: whatsappConectado,
  qr: ultimoQr,
  qrDataUrl: ultimoQrDataUrl
})

const reiniciarWhatsApp = async () => {
  reinicioManual = true
  try {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }

    whatsappConectado = false
    ultimoQr = null
    ultimoQrDataUrl = null

    const socketActual = sock
    sock = null

    if (socketActual) {
      try {
        if (typeof socketActual.ev?.removeAllListeners === 'function') {
          socketActual.ev.removeAllListeners('connection.update')
          socketActual.ev.removeAllListeners('creds.update')
          socketActual.ev.removeAllListeners('messages.upsert')
        }
        if (typeof socketActual.end === 'function') {
          socketActual.end(new Error('Reinicio manual de WhatsApp'))
        }
      } catch (err) {
        console.warn('No se pudo cerrar el socket de WhatsApp:', err.message)
      }
    }

    await fs.rm(obtenerAuthPath(), { recursive: true, force: true })
  } finally {
    reinicioManual = false
  }

  await iniciarWhatsApp(socketIO)

  if (socketIO) socketIO.emit('whatsapp:reiniciado')
  return obtenerEstadoWhatsApp()
}

module.exports = { iniciarWhatsApp, enviarMensaje, obtenerSock, obtenerEstadoWhatsApp, reiniciarWhatsApp }
