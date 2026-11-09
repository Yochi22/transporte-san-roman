const express = require('express')
const router = express.Router()
const ctrl = require('./mi.controller')
const { autenticar, soloChofer } = require('../../middlewares/auth.middleware')

router.use(autenticar, soloChofer)

router.get('/viaje', ctrl.miViaje)
router.post('/reportes', ctrl.crearReporte)

router.get('/combustible', ctrl.miCombustible)
router.post('/combustible/controles', ctrl.abrirControlCombustible)
router.post('/combustible/controles/:id/eventos', ctrl.registrarEventoCombustible)
router.post('/combustible/controles/:id/cerrar', ctrl.cerrarControlCombustible)

module.exports = router
