const service = require('./tasas.service')
const { ok } = require('../../utils/respuesta')

const bcv = async (req, res) => {
  const data = await service.obtenerBcv()
  return ok(res, data)
}

module.exports = { bcv }
