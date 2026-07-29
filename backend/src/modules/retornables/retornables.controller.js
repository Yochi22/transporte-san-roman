const service = require('./retornables.service')
const { ok } = require('../../utils/respuesta')

const listar = async (req, res) => {
  const data = await service.listar(req.query)
  return ok(res, data)
}

const listarPorViaje = async (req, res) => {
  const data = await service.listarPorViaje(req.params.viajeId)
  return ok(res, data)
}

const crear = async (req, res) => {
  const data = await service.crear(req.body, req.usuario?.id)
  return ok(res, data, 'Retornable registrado', 201)
}

const mover = async (req, res) => {
  const data = await service.mover(req.params.id, req.body, req.usuario?.id)
  return ok(res, data, 'Movimiento registrado')
}

module.exports = { listar, listarPorViaje, crear, mover }