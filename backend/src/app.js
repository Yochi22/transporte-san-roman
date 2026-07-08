require('express-async-errors')
require('dotenv').config()

const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const morgan = require('morgan')
const cookieParser = require('cookie-parser')
const path = require('path')
const fs = require('fs')

const { manejarErrores } = require('./middlewares/error.middleware')
const { apiLimiter, requerirJson, protegerCsrf } = require('./middlewares/security.middleware')
const { autenticar, soloAdmin } = require('./middlewares/auth.middleware')

const authRoutes = require('./modules/auth/auth.routes')
const usuariosRoutes = require('./modules/usuarios/usuarios.routes')
const choferesRoutes = require('./modules/choferes/choferes.routes')
const camionesRoutes = require('./modules/camiones/camiones.routes')
const viajesRoutes = require('./modules/viajes/viajes.routes')
const gastosRoutes = require('./modules/gastos/gastos.routes')
const tallerRoutes = require('./modules/taller/taller.routes')
const gpsRoutes = require('./modules/gps/gps.routes')
const { obtenerEstadoWhatsApp } = require('./services/messaging/whatsapp')

const app = express()
const demoPublicQr = process.env.DEMO_PUBLIC_WHATSAPP_QR === 'true'

const configuredOrigins = (process.env.FRONTEND_URL || '')
  .split(',')
  .map((origin) => origin.trim().replace(/\/$/, ''))
  .filter(Boolean)
const allowedOrigins = process.env.NODE_ENV === 'production'
  ? configuredOrigins
  : [...new Set([...configuredOrigins, 'http://localhost:5173', 'http://127.0.0.1:5173'])]

app.disable('x-powered-by')
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      imgSrc: ["'self'", 'data:', 'https://*.tile.openstreetmap.org'],
    },
  },
  crossOriginResourcePolicy: { policy: 'same-origin' },
  referrerPolicy: { policy: 'no-referrer' }
}))
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true)
    const rechazo = new Error('Origen no permitido')
    rechazo.status = 403
    return callback(rechazo)
  },
  credentials: true,
}))
app.use(morgan(process.env.NODE_ENV === 'production' ? 'tiny' : 'dev'))
app.use(express.json({ limit: '100kb', strict: true }))
app.use(cookieParser())
app.use('/api', apiLimiter, requerirJson)
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store')
  next()
})
app.use('/api/gps', gpsRoutes)
app.use('/api', protegerCsrf)

app.get('/health', (req, res) => {
  res.json({ ok: true, servicio: 'Transporte San Román API', version: '1.0.0' })
})

app.get('/api/whatsapp/status', autenticar, soloAdmin, (req, res) => {
  const estado = obtenerEstadoWhatsApp()
  res.json({
    conectado: estado.conectado,
    qrDisponible: Boolean(estado.qrDataUrl)
  })
})

app.get('/whatsapp-qr', ...(demoPublicQr ? [] : [autenticar, soloAdmin]), (req, res) => {
  res.set('Cache-Control', 'no-store')
  const estado = obtenerEstadoWhatsApp()
  const contenido = estado.conectado
    ? '<div class="status ok">WhatsApp conectado</div><p>La sesion esta activa. Ya puedes volver al panel.</p>'
    : estado.qrDataUrl
      ? `<img src="${estado.qrDataUrl}" alt="QR de WhatsApp" /><p>Abre WhatsApp, ve a Dispositivos vinculados y escanea este codigo.</p>`
      : '<div class="status wait">Esperando QR</div><p>Si no aparece, espera unos segundos y recarga esta pagina.</p>'

  res.type('html').send(`<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="refresh" content="12" />
  <title>QR WhatsApp | Transporte San Roman</title>
  <style>
    body{margin:0;min-height:100vh;display:grid;place-items:center;background:#fafaf9;color:#171717;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    main{width:min(92vw,520px);border:1px solid #e5e5e5;border-radius:10px;background:#fff;padding:28px;text-align:center;box-shadow:0 22px 70px rgb(0 0 0 / 10%)}
    h1{margin:0 0 8px;font-size:22px}
    p{margin:12px auto 0;max-width:390px;color:#737373;font-size:14px;line-height:1.5}
    img{display:block;width:min(78vw,420px);height:auto;margin:20px auto;border:12px solid #fff;border-radius:8px;box-shadow:0 0 0 1px #e5e5e5}
    .status{display:inline-flex;margin:20px 0 4px;border-radius:6px;padding:10px 14px;font-weight:700;font-size:14px}
    .ok{background:#ecfdf5;color:#047857}
    .wait{background:#fffbeb;color:#92400e}
    small{display:block;margin-top:16px;color:#a3a3a3}
  </style>
</head>
<body>
  <main>
    <h1>Vincular WhatsApp</h1>
    ${contenido}
    <small>Esta pagina se actualiza automaticamente.</small>
  </main>
</body>
</html>`)
})

app.use('/api/auth', authRoutes)
app.use('/api/usuarios', usuariosRoutes)
app.use('/api/choferes', choferesRoutes)
app.use('/api/camiones', camionesRoutes)
app.use('/api/viajes', viajesRoutes)
app.use('/api/gastos', gastosRoutes)
app.use('/api/taller', tallerRoutes)

const frontendDist = path.resolve(__dirname, '../../frontend/dist')
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist))
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
      return next()
    }
    return res.sendFile(path.join(frontendDist, 'index.html'))
  })
}

app.use(manejarErrores)

module.exports = app
