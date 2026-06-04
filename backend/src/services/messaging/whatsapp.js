const { 
  default: makeWASocket, 
  DisconnectReason, 
  useMultiFileAuthState,
  downloadMediaMessage,
  normalizeMessageContent
} = require('@whiskeysockets/baileys')
const { Boom } = require('@hapi/boom')
const qrcode = require('qrcode-terminal')
const pino = require('pino')
const path = require('path')

let sock = null
let socketIO = null
const logger = pino({ level: 'silent' })

const enviarMensaje = async (destino, texto) => {
  if (!sock) throw new Error('WhatsApp no conectado')
  const jid = destino.includes('@') ? destino : `${destino}@s.whatsapp.net`
  try {
    await sock.sendMessage(jid, { text: texto })
  } catch (err) {
    console.error('Error enviando mensaje a', jid, ':', err.message)
  }
}

const iniciarWhatsApp = async (io) => {
  socketIO = io
  const authPath = process.env.WHATSAPP_AUTH_PATH
    ? path.resolve(process.env.WHATSAPP_AUTH_PATH)
    : path.join(__dirname, '../../../.whatsapp-auth')
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
      console.log('\n========================================')
      console.log('Escanea este QR con WhatsApp:')
      console.log('========================================\n')
      qrcode.generate(qr, { small: true })
      if (socketIO) socketIO.emit('whatsapp:qr', { qr })
    }

    if (connection === 'close') {
      const shouldReconnect =
        lastDisconnect?.error instanceof Boom
          ? lastDisconnect.error.output?.statusCode !== DisconnectReason.loggedOut
          : true

      console.log('WhatsApp desconectado. Reconectando:', shouldReconnect)
      if (shouldReconnect) {
        setTimeout(() => iniciarWhatsApp(socketIO), 3000)
      } else {
        console.log('Sesión cerrada. Escanea el QR nuevamente.')
      }
    }

    if (connection === 'open') {
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

      console.log(`[WhatsApp] Mensaje recibido de JID: ${remoteJid}`)

      const contenido = normalizeMessageContent(msg.message)
      let texto =
        contenido?.conversation ||
        contenido?.extendedTextMessage?.text ||
        contenido?.buttonsResponseMessage?.selectedDisplayText ||
        contenido?.listResponseMessage?.title ||
        null

      const audioMsg = contenido?.audioMessage

      if (audioMsg) {
        try {
          console.log('[WhatsApp] Descargando nota de voz...')
          const buffer = await downloadMediaMessage(
            msg,
            'buffer',
            {},
            {
              reuploadRequest: sock.updateMediaMessage,
              logger,
            }
          )
          console.log('[WhatsApp] Transcribiendo nota de voz...')
          
          const transcripcion = await transcribirAudio(buffer, audioMsg.mimetype || 'audio/ogg')
          
          if (transcripcion) {
            console.log(`[WhatsApp] Transcripción: "${transcripcion}"`)
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

module.exports = { iniciarWhatsApp, enviarMensaje, obtenerSock }
