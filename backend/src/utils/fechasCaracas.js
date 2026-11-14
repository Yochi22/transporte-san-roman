// Venezuela usa UTC-4 todo el ano (sin horario de verano). El servidor corre
// en UTC, asi que "hoy" y los rangos por dia se calculan aqui de forma
// explicita para que no se corran cuatro horas.
const DESFASE_CARACAS_MS = 4 * 60 * 60 * 1000
const MS_POR_DIA = 24 * 60 * 60 * 1000
const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2}$/

// Convierte 'AAAA-MM-DD' en un Date a medianoche UTC (como guarda Postgres un DATE).
const parsearFecha = (valor) => {
  if (typeof valor !== 'string' || !FORMATO_FECHA.test(valor)) return null
  const fecha = new Date(`${valor}T00:00:00.000Z`)
  if (Number.isNaN(fecha.getTime()) || fecha.toISOString().slice(0, 10) !== valor) return null
  return fecha
}

const formatearFecha = (fecha) => (fecha ? fecha.toISOString().slice(0, 10) : null)

// Fecha de hoy en Caracas, representada a medianoche UTC para compararla con columnas DATE.
const hoyCaracas = () => parsearFecha(new Date(Date.now() - DESFASE_CARACAS_MS).toISOString().slice(0, 10))

const sumarDias = (fecha, dias) => new Date(fecha.getTime() + dias * MS_POR_DIA)

const diasEntre = (desde, hasta) => Math.round((hasta.getTime() - desde.getTime()) / MS_POR_DIA)

// Instantes reales que delimitan un rango de dias de Caracas, para filtrar columnas con hora.
const inicioDiaCaracas = (fecha) => new Date(fecha.getTime() + DESFASE_CARACAS_MS)
const finDiaCaracas = (fecha) => new Date(fecha.getTime() + DESFASE_CARACAS_MS + MS_POR_DIA - 1)

module.exports = { parsearFecha, formatearFecha, hoyCaracas, sumarDias, diasEntre, inicioDiaCaracas, finDiaCaracas }
