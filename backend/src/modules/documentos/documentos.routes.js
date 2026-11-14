const express = require('express')
const router = express.Router()
const ctrl = require('./documentos.controller')
const { autenticar, soloAdmin, rolesPermitidos } = require('../../middlewares/auth.middleware')

// Consulta: los mismos roles que ven Recursos. Modificacion: solo ADMIN.
router.use(autenticar, rolesPermitidos('ADMIN', 'OPERACIONES', 'COMBUSTIBLE_TALLER'))

router.get('/', ctrl.listar)
router.get('/resumen', ctrl.resumen)
router.get('/catalogo', ctrl.catalogo)
router.post('/', soloAdmin, ctrl.crear)
router.put('/:id', soloAdmin, ctrl.actualizar)
router.delete('/:id', soloAdmin, ctrl.eliminar)

module.exports = router
