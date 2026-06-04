/**
 * Normaliza un número de teléfono venezolano al formato internacional sin '+'.
 * Ejemplos:
 *   '04121234567'   → '584121234567'
 *   '+584121234567' → '584121234567'
 *   '584121234567'  → '584121234567'
 *   '4121234567'    → '584121234567'
 * 
 * Este formato es el que usa WhatsApp internamente (JID = 584121234567@s.whatsapp.net)
 */
const normalizarTelefono = (telefono) => {
  if (!telefono) return telefono

  // Eliminar espacios, guiones, paréntesis y el signo +
  let limpio = telefono.replace(/[\s\-\(\)\+]/g, '')

  // Si empieza con '0' (formato local venezolano: 04XX...)
  if (limpio.startsWith('0')) {
    limpio = '58' + limpio.slice(1)
  }

  // Si empieza directamente con '4' (sin código de país ni cero: 4121234567)
  if (limpio.startsWith('4') && limpio.length === 10) {
    limpio = '58' + limpio
  }

  return limpio
}

module.exports = { normalizarTelefono }
