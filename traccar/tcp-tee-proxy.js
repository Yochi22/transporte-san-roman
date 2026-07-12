const net = require('net')

const listenPort = Number(process.env.LISTEN_PORT || 5002)
const primaryHost = process.env.PRIMARY_HOST || 'traccar'
const primaryPort = Number(process.env.PRIMARY_PORT || 5002)
const mirrorHost = process.env.MIRROR_HOST || 'tracker.baanooliot.com'
const mirrorPort = Number(process.env.MIRROR_PORT || 8090)
const responseSource = process.env.RESPONSE_SOURCE || 'mirror'

const server = net.createServer((client) => {
  const primary = net.createConnection({ host: primaryHost, port: primaryPort })
  const mirror = net.createConnection({ host: mirrorHost, port: mirrorPort })

  const closeAll = () => {
    client.destroy()
    primary.destroy()
    mirror.destroy()
  }

  client.on('data', (chunk) => {
    if (!primary.destroyed) primary.write(chunk)
    if (!mirror.destroyed) mirror.write(chunk)
  })

  primary.on('data', (chunk) => {
    if (responseSource === 'primary' && !client.destroyed) client.write(chunk)
  })

  mirror.on('data', (chunk) => {
    if (responseSource === 'mirror' && !client.destroyed) client.write(chunk)
  })

  primary.on('error', () => primary.destroy())
  mirror.on('error', () => mirror.destroy())
  client.on('error', closeAll)
  client.on('close', closeAll)
  primary.on('close', () => primary.destroy())
  mirror.on('close', () => mirror.destroy())
})

server.listen(listenPort, '0.0.0.0', () => {
  console.log(`TCP tee escuchando ${listenPort}. Primario ${primaryHost}:${primaryPort}. Espejo ${mirrorHost}:${mirrorPort}. Respuesta: ${responseSource}`)
})
