const express = require('express')
const router = express.Router()
const ctrl = require('./reportes.controller')
const { autenticar, adminOOperaciones } = require('../../middlewares/auth.middleware')

router.use(autenticar, adminOOperaciones)

router.get('/', ctrl.listar)
router.get('/viaje/:viajeId', ctrl.porViaje)

module.exports = router