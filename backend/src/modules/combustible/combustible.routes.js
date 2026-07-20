const express = require('express')
const ctrl = require('./combustible.controller')
const { autenticar, adminOOperaciones, soloAdmin } = require('../../middlewares/auth.middleware')

const router = express.Router()

router.use(autenticar, adminOOperaciones)

router.get('/viajes/:viajeId/resumen', ctrl.resumenViaje)
router.post('/viajes/:viajeId/eventos', soloAdmin, ctrl.crearEvento)
router.delete('/eventos/:id', soloAdmin, ctrl.eliminarEvento)
router.get('/estandares', ctrl.listarEstandares)
router.post('/estandares', soloAdmin, ctrl.crearEstandar)

module.exports = router
