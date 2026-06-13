const service = require('./camiones.service')
const { ok } = require('../../utils/respuesta')

const listar = async (req, res) => {
  const camiones = await service.listar()
  return ok(res, camiones)
}

const obtener = async (req, res) => {
  const camion = await service.obtener(req.params.id)
  return ok(res, camion)
}

const crear = async (req, res) => {
  const camion = await service.crear(req.body)
  return ok(res, camion, 'Camión creado', 201)
}

const actualizar = async (req, res) => {
  const camion = await service.actualizar(req.params.id, req.body)
  return ok(res, camion, 'Camión actualizado')
}

const eliminar = async (req, res) => {
  await service.eliminar(req.params.id)
  return ok(res, null, 'Camion eliminado')
}

module.exports = { listar, obtener, crear, actualizar, eliminar }
