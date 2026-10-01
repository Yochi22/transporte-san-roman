const service = require('./choferes.service')
const { ok } = require('../../utils/respuesta')

const listar = async (req, res) => {
  const choferes = await service.listar(req.query)
  return ok(res, choferes)
}

const obtener = async (req, res) => {
  const chofer = await service.obtener(req.params.id)
  return ok(res, chofer)
}

const crear = async (req, res) => {
  const chofer = await service.crear(req.body)
  return ok(res, chofer, 'Chofer creado', 201)
}

const actualizar = async (req, res) => {
  const chofer = await service.actualizar(req.params.id, req.body)
  return ok(res, chofer, 'Chofer actualizado')
}

const eliminar = async (req, res) => {
  await service.eliminar(req.params.id)
  return ok(res, null, 'Chofer eliminado')
}

const inactivar = async (req, res) => {
  await service.inactivar(req.params.id)
  return ok(res, null, 'Chofer inactivado')
}

const reactivar = async (req, res) => {
  const chofer = await service.reactivar(req.params.id)
  return ok(res, chofer, 'Chofer reactivado')
}

const crearAcceso = async (req, res) => {
  const resultado = await service.crearAcceso(req.params.id)
  return ok(res, resultado, 'Acceso creado', 201)
}

const resetearClaveAcceso = async (req, res) => {
  const resultado = await service.resetearClaveAcceso(req.params.id)
  return ok(res, resultado, 'Clave restablecida')
}

const revocarAcceso = async (req, res) => {
  const resultado = await service.revocarAcceso(req.params.id)
  return ok(res, resultado, 'Acceso revocado')
}

const reactivarAcceso = async (req, res) => {
  const resultado = await service.reactivarAcceso(req.params.id)
  return ok(res, resultado, 'Acceso reactivado')
}

module.exports = {
  listar,
  obtener,
  crear,
  actualizar,
  eliminar,
  inactivar,
  reactivar,
  crearAcceso,
  resetearClaveAcceso,
  revocarAcceso,
  reactivarAcceso
}
