const express = require('express')
const ctrl = require('./gps.controller')
const { protegerWebhookGps } = require('../../middlewares/gps.middleware')

const router = express.Router()

router.post('/positions', protegerWebhookGps, ctrl.recibirPosicion)

module.exports = router
