const express = require('express')
const router = express.Router()
const ctrl = require('./viajes.controller')
const { autenticar, adminOOperaciones } = require('../../middlewares/auth.middleware')

router.use(autenticar, adminOOperaciones)

router.get('/', ctrl.listar)
router.get('/archivo/listado', ctrl.listarArchivo)
router.get('/liquidaciones/listado', ctrl.listarLiquidaciones)
router.get('/pendientes-liquidacion/listado', ctrl.listarPendientesLiquidacion)
router.get('/:id', ctrl.obtener)
router.post('/', ctrl.crear)
router.patch('/:id', ctrl.actualizar)
router.post('/:id/tramos', ctrl.agregarTramo)
router.patch('/:id/paradas/:paradaId', ctrl.actualizarParada)
router.delete('/:id', ctrl.eliminar)
router.patch('/:id/recarga', ctrl.recargarViaticos)
router.patch('/:id/confirmar-documentacion', ctrl.confirmarDocumentacion)
router.post('/:id/cerrar', ctrl.cerrar)
router.get('/:id/liquidacion', ctrl.obtenerLiquidacion)
router.patch('/:id/honorarios', ctrl.actualizarHonorarios)

module.exports = router
