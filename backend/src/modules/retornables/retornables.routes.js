const express = require('express')
const router = express.Router()
const ctrl = require('./retornables.controller')
const { autenticar, adminOOperaciones } = require('../../middlewares/auth.middleware')

router.use(autenticar, adminOOperaciones)

router.get('/', ctrl.listar)
router.get('/viajes/:viajeId', ctrl.listarPorViaje)
router.post('/', ctrl.crear)
router.post('/:id/movimientos', ctrl.mover)

module.exports = router