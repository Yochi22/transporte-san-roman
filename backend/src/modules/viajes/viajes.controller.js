const service = require('./viajes.service')
const { ok } = require('../../utils/respuesta')

const listar = async (req, res) => {
  const viajes = await service.listar(req.query)
  return ok(res, viajes)
}

const obtener = async (req, res) => {
  const viaje = await service.obtener(req.params.id)
  return ok(res, viaje)
}

const crear = async (req, res) => {
  const viaje = await service.crear(req.body, req.usuario.id)
  return ok(res, viaje, 'Viaje creado', 201)
}

const actualizar = async (req, res) => {
  const viaje = await service.actualizar(req.params.id, req.body)
  return ok(res, viaje, 'Viaje actualizado')
}

const agregarTramo = async (req, res) => {
  const viaje = await service.agregarTramo(req.params.id, req.body)
  return ok(res, viaje, 'Tramo agregado al viaje')
}

const actualizarParada = async (req, res) => {
  const parada = await service.actualizarParada(req.params.id, req.params.paradaId, req.body.estado)
  return ok(res, parada, 'Estado de parada actualizado')
}

const eliminar = async (req, res) => {
  await service.eliminar(req.params.id)
  return ok(res, null, 'Viaje eliminado satisfactoriamente')
}

const recargarViaticos = async (req, res) => {
  const { monto } = req.body
  const viaje = await service.recargarViaticos(req.params.id, monto)
  return ok(res, viaje, 'Viáticos recargados')
}

const confirmarDocumentacion = async (req, res) => {
  const viaje = await service.confirmarDocumentacion(req.params.id)
  return ok(res, viaje, 'Documentación confirmada')
}

const cerrar = async (req, res) => {
  const { soloLogistica, numeroGuia } = req.body
  const viaje = await service.cerrar(req.params.id, !!soloLogistica, numeroGuia)
  const mensaje = soloLogistica ? 'Viaje completado logísticamente' : 'Viaje cerrado y liquidado completamente'
  return ok(res, viaje, mensaje)
}

const obtenerLiquidacion = async (req, res) => {
  const liquidacion = await service.obtenerLiquidacion(req.params.id)
  return ok(res, liquidacion)
}

const listarLiquidaciones = async (req, res) => {
  const liquidaciones = await service.listarLiquidaciones(req.query)
  return ok(res, liquidaciones)
}

const actualizarHonorarios = async (req, res) => {
  const viaje = await service.actualizarHonorarios(req.params.id, req.body.honorariosChofer)
  return ok(res, viaje, 'Honorarios actualizados')
}

module.exports = {
  listar,
  obtener,
  crear,
  actualizar,
  agregarTramo,
  actualizarParada,
  eliminar,
  cerrar,
  obtenerLiquidacion,
  listarLiquidaciones,
  actualizarHonorarios,
  recargarViaticos,
  confirmarDocumentacion
}
