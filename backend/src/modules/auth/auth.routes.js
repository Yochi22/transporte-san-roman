const express = require('express')
const { loginController, perfil, logout } = require('./auth.controller')
const { autenticar } = require('../../middlewares/auth.middleware')
const { loginLimiter } = require('../../middlewares/security.middleware')

const router = express.Router()

router.post('/login', loginLimiter, loginController)
router.post('/logout', autenticar, logout)
router.get('/perfil', autenticar, perfil)

module.exports = router
