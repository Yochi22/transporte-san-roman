const express = require('express')
const router = express.Router()
const ctrl = require('./camiones.controller')
const { autenticar, adminOOperaciones } = require('../../middlewares/auth.middleware')

router.use(autenticar, adminOOperaciones)

router.get('/', ctrl.listar)
router.get('/:id', ctrl.obtener)
router.post('/', ctrl.crear)
router.put('/:id', ctrl.actualizar)
router.patch('/:id/taller', ctrl.entrarTaller)
router.patch('/:id/salir-taller', ctrl.salirTaller)
router.delete('/:id', ctrl.eliminar)

module.exports = router
