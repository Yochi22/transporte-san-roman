const service = require('./combustible.service')
const { ok } = require('../../utils/respuesta')

const resumenViaje = async (req, res) => {
  const resumen = await service.resumenViaje(req.params.viajeId)
  return ok(res, resumen)
}

const crearEvento = async (req, res) => {
  const resumen = await service.crearEvento(req.params.viajeId, req.body)
  return ok(res, resumen, 'Evento de combustible registrado', 201)
}

const eliminarEvento = async (req, res) => {
  const resumen = await service.eliminarEvento(req.params.id)
  return ok(res, resumen, 'Evento de combustible eliminado')
}

const listarEstandares = async (req, res) => {
  const estandares = await service.listarEstandares()
  return ok(res, estandares)
}

const crearEstandar = async (req, res) => {
  const estandar = await service.crearEstandar(req.body)
  return ok(res, estandar, 'Estandar de ruta creado', 201)
}

module.exports = {
  resumenViaje,
  crearEvento,
  eliminarEvento,
  listarEstandares,
  crearEstandar
}
