const express = require('express')
const router = express.Router()
const ctrl = require('./mi.controller')
const { autenticar, soloChofer } = require('../../middlewares/auth.middleware')

router.use(autenticar, soloChofer)

router.get('/viaje', ctrl.miViaje)
router.post('/reportes', ctrl.crearReporte)

module.exports = router
