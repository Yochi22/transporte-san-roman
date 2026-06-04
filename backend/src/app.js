require('express-async-errors')
require('dotenv').config()

const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const morgan = require('morgan')

const { manejarErrores } = require('./middlewares/error.middleware')

const authRoutes = require('./modules/auth/auth.routes')
const usuariosRoutes = require('./modules/usuarios/usuarios.routes')
const choferesRoutes = require('./modules/choferes/choferes.routes')
const camionesRoutes = require('./modules/camiones/camiones.routes')
const viajesRoutes = require('./modules/viajes/viajes.routes')
const reportesRoutes = require('./modules/reportes/reportes.routes')
const gastosRoutes = require('./modules/gastos/gastos.routes')

const app = express()

const allowedOrigins = (process.env.FRONTEND_URL || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

app.use(helmet())
app.use(cors({
  origin: allowedOrigins.length ? allowedOrigins : true,
  credentials: true,
}))
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'))
app.use(express.json())

app.get('/health', (req, res) => {
  res.json({ ok: true, servicio: 'Transporte San Román API', version: '1.0.0' })
})

app.use('/api/auth', authRoutes)
app.use('/api/usuarios', usuariosRoutes)
app.use('/api/choferes', choferesRoutes)
app.use('/api/camiones', camionesRoutes)
app.use('/api/viajes', viajesRoutes)
app.use('/api/reportes', reportesRoutes)
app.use('/api/gastos', gastosRoutes)

app.use(manejarErrores)

module.exports = app
