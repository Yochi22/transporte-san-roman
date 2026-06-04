const service = require('./reportes.service')
const { ok } = require('../../utils/respuesta')

const listar = async (req, res) => {
  const reportes = await service.listar()
  return ok(res, reportes)
}

const porViaje = async (req, res) => {
  const reportes = await service.porViaje(req.params.viajeId)
  return ok(res, reportes)
}

module.exports = { listar, porViaje }