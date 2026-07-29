const express = require('express')
const router = express.Router()
const ctrl = require('./tasas.controller')
const { autenticar, adminOOperaciones } = require('../../middlewares/auth.middleware')

router.use(autenticar, adminOOperaciones)
router.get('/bcv', ctrl.bcv)

module.exports = router
