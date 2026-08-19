const net = require('net')

const listenPort = Number(process.env.LISTEN_PORT || 5002)
const primaryHost = process.env.PRIMARY_HOST || 'traccar'
const primaryPort = Number(process.env.PRIMARY_PORT || 5002)
const mirrorHost = process.env.MIRROR_HOST || 'tracker.baanooliot.com'
const mirrorPort = Number(process.env.MIRROR_PORT || 8090)
const responseSource = process.env.RESPONSE_SOURCE || 'mirror'

let connectionId = 0

const label = (id, message) => `[${id}] ${message}`

const server = net.createServer((client) => {
  const id = ++connectionId
  const remote = `${client.remoteAddress || 'unknown'}:${client.remotePort || ''}`
  let closed = false

  console.log(label(id, `GPS conectado desde ${remote}`))

  const primary = net.createConnection({ host: primaryHost, port: primaryPort }, () => {
    console.log(label(id, `conectado a Traccar ${primaryHost}:${primaryPort}`))
  })
  const mirror = net.createConnection({ host: mirrorHost, port: mirrorPort }, () => {
    console.log(label(id, `conectado a espejo ${mirrorHost}:${mirrorPort}`))
  })

  const closeAll = () => {
    if (closed) return
    closed = true
    client.destroy()
    primary.destroy()
    mirror.destroy()
    console.log(label(id, 'conexion cerrada'))
  }

  client.on('data', (chunk) => {
    console.log(label(id, `GPS -> ${chunk.length} bytes`))
    if (!primary.destroyed) {
      primary.write(chunk)
      console.log(label(id, `enviado a Traccar ${chunk.length} bytes`))
    }
    if (!mirror.destroyed) {
      mirror.write(chunk)
      console.log(label(id, `enviado a espejo ${chunk.length} bytes`))
    }
  })

  primary.on('data', (chunk) => {
    console.log(label(id, `Traccar -> ${chunk.length} bytes`))
    if (responseSource === 'primary' && !client.destroyed) client.write(chunk)
  })

  mirror.on('data', (chunk) => {
    console.log(label(id, `espejo -> ${chunk.length} bytes`))
    if (responseSource === 'mirror' && !client.destroyed) client.write(chunk)
  })

  primary.on('error', (err) => {
    console.warn(label(id, `error Traccar ${primaryHost}:${primaryPort}: ${err.code || err.message}`))
    primary.destroy()
  })
  mirror.on('error', (err) => {
    console.warn(label(id, `error espejo ${mirrorHost}:${mirrorPort}: ${err.code || err.message}`))
    mirror.destroy()
  })
  client.on('error', (err) => {
    console.warn(label(id, `error GPS: ${err.code || err.message}`))
    closeAll()
  })
  client.on('close', closeAll)
  primary.on('close', () => primary.destroy())
  mirror.on('close', () => mirror.destroy())
})

server.on('error', (err) => {
  console.error(`TCP tee error en puerto ${listenPort}: ${err.code || err.message}`)
  process.exitCode = 1
})

server.listen(listenPort, '0.0.0.0', () => {
  console.log(`TCP tee escuchando ${listenPort}. Primario ${primaryHost}:${primaryPort}. Espejo ${mirrorHost}:${mirrorPort}. Respuesta: ${responseSource}`)
})
