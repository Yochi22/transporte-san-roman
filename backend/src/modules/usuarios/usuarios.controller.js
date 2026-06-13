const service = require('./usuarios.service')
const { ok } = require('../../utils/respuesta')

const listar = async (req, res) => {
  const usuarios = await service.listar()
  return ok(res, usuarios)
}

const crear = async (req, res) => {
  const usuario = await service.crear(req.body)
  return ok(res, usuario, 'Usuario creado', 201)
}

const actualizar = async (req, res) => {
  const usuario = await service.actualizar(req.params.id, req.body)
  return ok(res, usuario, 'Usuario actualizado')
}

const desactivar = async (req, res) => {
  await service.desactivar(req.params.id, req.usuario.id)
  return ok(res, {}, 'Usuario desactivado')
}

module.exports = { listar, crear, actualizar, desactivar }
