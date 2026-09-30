const service = require('./empresas.service')
const { ok } = require('../../utils/respuesta')

const listar = async (req, res) => ok(res, await service.listar(req.query))
const obtener = async (req, res) => ok(res, await service.obtener(req.params.id))
const crear = async (req, res) => ok(res, await service.crear(req.body), 'Empresa creada', 201)
const actualizar = async (req, res) => ok(res, await service.actualizar(req.params.id, req.body), 'Empresa actualizada')
const inactivar = async (req, res) => ok(res, await service.cambiarEstado(req.params.id, false), 'Empresa inactivada')
const reactivar = async (req, res) => ok(res, await service.cambiarEstado(req.params.id, true), 'Empresa reactivada')
const eliminar = async (req, res) => {
  await service.eliminar(req.params.id)
  return ok(res, null, 'Empresa eliminada')
}
const crearSede = async (req, res) => ok(res, await service.crearSede(req.params.id, req.body), 'Sede creada', 201)
const actualizarSede = async (req, res) => ok(res, await service.actualizarSede(req.params.id, req.params.sedeId, req.body), 'Sede actualizada')
const inactivarSede = async (req, res) => ok(res, await service.cambiarEstadoSede(req.params.id, req.params.sedeId, false), 'Sede inactivada')
const reactivarSede = async (req, res) => ok(res, await service.cambiarEstadoSede(req.params.id, req.params.sedeId, true), 'Sede reactivada')
const eliminarSede = async (req, res) => {
  await service.eliminarSede(req.params.id, req.params.sedeId)
  return ok(res, null, 'Sede eliminada')
}

module.exports = {
  listar,
  obtener,
  crear,
  actualizar,
  inactivar,
  reactivar,
  eliminar,
  crearSede,
  actualizarSede,
  inactivarSede,
  reactivarSede,
  eliminarSede,
}
