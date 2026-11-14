const express = require('express')
const router = express.Router()
const service = require('./exportar.service')
const { ok } = require('../../utils/respuesta')
const { autenticar, rolesPermitidos } = require('../../middlewares/auth.middleware')

router.use(autenticar, rolesPermitidos('ADMIN', 'OPERACIONES', 'COMBUSTIBLE_TALLER'))

// Devuelve los datos en filas; el archivo .xlsx se arma en el navegador.
// El permiso por conjunto (gastos y liquidaciones solo ADMIN) se valida en el servicio.
router.get('/', async (req, res) => ok(res, await service.exportar(req.query, req.usuario.rol)))
router.get('/conjuntos', async (req, res) => ok(res, service.conjuntosPermitidos(req.usuario.rol)))

module.exports = router
