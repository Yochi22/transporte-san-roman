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

const entrarTaller = async (req, res) => {
  const { motivo } = req.body
  const camion = await service.entrarTaller(req.params.id, motivo)
  return ok(res, camion, 'Camión enviado a taller')
}

const salirTaller = async (req, res) => {
  const camion = await service.salirTaller(req.params.id)
  return ok(res, camion, 'Camión listo y disponible')
}

const eliminar = async (req, res) => {
  await service.eliminar(req.params.id)
  return ok(res, null, 'Camion eliminado')
}

module.exports = { listar, obtener, crear, actualizar, entrarTaller, salirTaller, eliminar }
