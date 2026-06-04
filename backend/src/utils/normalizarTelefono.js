const normalizarTelefono = (telefono) => {
  if (!telefono) return telefono

  let limpio = telefono.replace(/[\s\-\(\)\+]/g, '')

  if (limpio.startsWith('0')) {
    limpio = '58' + limpio.slice(1)
  }

  if (limpio.startsWith('4') && limpio.length === 10) {
    limpio = '58' + limpio
  }

  return limpio
}

module.exports = { normalizarTelefono }
