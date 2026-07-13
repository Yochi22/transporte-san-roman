const service = require('./viajes.service')
const prisma = require('../../config/database')
const { ok, error } = require('../../utils/respuesta')
const { enviarMensaje } = require('../../services/messaging/whatsapp')

const filtrarFinanzas = (valor, rol) => {
  if (rol === 'ADMIN' || !valor) return valor
  if (Array.isArray(valor)) return valor.map((item) => filtrarFinanzas(item, rol))
  if (valor.items) return { ...valor, items: filtrarFinanzas(valor.items, rol) }

  const {
    viaticosDepositados,
    viaticosGastados,
    honorariosChofer,
    fechaLiquidacion,
    numeroGuia,
    gastos,
    ...viaje
  } = valor
  return viaje
}

const listar = async (req, res) => {
  const viajes = await service.listar(req.query)
  return ok(res, filtrarFinanzas(viajes, req.usuario.rol))
}

const obtener = async (req, res) => {
  const viaje = await service.obtener(req.params.id)
  return ok(res, filtrarFinanzas(viaje, req.usuario.rol))
}

const crear = async (req, res) => {
  const viaje = await service.crear(req.body, req.usuario.id)
  await notificarAgendamiento(viaje)
  return ok(res, filtrarFinanzas(viaje, req.usuario.rol), 'Viaje creado', 201)
}

const listarArchivo = async (req, res) => {
  const archivo = await service.listarArchivo(req.query)
  return ok(res, filtrarFinanzas(archivo, req.usuario.rol))
}

const notificarAgendamiento = async (viaje) => {
  const chofer = await prisma.chofer.findUnique({
    where: { id: viaje.choferId },
    select: { whatsappChatId: true }
  })
  if (!chofer?.whatsappChatId) return
  const cargas = viaje.paradas.filter((parada) => parada.tipo === 'CARGA')
  const paradas = cargas.map((parada, index) => {
    const hora = parada.fechaProgramada
      ? ` - ${new Date(parada.fechaProgramada).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Caracas' })}`
      : parada.cargarAlDescargar
        ? ' - AL DESCARGAR el viaje anterior'
        : ''
    return `${index + 1}. Carga: ${parada.lugar}, ${parada.ciudad}${hora}`
  })
  if (paradas.length === 0) paradas.push('Carga: por confirmar')

  const mensaje = [
    `Nuevo viaje agendado: ${viaje.codigo}`,
    `Unidad: ${viaje.camion?.placa || 'Por confirmar'}`,
    '',
    'Lugar de carga:',
    ...paradas,
    '',
    'Opciones de reporte:',
    '1 - Cargando',
    '2 - Lista la carga',
    '3 - Descargando',
    '4 - Lista la descarga',
    '5 - En pernocta',
    '6 - Esperando instrucciones',
    '',
    'Tambien puedes escribir o enviar una nota de voz con tu reporte.'
  ].join('\n')

  try {
    await enviarMensaje(chofer.whatsappChatId, mensaje)
  } catch (error) {
    console.error('No se pudo notificar el agendamiento por WhatsApp:', error.message)
  }
}

const actualizarParada = async (req, res) => {
  const parada = await service.actualizarParada(req.params.id, req.params.paradaId, req.body.estado)
  return ok(res, parada, 'Estado de parada actualizado')
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
  const { numeroGuia } = req.body
  const soloLogistica = req.body.soloLogistica === true
  if (!soloLogistica && req.usuario.rol !== 'ADMIN') {
    return error(res, 'Solo un administrador puede liquidar viajes', 403)
  }
  const viaje = await service.cerrar(req.params.id, soloLogistica, numeroGuia)
  const mensaje = soloLogistica ? 'Viaje completado logísticamente' : 'Viaje cerrado y liquidado completamente'
  return ok(res, filtrarFinanzas(viaje, req.usuario.rol), mensaje)
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
  actualizarParada,
  cerrar,
  listarPendientesLiquidacion,
  actualizarHonorarios,
  recargarViaticos,
  confirmarDocumentacion
}
