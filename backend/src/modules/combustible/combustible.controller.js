const service = require('./combustible.service')
const { ok } = require('../../utils/respuesta')

const obtenerConfiguracion = async (req, res) => {
  const configuracion = await service.obtenerConfiguracion(req.params.camionId)
  return ok(res, configuracion)
}

const guardarConfiguracion = async (req, res) => {
  const configuracion = await service.guardarConfiguracion(req.params.camionId, req.body)
  return ok(res, configuracion, 'Configuracion de combustible guardada')
}

const listarControles = async (req, res) => {
  const resultado = await service.listarControles(req.query)
  return ok(res, resultado)
}

const obtenerResumen = async (req, res) => {
  const resumen = await service.obtenerResumen(req.query)
  return ok(res, resumen)
}

const obtenerControl = async (req, res) => {
  const control = await service.obtenerControl(req.params.id)
  return ok(res, control)
}

const abrirControl = async (req, res) => {
  const control = await service.abrirControl({ ...req.body, creadoPorId: req.usuario?.id })
  return ok(res, control, 'Control de combustible abierto', 201)
}

const registrarEvento = async (req, res) => {
  const evento = await service.registrarEvento(req.params.id, req.body, req.usuario?.id)
  return ok(res, evento, 'Evento de combustible registrado', 201)
}

const eliminarEvento = async (req, res) => {
  await service.eliminarEvento(req.params.id, req.params.eventoId)
  return ok(res, {}, 'Evento eliminado')
}

const cerrarControl = async (req, res) => {
  const control = await service.cerrarControl(req.params.id, req.body, req.usuario?.id)
  return ok(res, control, 'Control de combustible cerrado')
}

const editarControl = async (req, res) => {
  const control = await service.editarControl(req.params.id, req.body)
  return ok(res, control, 'Control de combustible actualizado')
}

module.exports = {
  obtenerConfiguracion,
  guardarConfiguracion,
  listarControles,
  obtenerResumen,
  obtenerControl,
  abrirControl,
  registrarEvento,
  eliminarEvento,
  cerrarControl,
  editarControl
}
