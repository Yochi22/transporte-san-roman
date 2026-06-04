const REGLAS_OPERATIVAS = [
  {
    tipo: 'CARGANDO',
    frases: ['montando carga', 'metiendo carga', 'en el cargadero', 'me estan cargando', 'agarrando carga'],
  },
  {
    tipo: 'DESCARGADO',
    estadoParada: 'EN_CURSO',
    frases: ['bajando carga', 'sacando carga', 'me estan descargando', 'en descarga'],
  },
  {
    tipo: 'DESCARGADO',
    estadoParada: 'COMPLETADA',
    frases: ['quede vacio', 'quede vacío', 'ya quede vacio', 'termine descarga', 'solte la carga', 'entrega lista'],
  },
  {
    tipo: 'EN_RUTA',
    frases: ['voy rodando', 'voy en camino', 'voy bajando', 'voy subiendo', 'ya arranque', 'ya coronamos'],
  },
  {
    tipo: 'ESPERANDO_INSTRUCCIONES',
    frases: ['quedo atento', 'a la orden', 'que hago ahora', 'sin novedad esperando', 'pendiente de instrucciones'],
  },
  {
    tipo: 'EN_PERNOCTA',
    frases: ['voy a dormir', 'me quede a dormir', 'pare por hoy', 'guarde el carro'],
  },
  {
    tipo: 'LIBRE',
    ubicacion: 'Sede Barquisimeto',
    frases: ['en transporte san roman', 'llegando a transporte san roman', 'llegue a transporte san roman', 'en tsr', 'llegando a tsr', 'llegue a tsr'],
  },
]

const describirVocabulario = () =>
  REGLAS_OPERATIVAS.map(
    (regla) => `- ${regla.frases.join(', ')} => ${regla.tipo}${regla.estadoParada ? ` / ${regla.estadoParada}` : ''}`
  ).join('\n')

module.exports = { REGLAS_OPERATIVAS, describirVocabulario }
