const generarCodigoViaje = () => {
  const fecha = new Date()
  const anio = fecha.getFullYear()
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  const random = String(Math.floor(Math.random() * 9000) + 1000)
  return `V-${anio}${mes}-${random}`
}

module.exports = { generarCodigoViaje }