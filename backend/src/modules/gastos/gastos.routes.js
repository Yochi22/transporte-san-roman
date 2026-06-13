const express = require('express')
const router = express.Router()
const ctrl = require('./gastos.controller')
const { autenticar, adminOOperaciones, soloAdmin } = require('../../middlewares/auth.middleware')

router.use(autenticar, adminOOperaciones)

router.post('/', soloAdmin, ctrl.crear)
router.delete('/:id', soloAdmin, ctrl.eliminar)

module.exports = router
