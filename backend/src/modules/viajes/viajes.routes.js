const express = require('express')
const router = express.Router()
const ctrl = require('./viajes.controller')
const { autenticar, adminOOperaciones, soloAdmin } = require('../../middlewares/auth.middleware')

router.use(autenticar, adminOOperaciones)

router.get('/', ctrl.listar)
router.get('/archivo/listado', ctrl.listarArchivo)
router.get('/pendientes-liquidacion/listado', soloAdmin, ctrl.listarPendientesLiquidacion)
router.get('/:id', ctrl.obtener)
router.post('/', ctrl.crear)
router.patch('/:id/paradas/:paradaId', ctrl.actualizarParada)
router.patch('/:id/recarga', soloAdmin, ctrl.recargarViaticos)
router.patch('/:id/confirmar-documentacion', soloAdmin, ctrl.confirmarDocumentacion)
router.post('/:id/cerrar', ctrl.cerrar)
router.patch('/:id/honorarios', soloAdmin, ctrl.actualizarHonorarios)

module.exports = router
