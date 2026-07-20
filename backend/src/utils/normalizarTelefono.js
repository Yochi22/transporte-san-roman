const normalizarTelefono = (telefono) => {
  if (!telefono) return telefono

  let limpio = telefono.toString().replace(/\D/g, '')

  if (limpio.startsWith('00')) {
    limpio = limpio.slice(2)
  }

  if (limpio.startsWith('0')) {
    limpio = '58' + limpio.slice(1)
  }

  if (limpio.startsWith('4') && limpio.length === 10) {
    limpio = '58' + limpio
  }

  return limpio
}

const ultimosDigitosTelefono = (telefono, cantidad = 10) => {
  const limpio = normalizarTelefono(telefono)
  return limpio ? limpio.slice(-cantidad) : limpio
}

module.exports = { normalizarTelefono, ultimosDigitosTelefono }
