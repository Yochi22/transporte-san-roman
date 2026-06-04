const service = require('./viajes.service')
const { ok } = require('../../utils/respuesta')
const { enviarMensaje } = require('../../services/messaging/whatsapp')

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
  await notificarAgendamiento(viaje)
  return ok(res, viaje, 'Viaje creado', 201)
}

const listarArchivo = async (req, res) => {
  const archivo = await service.listarArchivo(req.query)
  return ok(res, archivo)
}

const notificarAgendamiento = async (viaje) => {
  if (!viaje.chofer?.whatsappChatId) return
  const paradas = viaje.paradas.map((parada, index) => {
    const hora = parada.fechaProgramada
      ? ` - ${new Date(parada.fechaProgramada).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Caracas' })}`
      : parada.cargarAlDescargar
        ? ' - AL DESCARGAR el viaje anterior'
        : ''
    return `${index + 1}. ${parada.tipo}: ${parada.lugar}, ${parada.ciudad}${hora}`
  })

  const mensaje = [
    `Nuevo viaje agendado: ${viaje.codigo}`,
    `Unidad: ${viaje.camion?.placa || 'Por confirmar'}`,
    '',
    ...paradas,
    '',
    'Opciones de reporte:',
    '1 - Cargando',
    '2 - En ruta',
    '3 - Descargado',
    '4 - Esperando instrucciones',
    '5 - En pernocta',
    '6 - Registrar gasto',
    '',
    'Tambien puedes escribir o enviar una nota de voz con tu reporte.'
  ].join('\n')

  try {
    await enviarMensaje(viaje.chofer.whatsappChatId, mensaje)
  } catch (error) {
    console.error('No se pudo notificar el agendamiento por WhatsApp:', error.message)
  }
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

const listarPendientesLiquidacion = async (req, res) => {
  const pendientes = await service.listarPendientesLiquidacion(req.query)
  return ok(res, pendientes)
}

const actualizarHonorarios = async (req, res) => {
  const viaje = await service.actualizarHonorarios(req.params.id, req.body.honorariosChofer)
  return ok(res, viaje, 'Honorarios actualizados')
}

module.exports = {
  listar,
  listarArchivo,
  obtener,
  crear,
  actualizar,
  agregarTramo,
  actualizarParada,
  eliminar,
  cerrar,
  obtenerLiquidacion,
  listarLiquidaciones,
  listarPendientesLiquidacion,
  actualizarHonorarios,
  recargarViaticos,
  confirmarDocumentacion
}
