const ok = (res, data = {}, mensaje = 'OK', status = 200) => {
  return res.status(status).json({ ok: true, mensaje, data })
}

const error = (res, mensaje = 'Error interno', status = 500, detalle = null) => {
  return res.status(status).json({ ok: false, mensaje, detalle })
}

module.exports = { ok, error }