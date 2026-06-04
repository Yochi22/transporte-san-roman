const express = require('express')
const router = express.Router()
const ctrl = require('./choferes.controller')
const { autenticar, adminOOperaciones } = require('../../middlewares/auth.middleware')

router.use(autenticar, adminOOperaciones)

router.get('/', ctrl.listar)
router.get('/:id', ctrl.obtener)
router.post('/', ctrl.crear)
router.put('/:id', ctrl.actualizar)
router.delete('/:id', ctrl.eliminar)

module.exports = router
