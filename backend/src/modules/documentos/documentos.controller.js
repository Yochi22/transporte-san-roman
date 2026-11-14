const service = require('./documentos.service')
const { ok } = require('../../utils/respuesta')

const listar = async (req, res) => ok(res, await service.listar(req.query))
const resumen = async (req, res) => ok(res, await service.obtenerResumen())
const catalogo = async (req, res) => ok(res, service.obtenerCatalogo())
const crear = async (req, res) => ok(res, await service.crear(req.body), 'Documento registrado', 201)
const actualizar = async (req, res) => ok(res, await service.actualizar(req.params.id, req.body), 'Documento actualizado')
const eliminar = async (req, res) => {
  await service.eliminar(req.params.id)
  return ok(res, null, 'Documento eliminado')
}

module.exports = { listar, resumen, catalogo, crear, actualizar, eliminar }
