const express = require('express')
const router = express.Router()
const ctrl = require('./gastos.controller')
const { autenticar, adminOOperaciones } = require('../../middlewares/auth.middleware')

router.use(autenticar, adminOOperaciones)

router.get('/viaje/:viajeId', ctrl.porViaje)
router.post('/', ctrl.crear)
router.delete('/:id', ctrl.eliminar)

module.exports = router