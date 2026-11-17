const express = require('express')
const router = express.Router()
const ctrl = require('./mi.controller')
const { autenticar, soloChofer } = require('../../middlewares/auth.middleware')
const { manejarSubidaRelacionGastos } = require('../../middlewares/upload.middleware')

router.use(autenticar, soloChofer)

router.get('/viaje', ctrl.miViaje)
router.post('/reportes', ctrl.crearReporte)
router.post('/viaje/:id/relacion-gastos', manejarSubidaRelacionGastos, ctrl.subirRelacionGastos)

router.get('/combustible', ctrl.miCombustible)
router.get('/combustible/historico', ctrl.historicoCombustible)
router.post('/combustible/controles', ctrl.abrirControlCombustible)
router.post('/combustible/controles/:id/eventos', ctrl.registrarEventoCombustible)
router.post('/combustible/controles/:id/cerrar', ctrl.cerrarControlCombustible)

module.exports = router
