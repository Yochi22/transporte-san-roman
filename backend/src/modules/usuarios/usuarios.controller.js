const service = require('./usuarios.service')
const { ok } = require('../../utils/respuesta')

const listar = async (req, res) => {
  const usuarios = await service.listar(req.query)
  return ok(res, usuarios)
}

const crear = async (req, res) => {
  const usuario = await service.crear(req.body)
  return ok(res, usuario, 'Usuario creado', 201)
}

const actualizar = async (req, res) => {
  const usuario = await service.actualizar(req.params.id, req.body, req.usuario.id)
  return ok(res, usuario, 'Usuario actualizado')
}

const desactivar = async (req, res) => {
  const usuario = await service.desactivar(req.params.id, req.usuario.id)
  return ok(res, usuario, 'Usuario desactivado')
}

const reactivar = async (req, res) => {
  const usuario = await service.reactivar(req.params.id)
  return ok(res, usuario, 'Usuario reactivado')
}

module.exports = { listar, crear, actualizar, desactivar, reactivar }
