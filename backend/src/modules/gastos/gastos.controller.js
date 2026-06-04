const service = require('./gastos.service')
const { ok } = require('../../utils/respuesta')

const porViaje = async (req, res) => {
  const gastos = await service.porViaje(req.params.viajeId)
  return ok(res, gastos)
}

const crear = async (req, res) => {
  const gasto = await service.crear(req.body, 'ADMIN')
  return ok(res, gasto, 'Gasto registrado', 201)
}

const eliminar = async (req, res) => {
  await service.eliminar(req.params.id)
  return ok(res, {}, 'Gasto eliminado')
}

module.exports = { porViaje, crear, eliminar }
