const prisma = require('../../config/database')
const { parsearReporteChofer } = require('./ia.parser')
const { normalizarTelefono } = require('../../utils/normalizarTelefono')
const gastosService = require('../../modules/gastos/gastos.service')

const COMANDOS = {
  MENU: ['menu', 'menú', 'ayuda', 'help', '0'],
  CARGANDO: ['1', 'cargando', 'cargue', 'cargué'],
  EN_RUTA: ['2', 'en ruta', 'saliendo', 'sali', 'salí', 'viajando'],
  DESCARGADO: ['3', 'descargando', 'descargue', 'descargué', 'descargado', 'entregue', 'entregué'],
  ESPERANDO: ['4', 'esperando', 'espero', 'listo'],
  PERNOCTA: ['5', 'pernocta', 'descansando', 'pare', 'paré'],
  GASTO: ['6', 'gasto', 'gaste', 'gasté', 'pague', 'pagué'],
}

const TEXTO_COMANDO = {
  CARGANDO: 'estoy cargando',
  EN_RUTA: 'estoy en ruta',
  DESCARGADO: 'ya descargue',
  ESPERANDO: 'estoy esperando instrucciones',
  PERNOCTA: 'estoy en pernocta',
}

const reportesPendientes = new Map()
const ventanasMensajes = new Map()

const TIMEOUT_REPORTE_MS = 10 * 60 * 1000
const VENTANA_MENSAJES_MS = 60 * 1000
const MAX_MENSAJES_POR_VENTANA = 20
const MAX_TEXTO_LENGTH = 2000

const permitirMensaje = (remoteJid) => {
  const ahora = Date.now()
  const ventana = ventanasMensajes.get(remoteJid)
  if (!ventana || ahora - ventana.inicio >= VENTANA_MENSAJES_MS) {
    ventanasMensajes.set(remoteJid, { inicio: ahora, cantidad: 1 })
    return true
  }
  if (ventana.cantidad >= MAX_MENSAJES_POR_VENTANA) return false
  ventana.cantidad += 1
  return true
}

const buscarChofer = async (remoteJid) => {
  let chofer = await prisma.chofer.findFirst({
    where: { whatsappChatId: remoteJid },
    include: includeChoferConViajes(),
  })

  if (chofer?.activo) return chofer

  if (remoteJid.endsWith('@s.whatsapp.net')) {
    const telefono = normalizarTelefono(remoteJid.replace('@s.whatsapp.net', '').split(':')[0])

    chofer = await prisma.chofer.findUnique({
      where: { telefono },
      include: includeChoferConViajes(),
    })

    if (chofer?.activo && !chofer.whatsappChatId) {
      await prisma.chofer.update({
        where: { id: chofer.id },
        data: { whatsappChatId: remoteJid },
      })
      console.log('[Vinculacion] Chofer auto-vinculado')
    }
  }

  return chofer
}

const includeChoferConViajes = () => ({
  viajes: {
    where: { estadoLogistico: 'EN_CURSO' },
    orderBy: { createdAt: 'asc' },
    include: {
      paradas: { orderBy: { orden: 'asc' } },
      camion: true,
    },
  },
})

const procesarMensajeChofer = async ({ remoteJid, texto, socketIO, enviarMensaje }) => {
  try {
    if (!permitirMensaje(remoteJid)) {
      await enviarMensaje(remoteJid, 'Has enviado demasiados mensajes. Espera un minuto e intenta nuevamente.')
      return
    }
    if (typeof texto !== 'string' || texto.length > MAX_TEXTO_LENGTH) {
      await enviarMensaje(remoteJid, 'El mensaje es demasiado largo. Envia un reporte mas breve.')
      return
    }

    texto = texto.trim()
    const textoLower = texto.toLowerCase().trim()

    const chofer = await buscarChofer(remoteJid)

    if (!chofer) {
      await enviarMensaje(
        remoteJid,
        [
          'Este numero de WhatsApp no coincide con ningun chofer activo.',
          'Contacta a operaciones para verificar el telefono registrado.',
        ].join('\n')
      )
      return
    }

    const reportePendiente = reportesPendientes.get(remoteJid)
    if (reportePendiente) {
      if (Date.now() - reportePendiente.timestamp > TIMEOUT_REPORTE_MS) {
        reportesPendientes.delete(remoteJid)
      } else if (/^\d+$/.test(textoLower)) {
        await confirmarReportePendiente({
          remoteJid,
          opcion: Number(textoLower),
          chofer,
          socketIO,
          enviarMensaje,
        })
        return
      }
    }

    if (esComando(textoLower, COMANDOS.MENU)) {
      reportesPendientes.delete(remoteJid)
      await enviarMenu(remoteJid, chofer.nombre, chofer.viajes, enviarMensaje)
      return
    }

    if (chofer.viajes.length === 0) {
      if (esReporteSede(textoLower) || esComando(textoLower, COMANDOS.ESPERANDO)) {
        await prisma.chofer.update({
          where: { id: chofer.id },
          data: {
            estado: 'DISPONIBLE',
            ubicacionActual: esReporteSede(textoLower) ? 'Sede Barquisimeto' : chofer.ubicacionActual,
            ultimoReporteAt: new Date(),
          },
        })
        await enviarMensaje(remoteJid, 'Disponibilidad actualizada. Operaciones ha sido notificado.')
        if (socketIO) {
          socketIO.emit('operaciones:alerta', {
            tipo: 'CHOFER_DISPONIBLE',
            mensaje: `${chofer.nombre} esta disponible${esReporteSede(textoLower) ? ' en sede Barquisimeto' : ''}.`,
          })
        }
        return
      }
      await enviarMensaje(
        remoteJid,
        `Hola ${chofer.nombre}, no tienes un viaje activo en este momento. Contacta a operaciones si hay algun error.`
      )
      return
    }

    if (esComando(textoLower, COMANDOS.GASTO)) {
      const gasto = parsearGasto(texto)
      if (!gasto) {
        await enviarInstruccionesGasto(remoteJid, enviarMensaje)
        return
      }

      if (chofer.viajes.length > 1) {
        reportesPendientes.set(remoteJid, {
          tipoPendiente: 'GASTO',
          gasto,
          viajes: chofer.viajes.map((viaje) => viaje.id),
          timestamp: Date.now(),
        })
        await enviarMensaje(remoteJid, construirPreguntaViaje(chofer.viajes))
        return
      }

      await guardarGastoChofer({
        remoteJid,
        chofer,
        viaje: chofer.viajes[0],
        gasto,
        socketIO,
        enviarMensaje,
      })
      return
    }

    const textoParaIa = textoSemantico(textoLower) || texto

    await procesarReporte({
      remoteJid,
      chofer,
      textoOriginal: texto,
      textoParaIa,
      socketIO,
      enviarMensaje,
    })
  } catch (err) {
    console.error('Error procesando mensaje de chofer:', {
      name: err.name,
      code: err.code,
      message: process.env.NODE_ENV === 'production' ? undefined : err.message
    })
  }
}

const procesarReporte = async ({
  remoteJid,
  chofer,
  textoOriginal,
  textoParaIa,
  socketIO,
  enviarMensaje,
  viajeForzadoId = null,
}) => {
  const resultado = await parsearReporteChofer(textoParaIa, chofer.viajes, chofer.ubicacionActual)
  const reporteSede = esReporteSede(textoOriginal)
  if (reporteSede) {
    resultado.tipo = 'LIBRE'
    resultado.ubicacion = 'Sede Barquisimeto'
    resultado.resumen = 'Chofer disponible en sede Barquisimeto'
  }
  const viajeId = viajeForzadoId || resultado.viajeId
  const viaje = chofer.viajes.find((v) => v.id === viajeId)

  if (!viaje) {
    reportesPendientes.set(remoteJid, {
      textoOriginal,
      textoParaIa,
      viajes: chofer.viajes.map((v) => v.id),
      timestamp: Date.now(),
    })
    await enviarMensaje(remoteJid, construirPreguntaViaje(chofer.viajes))
    return
  }

  const paradaInferida = inferirParadaOperativa(resultado, viaje, textoOriginal)
  const paradaValida = viaje.paradas.find((p) => p.id === (resultado.paradaId || paradaInferida?.id))
  const paradaId = paradaValida ? paradaValida.id : null
  const estadoParada = paradaId ? (resultado.estadoParada || paradaInferida?.estadoParada) : null
  const ubicacion = normalizarUbicacionEspecial(resultado.tipo, resultado.ubicacion)

  const { reporte, viajesCompletados, viajesPendientesLiquidacion } = await prisma.$transaction(async (tx) => {
    if (paradaId && estadoParada) {
      await tx.parada.update({
        where: { id: paradaId },
        data: {
          estado: estadoParada,
          completadaAt: estadoParada === 'COMPLETADA' ? new Date() : undefined,
        },
      })
    }

    const reporte = await tx.reporteChofer.create({
      data: {
        viajeId: viaje.id,
        choferId: chofer.id,
        paradaId,
        mensajeOriginal: textoOriginal,
        tipoReporte: resultado.tipo,
        ubicacion,
        procesadoPorIa: resultado.procesadoPorIa || resultado.resumen,
      },
    })

    let viajesCompletados = []
    if (resultado.tipo === 'ESPERANDO_INSTRUCCIONES') {
      const paradasPendientes = await tx.parada.count({
        where: { viajeId: viaje.id, estado: { not: 'COMPLETADA' } },
      })
      if (paradasPendientes === 0) {
        await tx.viaje.update({
          where: { id: viaje.id },
          data: { estadoLogistico: 'COMPLETADO', fechaCierre: new Date() },
        })
        viajesCompletados = [viaje.id]
      }
    }

    if (resultado.tipo === 'LIBRE') {
      const ids = chofer.viajes.map((viajeActivo) => viajeActivo.id)
      await tx.parada.updateMany({
        where: { viajeId: { in: ids }, estado: { not: 'COMPLETADA' } },
        data: { estado: 'COMPLETADA', completadaAt: new Date() },
      })
      await tx.viaje.updateMany({
        where: { id: { in: ids } },
        data: { estadoLogistico: 'COMPLETADO', fechaCierre: new Date() },
      })
      viajesCompletados = ids
    }

    const viajesActualizados = await tx.viaje.findMany({
      where: { choferId: chofer.id, estadoLogistico: 'EN_CURSO' },
      include: { paradas: true },
    })

    if (viajesActualizados.length > 0 && viajesActualizados.every((v) => v.paradas.every((p) => p.estado === 'COMPLETADA'))) {
      await tx.viaje.updateMany({
        where: { id: { in: viajesActualizados.map((v) => v.id) } },
        data: { estadoLogistico: 'COMPLETADO', fechaCierre: new Date() },
      })
      viajesCompletados = [...new Set([...viajesCompletados, ...viajesActualizados.map((v) => v.id)])]
    }

    const dataChofer = {
      ubicacionActual: ubicacion || chofer.ubicacionActual,
      ultimoReporteAt: new Date(),
    }
    const [viajesChoferRestantes, viajesCamionRestantes] = await Promise.all([
      tx.viaje.count({ where: { choferId: chofer.id, estadoLogistico: 'EN_CURSO' } }),
      tx.viaje.count({ where: { camionId: viaje.camionId, estadoLogistico: 'EN_CURSO' } }),
    ])

    if (resultado.tipo === 'LIBRE' || resultado.tipo === 'ESPERANDO_INSTRUCCIONES' || viajesChoferRestantes === 0) {
      dataChofer.estado = 'DISPONIBLE'
      if (resultado.tipo === 'LIBRE') dataChofer.ubicacionActual = ubicacion || 'Sede Barquisimeto'
    }

    await tx.chofer.update({
      where: { id: chofer.id },
      data: dataChofer,
    })

    await tx.camion.update({
      where: { id: viaje.camionId },
      data: {
        ubicacionActual: ubicacion || chofer.ubicacionActual,
        estado:
          resultado.tipo === 'LIBRE' || resultado.tipo === 'ESPERANDO_INSTRUCCIONES' || viajesCamionRestantes === 0
            ? 'DISPONIBLE'
            : undefined,
      },
    })

    const viajesPendientesLiquidacion =
      resultado.tipo === 'LIBRE'
        ? await tx.viaje.count({
            where: {
              choferId: chofer.id,
              estadoLogistico: 'COMPLETADO',
              estadoFinanciero: 'PENDIENTE',
            },
          })
        : 0

    return { reporte, viajesCompletados, viajesPendientesLiquidacion }
  })

  reportesPendientes.delete(remoteJid)

  await enviarMensaje(remoteJid, construirRespuestaReporte(resultado, viaje, ubicacion))

  if (socketIO) {
    socketIO.emit('reporte:nuevo', {
      reporte,
      chofer: { id: chofer.id, nombre: chofer.nombre, telefono: chofer.telefono },
      viaje: { codigo: viaje.codigo, id: viaje.id },
      parada: paradaValida ? { id: paradaValida.id, estado: estadoParada } : null,
      mensaje: `${chofer.nombre}: ${resultado.resumen || textoOriginal}`,
    })

    if (resultado.tipo === 'ESPERANDO_INSTRUCCIONES') {
      socketIO.emit('operaciones:alerta', {
        tipo: viajesCompletados.length > 0 ? 'VIAJES_COMPLETADOS' : 'CHOFER_ESPERA_INSTRUCCIONES',
        chofer: { id: chofer.id, nombre: chofer.nombre },
        ubicacion,
        viajesCompletados,
      })
    }

    if (resultado.tipo === 'LIBRE') {
      socketIO.emit('operaciones:alerta', {
        tipo: 'CHOFER_LIBRE',
        mensaje: `Chofer ${chofer.nombre} llego a sede. Viajes pendientes de liquidacion: ${viajesPendientesLiquidacion}`,
        chofer: { id: chofer.id, nombre: chofer.nombre },
        ubicacion: ubicacion || 'Barquisimeto',
        viajesPendientesLiquidacion,
      })
    }
  }
}

const confirmarReportePendiente = async ({ remoteJid, opcion, chofer, socketIO, enviarMensaje }) => {
  const pendiente = reportesPendientes.get(remoteJid)
  const viaje = chofer.viajes[opcion - 1]

  if (!pendiente || !viaje || !pendiente.viajes.includes(viaje.id)) {
    await enviarMensaje(remoteJid, construirPreguntaViaje(chofer.viajes))
    return
  }

  if (pendiente.tipoPendiente === 'GASTO') {
    await guardarGastoChofer({
      remoteJid,
      chofer,
      viaje,
      gasto: pendiente.gasto,
      socketIO,
      enviarMensaje,
    })
    return
  }

  await procesarReporte({
    remoteJid,
    chofer,
    textoOriginal: pendiente.textoOriginal,
    textoParaIa: pendiente.textoParaIa,
    socketIO,
    enviarMensaje,
    viajeForzadoId: viaje.id,
  })
}

const guardarGastoChofer = async ({ remoteJid, chofer, viaje, gasto, socketIO, enviarMensaje }) => {
  const creado = await gastosService.crear(
    {
      viajeId: viaje.id,
      tipo: gasto.tipo,
      monto: gasto.monto,
      descripcion: gasto.descripcion,
    },
    'CHOFER'
  )

  reportesPendientes.delete(remoteJid)
  await enviarMensaje(remoteJid, `Gasto registrado: ${gasto.tipo} $${gasto.monto}\nViaje: ${viaje.codigo}`)

  if (socketIO) {
    socketIO.emit('gasto:nuevo', {
      gasto: creado,
      chofer: { id: chofer.id, nombre: chofer.nombre },
      viaje: { id: viaje.id, codigo: viaje.codigo },
    })
  }
}

const esComando = (texto, lista) => lista.some((cmd) => texto === cmd || texto.startsWith(cmd + ' '))

const textoSemantico = (textoLower) => {
  if (esReporteSede(textoLower)) return 'estoy libre en sede Barquisimeto Transporte San Roman'
  if (esComando(textoLower, COMANDOS.CARGANDO)) return TEXTO_COMANDO.CARGANDO
  if (esComando(textoLower, COMANDOS.EN_RUTA)) return TEXTO_COMANDO.EN_RUTA
  if (textoLower === 'descargando' || textoLower.startsWith('descargando ')) return textoLower
  if (esComando(textoLower, COMANDOS.DESCARGADO)) return TEXTO_COMANDO.DESCARGADO
  if (esComando(textoLower, COMANDOS.ESPERANDO)) return TEXTO_COMANDO.ESPERANDO
  if (esComando(textoLower, COMANDOS.PERNOCTA)) return TEXTO_COMANDO.PERNOCTA
  return null
}

const esReporteSede = (texto) => {
  const normalizado = texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

  return (
    /\btsr\b/.test(normalizado) ||
    normalizado.includes('transporte san roman') ||
    normalizado.includes('transporte san román')
  )
}

const parsearGasto = (texto) => {
  const partes = texto.trim().split(/\s+/)
  if (partes.length < 3 || partes[0].toLowerCase() !== 'gasto') return null

  const tipos = {
    gasolina: 'COMBUSTIBLE',
    combustible: 'COMBUSTIBLE',
    peaje: 'PEAJE',
    comida: 'COMIDA',
    hospedaje: 'HOSPEDAJE',
    hotel: 'HOSPEDAJE',
    reparacion: 'REPARACION',
    reparación: 'REPARACION',
    otro: 'OTRO',
  }
  const tipo = tipos[partes[1].toLowerCase()]
  const monto = Number(partes[2].replace(',', '.'))
  if (!tipo || !Number.isFinite(monto) || monto <= 0) return null

  return {
    tipo,
    monto,
    descripcion: partes.slice(3).join(' ') || null,
  }
}

const inferirParadaOperativa = (resultado, viaje, texto) => {
  const normalizado = texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  if (resultado.tipo === 'CARGANDO') {
    const parada = viaje.paradas.find((p) => p.tipo === 'CARGA' && p.estado !== 'COMPLETADA')
    return parada ? { ...parada, estadoParada: 'EN_CURSO' } : null
  }
  if (resultado.tipo === 'DESCARGADO') {
    const parada = viaje.paradas.find((p) => p.tipo === 'DESCARGA' && p.estado !== 'COMPLETADA')
    const estadoParada = normalizado.includes('descargando') ? 'EN_CURSO' : 'COMPLETADA'
    return parada ? { ...parada, estadoParada } : null
  }
  return null
}

const construirPreguntaViaje = (viajes) => {
  const opciones = viajes.map((v, index) => {
    const primera = v.paradas[0]
    const ultima = v.paradas[v.paradas.length - 1]
    const ruta = primera && ultima ? `${primera.ciudad} -> ${ultima.ciudad}` : 'Ruta sin paradas'
    return `${index + 1} - ${v.codigo}: ${ruta}`
  })

  return [
    'Tengo varios viajes activos para ti. A cual te refieres?',
    ...opciones,
    'Responde con el numero.',
  ].join('\n')
}

const construirRespuestaReporte = (resultado, viaje, ubicacion) => {
  const ubicacionTexto = ubicacion ? `\nUbicacion: ${ubicacion}` : ''
  return [
    'Reporte recibido.',
    resultado.resumen || 'Mensaje procesado.',
    `Viaje: ${viaje.codigo}${ubicacionTexto}`,
  ].join('\n')
}

const normalizarUbicacionEspecial = (tipo, ubicacion) => {
  if (tipo === 'LIBRE') return ubicacion || 'Sede Barquisimeto'
  return ubicacion
}

const enviarMenu = async (remoteJid, nombre, viajesActivos, enviarMensaje) => {
  const estadoViaje =
    viajesActivos.length > 0
      ? `Viajes activos: ${viajesActivos.map((v) => v.codigo).join(', ')}`
      : 'Sin viaje activo'

  const menu = [
    `Hola ${nombre}`,
    estadoViaje,
    '',
    'Reportes rapidos:',
    '1 - Cargando',
    '2 - En ruta',
    '3 - Descargado',
    '4 - Esperando instrucciones',
    '5 - En pernocta',
    '6 - Registrar gasto',
    '',
    'Tambien puedes escribir tu reporte libremente y lo procesamos automaticamente.',
  ].join('\n')

  await enviarMensaje(remoteJid, menu)
}

const enviarInstruccionesGasto = async (remoteJid, enviarMensaje) => {
  const instrucciones = [
    'Registrar gasto',
    '',
    'Escribe tu gasto asi:',
    'gasto [tipo] [monto] [descripcion]',
    '',
    'Ejemplos:',
    'gasto peaje 5 peaje autopista regional',
    'gasto gasolina 50 llene en Valencia',
    'gasto comida 10 almuerzo en Maracay',
    '',
    'Tipos validos: gasolina, peaje, comida, hospedaje, otro',
  ].join('\n')

  await enviarMensaje(remoteJid, instrucciones)
}

module.exports = { procesarMensajeChofer }
