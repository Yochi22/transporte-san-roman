const express = require('express')
const router = express.Router()
const ctrl = require('./combustible.controller')
const { autenticar, soloAdmin, rolesPermitidos } = require('../../middlewares/auth.middleware')

router.use(autenticar, rolesPermitidos('ADMIN', 'OPERACIONES', 'COMBUSTIBLE_TALLER'))

router.get('/configuracion/:camionId', ctrl.obtenerConfiguracion)
router.put('/configuracion/:camionId', rolesPermitidos('ADMIN', 'COMBUSTIBLE_TALLER'), ctrl.guardarConfiguracion)

router.get('/controles', ctrl.listarControles)
router.get('/controles/resumen', ctrl.obtenerResumen)
router.get('/controles/:id', ctrl.obtenerControl)
router.post('/controles', ctrl.abrirControl)
router.patch('/controles/:id', soloAdmin, ctrl.editarControl)
router.post('/controles/:id/eventos', ctrl.registrarEvento)
router.delete('/controles/:id/eventos/:eventoId', soloAdmin, ctrl.eliminarEvento)
router.post('/controles/:id/cerrar', ctrl.cerrarControl)

module.exports = router
