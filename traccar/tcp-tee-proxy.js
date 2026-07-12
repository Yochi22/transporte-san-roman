const net = require('net')

const listenPort = Number(process.env.LISTEN_PORT || 5002)
const primaryHost = process.env.PRIMARY_HOST || 'traccar'
const primaryPort = Number(process.env.PRIMARY_PORT || 5002)
const mirrorHost = process.env.MIRROR_HOST || 'tracker.baanooliot.com'
const mirrorPort = Number(process.env.MIRROR_PORT || 8090)

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
    if (!client.destroyed) client.write(chunk)
  })

  primary.on('error', closeAll)
  mirror.on('error', () => mirror.destroy())
  client.on('error', closeAll)
  client.on('close', closeAll)
  primary.on('close', closeAll)
})

server.listen(listenPort, '0.0.0.0', () => {
  console.log(`TCP tee escuchando ${listenPort}. Primario ${primaryHost}:${primaryPort}. Espejo ${mirrorHost}:${mirrorPort}`)
})
