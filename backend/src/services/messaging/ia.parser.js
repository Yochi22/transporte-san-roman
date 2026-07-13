const { GoogleGenerativeAI } = require('@google/generative-ai')
const { REGLAS_OPERATIVAS, describirVocabulario } = require('./vocabulario.operativo')

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash'
const MAX_AUDIO_BYTES = 20 * 1024 * 1024

const TIPOS_REPORTE = new Set([
  'CARGANDO',
  'EN_RUTA',
  'DESCARGADO',
  'ESPERANDO_INSTRUCCIONES',
  'EN_PERNOCTA',
  'LIBRE',
  'OTRO',
])

const ESTADOS_PARADA = new Set(['EN_CURSO', 'COMPLETADA'])

const normalizar = (valor = '') =>
  valor
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

const transcribirAudio = async (audioBuffer, mimeType = 'audio/ogg') => {
  try {
    if (!Buffer.isBuffer(audioBuffer) || audioBuffer.length === 0) {
      throw new Error('El audio descargado esta vacio')
    }
    if (audioBuffer.length > MAX_AUDIO_BYTES) {
      throw new Error('La nota de voz supera el limite de 20 MB')
    }

    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL })
    const mimeTypeLimpio = normalizarMimeAudio(mimeType)

    const audioPart = {
      inlineData: {
        data: audioBuffer.toString('base64'),
        mimeType: mimeTypeLimpio,
      },
    }

    const prompt =
      'Actua como un experto transcriptor. Transcribe exactamente lo que dice este chofer de camion. No agregues nada extra.'

    const result = await model.generateContent([prompt, audioPart])
    const texto = result.response.text().trim()
    console.log('[IA] Transcripcion completada')
    return texto
  } catch (err) {
    console.error(`[IA Error] Error en transcribirAudio (${mimeType}):`, err.message)
    return ''
  }
}

const serializarViajes = (viajes) =>
  viajes
    .map((viaje) => {
      const paradas = viaje.paradas
        .map(
          (p) =>
            `    - paradaId: ${p.id} | tramo: ${p.tramo || 1} | orden: ${p.orden} | tipo: ${p.tipo} | lugar: ${p.lugar} | ciudad: ${p.ciudad} | estado: ${p.estado}`
        )
        .join('\n')

      return [
        `- viajeId: ${viaje.id}`,
        `  codigo: ${viaje.codigo}`,
        `  estadoLogistico: ${viaje.estadoLogistico}`,
        '  paradas:',
        paradas,
      ].join('\n')
    })
    .join('\n\n')

const parsearReporteChofer = async (texto, viajesActivos, ubicacionActual = null) => {
  const viajes = Array.isArray(viajesActivos) ? viajesActivos : [viajesActivos].filter(Boolean)

  if (viajes.length === 0) {
    return crearResultadoFallback(texto, viajes)
  }

  const prompt = `Eres un asistente que procesa reportes de choferes de camiones en Venezuela.
El chofer puede escribir de forma informal, con errores ortograficos, abreviaciones venezolanas, o puede ser una transcripcion de nota de voz.
Tambien utiliza vocabulario interno del negocio:
${describirVocabulario()}

Debes asociar el reporte al viaje correcto usando TODOS los viajes activos del chofer.

Mensaje del chofer: "${texto}"
Ubicacion actual conocida del chofer: ${ubicacionActual || 'null'}

Viajes activos:
${serializarViajes(viajes)}

Responde UNICAMENTE con un JSON valido, sin texto adicional, sin backticks, sin markdown:
{
  "viajeId": "uuid del viaje al que pertenece este reporte, null si no se puede inferir con certeza",
  "tipo": "CARGANDO|EN_RUTA|DESCARGADO|ESPERANDO_INSTRUCCIONES|EN_PERNOCTA|LIBRE|OTRO",
  "ubicacion": "ciudad o lugar especifico, null si no se menciona",
  "resumen": "maximo 10 palabras de que reporto",
  "paradaId": "uuid de la parada que se esta completando o iniciando, null si no aplica",
  "estadoParada": "EN_CURSO|COMPLETADA|null segun el reporte"
}

Reglas de asociacion:
- Si menciona el codigo del viaje explicitamente, usa ese viaje.
- Si menciona una ciudad o lugar que es destino/parada de un viaje especifico, usa ese viaje.
- Si dice que esta cargando, usa el viaje cuya proxima parada pendiente sea CARGA.
- Si dice que descargo, usa el viaje cuya parada EN_CURSO sea DESCARGA.
- Si solo hay un viaje activo, usa ese viaje por defecto.
- Si hay ambiguedad real, devuelve viajeId null.

Reglas de parada:
- "estoy cargando en X" implica parada tipo CARGA en esa ciudad/lugar con estadoParada EN_CURSO.
- "lista la carga" o "ya cargue" implica parada tipo CARGA con estadoParada COMPLETADA.
- "estoy descargando en X" implica parada tipo DESCARGA en esa ciudad/lugar con estadoParada EN_CURSO.
- "lista la descarga" o "ya descargue en X" implica parada tipo DESCARGA en esa ciudad/lugar con estadoParada COMPLETADA.
- No inventes ids. paradaId debe existir en la lista o ser null.`

  try {
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL })
    const result = await model.generateContent(prompt)
    const contenido = result.response.text().trim()
    const jsonLimpio = contenido.replace(/```json/g, '').replace(/```/g, '').trim()
    const resultado = JSON.parse(jsonLimpio)

    return normalizarResultado(resultado, viajes, texto, jsonLimpio)
  } catch (err) {
    console.error('Error en IA parser Gemini:', err.message)
    return crearResultadoFallback(texto, viajes)
  }
}

const normalizarResultado = (resultado, viajes, texto, procesadoPorIa) => {
  const viajeIds = new Set(viajes.map((v) => v.id))
  const paradas = viajes.flatMap((v) => v.paradas.map((p) => ({ ...p, viajeId: v.id })))
  const parada = paradas.find((p) => p.id === resultado.paradaId)
  const viajeId = viajeIds.has(resultado.viajeId) ? resultado.viajeId : null

  return {
    viajeId,
    tipo: TIPOS_REPORTE.has(resultado.tipo) ? resultado.tipo : inferirTipo(texto),
    ubicacion: resultado.ubicacion || extraerUbicacionFallback(texto),
    resumen: resultado.resumen || null,
    paradaId: parada && (!viajeId || parada.viajeId === viajeId) ? parada.id : null,
    estadoParada: ESTADOS_PARADA.has(resultado.estadoParada) ? resultado.estadoParada : null,
    procesadoPorIa,
  }
}

const crearResultadoFallback = (texto, viajes) => {
  const tipo = inferirTipo(texto)
  const viaje = inferirViajeFallback(texto, viajes, tipo)
  const parada = viaje ? inferirParadaFallback(texto, viaje, tipo) : null

  return {
    viajeId: viaje?.id || null,
    tipo,
    ubicacion: extraerUbicacionFallback(texto),
    resumen: null,
    paradaId: parada?.id || null,
    estadoParada: parada?.estadoParada || null,
    procesadoPorIa: null,
  }
}

const inferirTipo = (texto) => {
  const t = normalizar(texto)
  const regla = buscarReglaOperativa(t)
  if (regla) return regla.tipo

  if (/\b(cargando|cargue|carga|cargado)\b/.test(t) || t.includes('lista la carga') || t.includes('carga lista')) return 'CARGANDO'
  if (/\b(descargando|descargue|descargué|descargado|entregue|entregué|entregado)\b/.test(t)) return 'DESCARGADO'
  if (/\b(esperando|instrucciones|listo)\b/.test(t)) return 'ESPERANDO_INSTRUCCIONES'
  if (/\b(pernocta|descansando|posada|hotel|pare|paré)\b/.test(t)) return 'EN_PERNOCTA'
  if (/\b(libre|barquisimeto|sede)\b/.test(t)) return 'LIBRE'
  if (/\b(sali|salí|voy|ruta|viajando|carretera)\b/.test(t)) return 'EN_RUTA'

  return 'OTRO'
}

const inferirViajeFallback = (texto, viajes, tipo) => {
  if (viajes.length === 1) return viajes[0]

  const t = normalizar(texto)
  const porCodigo = viajes.find((v) => normalizar(v.codigo) && t.includes(normalizar(v.codigo)))
  if (porCodigo) return porCodigo

  const porCiudad = viajes.filter((v) =>
    v.paradas.some((p) => contieneLugar(t, p.ciudad) || contieneLugar(t, p.lugar))
  )
  if (porCiudad.length === 1) return porCiudad[0]

  if (tipo === 'CARGANDO') {
    const candidatos = viajes.filter((v) => proximaParadaPendiente(v)?.tipo === 'CARGA')
    if (candidatos.length === 1) return candidatos[0]
  }

  if (tipo === 'DESCARGADO') {
    const candidatos = viajes.filter((v) => v.paradas.some((p) => p.tipo === 'DESCARGA' && p.estado === 'EN_CURSO'))
    if (candidatos.length === 1) return candidatos[0]
  }

  return null
}

const inferirParadaFallback = (texto, viaje, tipo) => {
  const t = normalizar(texto)
  const regla = buscarReglaOperativa(t)

  if (tipo === 'CARGANDO') {
    const parada =
      buscarParadaPorTexto(viaje, t, 'CARGA') ||
      viaje.paradas.find((p) => p.tipo === 'CARGA' && p.estado === 'PENDIENTE')
    const estadoParada = regla?.estadoParada || (/\b(cargado|ya cargue)\b/.test(t) || t.includes('lista la carga') || t.includes('carga lista')
      ? 'COMPLETADA'
      : 'EN_CURSO')
    return parada ? { ...parada, estadoParada } : null
  }

  if (tipo === 'DESCARGADO') {
    const parada =
      buscarParadaPorTexto(viaje, t, 'DESCARGA') ||
      viaje.paradas.find((p) => p.tipo === 'DESCARGA' && p.estado === 'EN_CURSO')
    const estadoParada = regla?.estadoParada || (/\b(descargando|descarga en proceso)\b/.test(t) ? 'EN_CURSO' : 'COMPLETADA')
    return parada ? { ...parada, estadoParada } : null
  }

  return null
}

const buscarReglaOperativa = (textoNormalizado) =>
  REGLAS_OPERATIVAS.find((regla) =>
    regla.frases.some((frase) => textoNormalizado.includes(normalizar(frase)))
  )

const buscarParadaPorTexto = (viaje, textoNormalizado, tipo) =>
  viaje.paradas.find(
    (p) =>
      p.tipo === tipo &&
      (contieneLugar(textoNormalizado, p.ciudad) || contieneLugar(textoNormalizado, p.lugar))
  )

const proximaParadaPendiente = (viaje) =>
  viaje.paradas
    .slice()
    .sort((a, b) => a.orden - b.orden)
    .find((p) => p.estado === 'PENDIENTE')

const contieneLugar = (textoNormalizado, lugar) => {
  const lugarNormalizado = normalizar(lugar)
  return lugarNormalizado && textoNormalizado.includes(lugarNormalizado)
}

const normalizarMimeAudio = (mimeType = 'audio/ogg') => {
  const limpio = mimeType.split(';')[0].trim().toLowerCase()
  if (limpio === 'audio/opus') return 'audio/ogg'
  if (limpio === 'audio/mpeg') return 'audio/mp3'
  return limpio || 'audio/ogg'
}

const extraerUbicacionFallback = (texto) => {
  const ciudades = [
    'caracas',
    'valencia',
    'maracaibo',
    'barquisimeto',
    'maracay',
    'barcelona',
    'puerto la cruz',
    'maturin',
    'ciudad guayana',
    'san cristobal',
    'merida',
    'cumana',
    'la victoria',
    'cabrera',
    'guarenas',
    'guatire',
    'los teques',
    'cagua',
    'turmero',
    'acarigua',
    'punto fijo',
    'coro',
    'la guaira',
    'charallave',
  ]

  const textoLower = normalizar(texto)
  const regla = buscarReglaOperativa(textoLower)
  if (regla?.ubicacion) return regla.ubicacion
  for (const ciudad of ciudades) {
    if (textoLower.includes(ciudad)) {
      return ciudad
        .split(' ')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ')
    }
  }
  return null
}

module.exports = { parsearReporteChofer, transcribirAudio, inferirTipo, extraerUbicacionFallback }
