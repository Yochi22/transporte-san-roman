const service = require('./gps.service')
const { ok } = require('../../utils/respuesta')

const recibirPosicion = async (req, res) => {
  const result = await service.registrarPosicion(req.body)
  return ok(res, result, 'Posicion GPS actualizada')
}

const obtenerPosicionCamion = async (req, res) => {
  const result = await service.obtenerPosicionCamion(req.params.truckId)
  return ok(res, result, 'Posicion GPS consultada')
}

module.exports = { recibirPosicion, obtenerPosicionCamion }
