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

module.exports = { miViaje, crearReporte }
