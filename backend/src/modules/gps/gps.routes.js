const express = require('express')
const ctrl = require('./gps.controller')
const { protegerWebhookGps } = require('../../middlewares/gps.middleware')
const { autenticar, adminOOperaciones } = require('../../middlewares/auth.middleware')

const router = express.Router()

router.post('/positions', protegerWebhookGps, ctrl.recibirPosicion)
router.get('/trucks/:truckId/position', autenticar, adminOOperaciones, ctrl.obtenerPosicionCamion)

module.exports = router
