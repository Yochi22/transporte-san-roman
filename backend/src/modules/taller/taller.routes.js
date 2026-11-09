const express = require('express')
const router = express.Router()
const ctrl = require('./taller.controller')
const { autenticar, rolesPermitidos } = require('../../middlewares/auth.middleware')

router.use(autenticar, rolesPermitidos('ADMIN', 'OPERACIONES', 'COMBUSTIBLE_TALLER'))
router.get('/', ctrl.listar)
router.post('/', ctrl.crear)
router.patch('/:id/completar', ctrl.completar)

module.exports = router
