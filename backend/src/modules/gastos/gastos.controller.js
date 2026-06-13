const service = require('./gastos.service')
const { ok } = require('../../utils/respuesta')

const crear = async (req, res) => {
  const gasto = await service.crear(req.body, 'ADMIN')
  return ok(res, gasto, 'Gasto registrado', 201)
}

const eliminar = async (req, res) => {
  await service.eliminar(req.params.id)
  return ok(res, {}, 'Gasto eliminado')
}

module.exports = { crear, eliminar }
