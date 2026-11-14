// Mismo criterio de colores que la hoja de control de la oficina:
// rojo = vencido o a 30 dias o menos, amarillo = 31 a 60 dias, verde = mas de 60.
export const ESTADOS_DOCUMENTO = {
  VENCIDO: { etiqueta: 'Vencido', clase: 'bg-red-600 text-white', punto: 'bg-red-600' },
  POR_VENCER: { etiqueta: 'Por vencer', clase: 'bg-red-50 text-red-700', punto: 'bg-red-500' },
  PROXIMO: { etiqueta: 'Proximo', clase: 'bg-amber-50 text-amber-700', punto: 'bg-amber-500' },
  VIGENTE: { etiqueta: 'Vigente', clase: 'bg-emerald-50 text-emerald-700', punto: 'bg-emerald-500' },
  NO_VENCE: { etiqueta: 'No vence', clase: 'bg-neutral-100 text-neutral-600', punto: 'bg-neutral-400' },
}

export const FILTROS_ESTADO = [
  ['TODOS', 'Todos'],
  ['VENCIDO', 'Vencidos'],
  ['POR_VENCER', 'Por vencer'],
  ['PROXIMO', 'Proximos'],
  ['VIGENTE', 'Vigentes'],
]

// Cuantos documentos requieren atencion: vencidos + los que vencen en 30 dias o menos.
export const totalUrgentes = (resumen) => (resumen?.vencidos || 0) + (resumen?.porVencer || 0)

// 'AAAA-MM-DD' -> 'DD/MM/AAAA', sin pasar por Date para que la zona horaria no corra el dia.
export const formatearFechaDocumento = (valor) => {
  if (!valor) return 'No vence'
  const [anio, mes, dia] = valor.split('-')
  return `${dia}/${mes}/${anio}`
}

export const textoDiasRestantes = (documento) => {
  const dias = documento.diasRestantes
  if (dias === null || dias === undefined) return ''
  if (dias < 0) return dias === -1 ? 'Vencio ayer' : `Vencio hace ${Math.abs(dias)} dias`
  if (dias === 0) return 'Vence hoy'
  if (dias === 1) return 'Vence manana'
  return `Faltan ${dias} dias`
}
