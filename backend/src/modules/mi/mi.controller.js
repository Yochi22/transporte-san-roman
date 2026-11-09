const service = require('./mi.service')
const { ok } = require('../../utils/respuesta')

const miViaje = async (req, res) => {
  const resultado = await service.obtenerMiViaje(req.usuario.choferId)
  return ok(res, resultado)
}

const crearReporte = async (req, res) => {
  const io = req.app.get('io')
  const resultado = await service.registrarReporte(
    { choferId: req.usuario.choferId, ...req.body },
    io
  )
  return ok(res, resultado, 'Reporte enviado', 201)
}

const miCombustible = async (req, res) => {
  const resultado = await service.obtenerMiCombustible(req.usuario.choferId)
  return ok(res, resultado)
}

const abrirControlCombustible = async (req, res) => {
  const control = await service.abrirMiControlCombustible(req.usuario.choferId, req.body, req.usuario.id)
  return ok(res, control, 'Control de combustible abierto', 201)
}

const registrarEventoCombustible = async (req, res) => {
  const evento = await service.registrarMiEventoCombustible(req.usuario.choferId, req.params.id, req.body, req.usuario.id)
  return ok(res, evento, 'Evento de combustible registrado', 201)
}

const cerrarControlCombustible = async (req, res) => {
  const control = await service.cerrarMiControlCombustible(req.usuario.choferId, req.params.id, req.body, req.usuario.id)
  return ok(res, control, 'Control de combustible cerrado')
}

module.exports = {
  miViaje,
  crearReporte,
  miCombustible,
  abrirControlCombustible,
  registrarEventoCombustible,
  cerrarControlCombustible,
}
