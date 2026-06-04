const express = require('express')
const { loginController, perfil } = require('./auth.controller')
const { autenticar } = require('../../middlewares/auth.middleware')

const router = express.Router()

router.post('/login', loginController)
router.get('/perfil', autenticar, perfil)

module.exports = router