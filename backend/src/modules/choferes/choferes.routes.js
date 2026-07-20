const express = require('express')
const router = express.Router()
const ctrl = require('./choferes.controller')
const { autenticar, adminOOperaciones, soloAdmin } = require('../../middlewares/auth.middleware')

router.use(autenticar, adminOOperaciones)

router.get('/', ctrl.listar)
router.get('/:id', ctrl.obtener)
router.post('/', soloAdmin, ctrl.crear)
router.put('/:id', soloAdmin, ctrl.actualizar)
router.patch('/:id/inactivar', soloAdmin, ctrl.inactivar)
router.delete('/:id', soloAdmin, ctrl.eliminar)

module.exports = router
