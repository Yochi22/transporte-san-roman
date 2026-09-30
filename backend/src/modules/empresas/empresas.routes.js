const express = require('express')
const ctrl = require('./empresas.controller')
const { autenticar, adminOOperaciones, soloAdmin } = require('../../middlewares/auth.middleware')

const router = express.Router()
router.use(autenticar, adminOOperaciones)

router.get('/', ctrl.listar)
router.get('/:id', ctrl.obtener)
router.post('/', soloAdmin, ctrl.crear)
router.put('/:id', soloAdmin, ctrl.actualizar)
router.patch('/:id/inactivar', soloAdmin, ctrl.inactivar)
router.patch('/:id/reactivar', soloAdmin, ctrl.reactivar)
router.delete('/:id', soloAdmin, ctrl.eliminar)
router.post('/:id/sedes', soloAdmin, ctrl.crearSede)
router.put('/:id/sedes/:sedeId', soloAdmin, ctrl.actualizarSede)
router.patch('/:id/sedes/:sedeId/inactivar', soloAdmin, ctrl.inactivarSede)
router.patch('/:id/sedes/:sedeId/reactivar', soloAdmin, ctrl.reactivarSede)
router.delete('/:id/sedes/:sedeId', soloAdmin, ctrl.eliminarSede)

module.exports = router
