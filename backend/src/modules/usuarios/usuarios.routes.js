const express = require('express')
const ctrl = require('./usuarios.controller')
const { autenticar, soloAdmin } = require('../../middlewares/auth.middleware')

const router = express.Router()

router.use(autenticar, soloAdmin)

router.get('/', ctrl.listar)
router.post('/', ctrl.crear)
router.put('/:id', ctrl.actualizar)
router.patch('/:id/reactivar', ctrl.reactivar)
router.delete('/:id', ctrl.desactivar)

module.exports = router
