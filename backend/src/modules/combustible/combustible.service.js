const prisma = require('../../config/database')

const TIPOS_EVENTO = new Set(['RECARGA_TRANSPORTE', 'RECARGA_ESTACION', 'TRANSFERENCIA_SALIDA', 'TRANSFERENCIA_ENTRADA'])
const TIPOS_TRANSFERIBLES = new Set(['TRANSFERENCIA_SALIDA', 'TRANSFERENCIA_ENTRADA'])
const MONEDAS = new Set(['VES', 'USD'])

const tanqueConPuntosSelect = {
  id: true,
  numero: true,
  capacidadLitros: true,
  puntosCalibracion: { orderBy: { alturaCm: 'asc' }, select: { alturaCm: true, litros: true } }
}

const controlIncludeBasico = {
  camion: { select: { id: true, placa: true, tipoVehiculo: true, marcaModelo: true } },
  chofer: { select: { id: true, nombre: true } },
  viaje: { select: { id: true, codigo: true } },
  eventos: { orderBy: { createdAt: 'desc' } }
}

// --- Configuracion por unidad -------------------------------------------------

const obtenerConfiguracion = async (camionId) => {
  await prisma.camion.findUniqueOrThrow({ where: { id: camionId } })
  return prisma.configuracionCombustibleCamion.findUnique({
    where: { camionId },
    select: {
      id: true,
      camionId: true,
      umbralOptimoKmLitro: true,
      umbralDeficienteKmLitro: true,
      tanques: { orderBy: { numero: 'asc' }, select: tanqueConPuntosSelect }
    }
  })
}

const validarTanques = (tanques) => {
  if (!Array.isArray(tanques) || tanques.length < 1 || tanques.length > 2) {
    throw { status: 400, message: 'Debes configurar 1 o 2 tanques' }
  }
  const numeros = new Set()
  return tanques.map((tanque) => {
    const numero = Number(tanque.numero)
    if (![1, 2].includes(numero) || numeros.has(numero)) {
      throw { status: 400, message: 'Numero de tanque invalido o repetido' }
    }
    numeros.add(numero)

    const capacidadLitros = Number(tanque.capacidadLitros)
    if (!Number.isFinite(capacidadLitros) || capacidadLitros <= 0) {
      throw { status: 400, message: 'Capacidad de tanque invalida' }
    }

    const puntos = Array.isArray(tanque.puntosCalibracion) ? tanque.puntosCalibracion : []
    if (puntos.length < 2) {
      throw { status: 400, message: `El tanque ${numero} necesita al menos 2 puntos de calibracion` }
    }
    const alturasVistas = new Set()
    const puntosNormalizados = puntos.map((punto) => {
      const alturaCm = Number(punto.alturaCm)
      const litros = Number(punto.litros)
      if (!Number.isFinite(alturaCm) || alturaCm < 0 || !Number.isFinite(litros) || litros < 0) {
        throw { status: 400, message: `Punto de calibracion invalido en tanque ${numero}` }
      }
      if (alturasVistas.has(alturaCm)) {
        throw { status: 400, message: `Altura de calibracion repetida en tanque ${numero}` }
      }
      alturasVistas.add(alturaCm)
      return { alturaCm, litros }
    }).sort((a, b) => a.alturaCm - b.alturaCm)

    return { numero, capacidadLitros, puntosCalibracion: puntosNormalizados }
  })
}

const validarUmbrales = (umbralOptimoKmLitro, umbralDeficienteKmLitro) => {
  const optimo = Number(umbralOptimoKmLitro)
  const deficiente = Number(umbralDeficienteKmLitro)
  if (!Number.isFinite(optimo) || optimo <= 0 || !Number.isFinite(deficiente) || deficiente <= 0) {
    throw { status: 400, message: 'Umbrales de rendimiento invalidos' }
  }
  if (deficiente >= optimo) {
    throw { status: 400, message: 'El umbral deficiente debe ser menor al optimo' }
  }
  return { optimo, deficiente }
}

const guardarConfiguracion = async (camionId, datos) => {
  await prisma.camion.findUniqueOrThrow({ where: { id: camionId } })
  const tanques = validarTanques(datos.tanques)
  const { optimo, deficiente } = validarUmbrales(datos.umbralOptimoKmLitro, datos.umbralDeficienteKmLitro)

  return prisma.$transaction(async (tx) => {
    const configuracion = await tx.configuracionCombustibleCamion.upsert({
      where: { camionId },
      create: { camionId, umbralOptimoKmLitro: optimo, umbralDeficienteKmLitro: deficiente },
      update: { umbralOptimoKmLitro: optimo, umbralDeficienteKmLitro: deficiente }
    })

    // Reemplaza el set completo de tanques/puntos: mas simple y confiable que
    // intentar diffear filas sueltas, y la configuracion se edita con poca
    // frecuencia (no es un historial, es "la ficha vigente" de la unidad).
    await tx.tanqueCombustible.deleteMany({ where: { configuracionId: configuracion.id } })
    for (const tanque of tanques) {
      await tx.tanqueCombustible.create({
        data: {
          configuracionId: configuracion.id,
          numero: tanque.numero,
          capacidadLitros: tanque.capacidadLitros,
          puntosCalibracion: { create: tanque.puntosCalibracion }
        }
      })
    }

    return tx.configuracionCombustibleCamion.findUniqueOrThrow({
      where: { id: configuracion.id },
      select: {
        id: true,
        camionId: true,
        umbralOptimoKmLitro: true,
        umbralDeficienteKmLitro: true,
        tanques: { orderBy: { numero: 'asc' }, select: tanqueConPuntosSelect }
      }
    })
  })
}

// --- Conversion cm -> litros ---------------------------------------------------

const interpolarLitros = (tanque, alturaCm) => {
  const puntos = tanque.puntosCalibracion
  const altura = Number(alturaCm)
  if (!Number.isFinite(altura) || altura < 0) {
    throw { status: 400, message: `Lectura de varilla invalida en tanque ${tanque.numero}` }
  }
  if (altura <= puntos[0].alturaCm) {
    return { litros: puntos[0].litros, fueraDeRango: altura < puntos[0].alturaCm }
  }
  const ultimo = puntos[puntos.length - 1]
  if (altura >= ultimo.alturaCm) {
    return { litros: ultimo.litros, fueraDeRango: altura > ultimo.alturaCm }
  }
  for (let i = 0; i < puntos.length - 1; i += 1) {
    const inferior = puntos[i]
    const superior = puntos[i + 1]
    if (altura >= inferior.alturaCm && altura <= superior.alturaCm) {
      const rango = superior.alturaCm - inferior.alturaCm
      const proporcion = rango === 0 ? 0 : (altura - inferior.alturaCm) / rango
      const litros = inferior.litros + proporcion * (superior.litros - inferior.litros)
      return { litros, fueraDeRango: false }
    }
  }
  return { litros: ultimo.litros, fueraDeRango: true }
}

const calcularLecturas = (tanques, lecturas) => {
  if (!Array.isArray(lecturas) || lecturas.length === 0) {
    throw { status: 400, message: 'Debes indicar la lectura de al menos un tanque' }
  }
  const tanquesPorNumero = new Map(tanques.map((tanque) => [tanque.numero, tanque]))
  let litrosTotal = 0
  const detalle = lecturas.map((lectura) => {
    const numero = Number(lectura.numero)
    const tanque = tanquesPorNumero.get(numero)
    if (!tanque) throw { status: 400, message: `La unidad no tiene configurado el tanque ${numero}` }
    const { litros, fueraDeRango } = interpolarLitros(tanque, lectura.alturaCm)
    litrosTotal += litros
    return { numero, alturaCm: Number(lectura.alturaCm), litros, fueraDeRango }
  })
  return { detalle, litrosTotal }
}

// --- Controles ------------------------------------------------------------------

const requerirConfiguracionConTanques = async (camionId) => {
  const configuracion = await prisma.configuracionCombustibleCamion.findUnique({
    where: { camionId },
    select: {
      umbralOptimoKmLitro: true,
      umbralDeficienteKmLitro: true,
      tanques: { orderBy: { numero: 'asc' }, select: tanqueConPuntosSelect }
    }
  })
  if (!configuracion || configuracion.tanques.length === 0) {
    throw { status: 409, message: 'Esta unidad no tiene configurado el combustible (tanques/calibracion). Pide a un administrador que la configure primero.' }
  }
  return configuracion
}

const calcularAdvertenciaNivel = async (camionId, tanques, litrosNuevoInicio) => {
  const ultimoCerrado = await prisma.controlCombustible.findFirst({
    where: { camionId, estado: 'CERRADO', litrosFinalesTotal: { not: null } },
    orderBy: { cerradoAt: 'desc' },
    select: { litrosFinalesTotal: true, cerradoAt: true }
  })
  if (!ultimoCerrado) return null

  const capacidadTotal = tanques.reduce((total, tanque) => total + tanque.capacidadLitros, 0)
  const tolerancia = Math.max(5, capacidadTotal * 0.03)
  const diferencia = litrosNuevoInicio - ultimoCerrado.litrosFinalesTotal
  if (diferencia >= -tolerancia) return null

  return {
    litrosUltimoCierre: ultimoCerrado.litrosFinalesTotal,
    litrosAhora: litrosNuevoInicio,
    diferencia,
    mensaje: `El ultimo cierre de esta unidad termino con ${ultimoCerrado.litrosFinalesTotal.toFixed(1)} L y ahora abre con ${litrosNuevoInicio.toFixed(1)} L (${diferencia.toFixed(1)} L), sin una recarga que lo explique. Verifica la lectura o si falta combustible.`
  }
}

const abrirControl = async ({ viajeId = null, camionId, choferId = null, odometroInicial, lecturas, creadoPorId = null }) => {
  const camion = await prisma.camion.findUniqueOrThrow({ where: { id: camionId } })
  const configuracion = await requerirConfiguracionConTanques(camionId)

  const abierto = await prisma.controlCombustible.findFirst({ where: { camionId, estado: 'ABIERTO' } })
  if (abierto) throw { status: 409, message: `La unidad ${camion.placa} ya tiene un control de combustible abierto` }

  const odometro = Number(odometroInicial)
  if (!Number.isFinite(odometro) || odometro < 0) {
    throw { status: 400, message: 'Odometro inicial invalido' }
  }

  const { detalle, litrosTotal } = calcularLecturas(configuracion.tanques, lecturas)

  const control = await prisma.controlCombustible.create({
    data: {
      viajeId,
      camionId,
      choferId,
      odometroInicial: odometro,
      lecturasInicialesTanques: detalle,
      litrosInicialesTotal: litrosTotal,
      creadoPorId
    },
    include: controlIncludeBasico
  })

  // Aviso de un solo momento (no se guarda en la base): compara contra el
  // cierre del ultimo control de esta misma unidad. Si el nivel bajo sin
  // que haya una recarga/transferencia que lo explique, puede ser una mala
  // lectura o combustible que falta.
  const advertenciaNivel = await calcularAdvertenciaNivel(camionId, configuracion.tanques, litrosTotal)

  return { ...control, advertenciaNivel }
}

const normalizarCosto = (costo, moneda) => {
  if (costo === undefined || costo === null || costo === '') return { costo: null, moneda: null }
  const monto = Number(costo)
  if (!Number.isFinite(monto) || monto < 0) throw { status: 400, message: 'Costo invalido' }
  const monedaNormalizada = String(moneda || 'VES').trim().toUpperCase()
  if (!MONEDAS.has(monedaNormalizada)) throw { status: 400, message: 'Moneda invalida' }
  return { costo: monto, moneda: monedaNormalizada }
}

const registrarEvento = async (controlId, datos, registradoPorId = null) => {
  const tipo = datos.tipo
  if (!TIPOS_EVENTO.has(tipo)) throw { status: 400, message: 'Tipo de evento invalido' }

  const litros = Number(datos.litros)
  if (!Number.isFinite(litros) || litros <= 0) throw { status: 400, message: 'Litros invalidos' }

  const { costo, moneda } = normalizarCosto(datos.costo, datos.moneda)
  const ubicacion = datos.ubicacion?.trim() || null
  const observacion = datos.observacion?.trim() || null

  const control = await prisma.controlCombustible.findUniqueOrThrow({ where: { id: controlId } })
  if (control.estado !== 'ABIERTO') throw { status: 409, message: 'Este control de combustible ya esta cerrado' }

  if (tipo !== 'TRANSFERENCIA_SALIDA') {
    return prisma.eventoCombustible.create({
      data: { controlCombustibleId: controlId, tipo, litros, costo, moneda, ubicacion, observacion, registradoPorId },
      include: { controlCombustible: { select: { camionId: true } } }
    })
  }

  // Transferencia hacia otra unidad: exige que el destino tenga su propio
  // control abierto y crea el evento espejo (ENTRADA) alla, para que el
  // historico de ambas unidades quede completo.
  const camionDestinoId = datos.camionDestinoId
  if (!camionDestinoId) throw { status: 400, message: 'Indica la unidad destino de la transferencia' }
  if (camionDestinoId === control.camionId) throw { status: 400, message: 'La unidad destino no puede ser la misma que origina la transferencia' }

  const controlDestino = await prisma.controlCombustible.findFirst({ where: { camionId: camionDestinoId, estado: 'ABIERTO' } })
  if (!controlDestino) throw { status: 409, message: 'La unidad destino no tiene un control de combustible abierto' }

  return prisma.$transaction(async (tx) => {
    const salida = await tx.eventoCombustible.create({
      data: { controlCombustibleId: controlId, tipo: 'TRANSFERENCIA_SALIDA', litros, costo, moneda, ubicacion, observacion, registradoPorId }
    })
    const entrada = await tx.eventoCombustible.create({
      data: {
        controlCombustibleId: controlDestino.id,
        tipo: 'TRANSFERENCIA_ENTRADA',
        litros,
        ubicacion,
        observacion: observacion || `Transferencia recibida desde otra unidad`,
        registradoPorId,
        eventoVinculadoId: salida.id
      }
    })
    const salidaEnlazada = await tx.eventoCombustible.update({
      where: { id: salida.id },
      data: { eventoVinculadoId: entrada.id },
      include: { controlCombustible: { select: { camionId: true } } }
    })
    return salidaEnlazada
  })
}

const eliminarEvento = async (controlId, eventoId) => {
  const evento = await prisma.eventoCombustible.findUniqueOrThrow({ where: { id: eventoId } })
  if (evento.controlCombustibleId !== controlId) throw { status: 404, message: 'El evento no pertenece a este control' }

  await prisma.$transaction(async (tx) => {
    if (evento.eventoVinculadoId) await tx.eventoCombustible.delete({ where: { id: evento.eventoVinculadoId } }).catch(() => {})
    await tx.eventoCombustible.delete({ where: { id: eventoId } })
  })

  const control = await prisma.controlCombustible.findUnique({ where: { id: controlId } })
  if (control && control.estado === 'CERRADO') await recalcularCierre(controlId)
}

const sumarEventos = (eventos) => eventos.reduce((totales, evento) => {
  if (evento.tipo === 'RECARGA_TRANSPORTE' || evento.tipo === 'RECARGA_ESTACION') totales.recargas += evento.litros
  if (evento.tipo === 'TRANSFERENCIA_ENTRADA') totales.transferenciasEntrada += evento.litros
  if (evento.tipo === 'TRANSFERENCIA_SALIDA') totales.transferenciasSalida += evento.litros
  return totales
}, { recargas: 0, transferenciasEntrada: 0, transferenciasSalida: 0 })

const clasificarRendimiento = (rendimiento, configuracion) => {
  if (rendimiento === null) return null
  if (rendimiento >= configuracion.umbralOptimoKmLitro) return 'OPTIMO'
  if (rendimiento >= configuracion.umbralDeficienteKmLitro) return 'DEFICIENTE'
  return 'CRITICO'
}

const calcularCierre = (control, tanques, configuracion, lecturas, odometroFinalInput) => {
  const odometroFinal = Number(odometroFinalInput)
  if (!Number.isFinite(odometroFinal)) throw { status: 400, message: 'Odometro final invalido' }
  if (odometroFinal <= control.odometroInicial) {
    throw { status: 400, message: 'El odometro final debe ser mayor al inicial' }
  }

  const { detalle, litrosTotal } = calcularLecturas(tanques, lecturas)
  const kmRecorridos = odometroFinal - control.odometroInicial
  const totales = sumarEventos(control.eventos)
  const consumoNetoLitros = control.litrosInicialesTotal + totales.recargas + totales.transferenciasEntrada - totales.transferenciasSalida - litrosTotal
  const rendimientoKmLitro = consumoNetoLitros > 0 ? kmRecorridos / consumoNetoLitros : null
  const clasificacion = clasificarRendimiento(rendimientoKmLitro, configuracion)

  return { odometroFinal, lecturasFinalesTanques: detalle, litrosFinalesTotal: litrosTotal, kmRecorridos, consumoNetoLitros, rendimientoKmLitro, clasificacion }
}

const cerrarControl = async (controlId, { odometroFinal, lecturas }, cerradoPorId = null) => {
  const control = await prisma.controlCombustible.findUniqueOrThrow({
    where: { id: controlId },
    include: { eventos: true }
  })
  if (control.estado !== 'ABIERTO') throw { status: 409, message: 'Este control de combustible ya esta cerrado' }

  const configuracion = await requerirConfiguracionConTanques(control.camionId)
  const calculo = calcularCierre(control, configuracion.tanques, configuracion, lecturas, odometroFinal)

  return prisma.controlCombustible.update({
    where: { id: controlId },
    data: { ...calculo, estado: 'CERRADO', cerradoPorId, cerradoAt: new Date() },
    include: controlIncludeBasico
  })
}

// Recalcula un control ya cerrado (ej. tras editar lecturas o borrar un evento con error).
const recalcularCierre = async (controlId) => {
  const control = await prisma.controlCombustible.findUniqueOrThrow({ where: { id: controlId }, include: { eventos: true } })
  if (control.estado !== 'CERRADO' || !control.lecturasFinalesTanques) return control
  const config = await prisma.configuracionCombustibleCamion.findUniqueOrThrow({ where: { camionId: control.camionId } })

  const kmRecorridos = control.odometroFinal - control.odometroInicial
  const totales = sumarEventos(control.eventos)
  const consumoNetoLitros = control.litrosInicialesTotal + totales.recargas + totales.transferenciasEntrada - totales.transferenciasSalida - control.litrosFinalesTotal
  const rendimientoKmLitro = consumoNetoLitros > 0 ? kmRecorridos / consumoNetoLitros : null
  const clasificacion = clasificarRendimiento(rendimientoKmLitro, config)

  return prisma.controlCombustible.update({
    where: { id: controlId },
    data: { kmRecorridos, consumoNetoLitros, rendimientoKmLitro, clasificacion },
    include: controlIncludeBasico
  })
}

// Edicion/correccion administrativa de un control (odometro y/o lecturas, abierto o cerrado).
const editarControl = async (controlId, datos) => {
  const control = await prisma.controlCombustible.findUniqueOrThrow({ where: { id: controlId } })
  const configuracion = await requerirConfiguracionConTanques(control.camionId)

  const data = {}
  if (datos.odometroInicial !== undefined) {
    const valor = Number(datos.odometroInicial)
    if (!Number.isFinite(valor) || valor < 0) throw { status: 400, message: 'Odometro inicial invalido' }
    data.odometroInicial = valor
  }
  if (datos.lecturasIniciales !== undefined) {
    const { detalle, litrosTotal } = calcularLecturas(configuracion.tanques, datos.lecturasIniciales)
    data.lecturasInicialesTanques = detalle
    data.litrosInicialesTotal = litrosTotal
  }
  if (datos.odometroFinal !== undefined) {
    const valor = Number(datos.odometroFinal)
    if (!Number.isFinite(valor) || valor < 0) throw { status: 400, message: 'Odometro final invalido' }
    data.odometroFinal = valor
  }
  if (datos.lecturasFinales !== undefined) {
    const { detalle, litrosTotal } = calcularLecturas(configuracion.tanques, datos.lecturasFinales)
    data.lecturasFinalesTanques = detalle
    data.litrosFinalesTotal = litrosTotal
  }

  if (Object.keys(data).length === 0) throw { status: 400, message: 'No hay cambios para guardar' }

  await prisma.controlCombustible.update({ where: { id: controlId }, data })
  return recalcularCierre(controlId)
}

// --- Consultas --------------------------------------------------------------

const listarControles = async ({ camionId, choferId, viajeId, estado, clasificacion, page = 1, pageSize = 20 } = {}) => {
  const where = {}
  if (camionId) where.camionId = camionId
  if (choferId) where.choferId = choferId
  if (viajeId) where.viajeId = viajeId
  if (estado) where.estado = estado
  if (clasificacion) where.clasificacion = clasificacion

  const take = Math.min(Math.max(Number(pageSize) || 20, 1), 100)
  const skip = (Math.max(Number(page) || 1, 1) - 1) * take

  const [items, total] = await Promise.all([
    prisma.controlCombustible.findMany({
      where,
      include: controlIncludeBasico,
      orderBy: { createdAt: 'desc' },
      take,
      skip
    }),
    prisma.controlCombustible.count({ where })
  ])

  return { items, total, page: Math.max(Number(page) || 1, 1), pageSize: take }
}

const obtenerControl = async (id) => {
  return prisma.controlCombustible.findUniqueOrThrow({ where: { id }, include: controlIncludeBasico })
}

const obtenerMisControlesAbiertos = async (choferId) => {
  return prisma.controlCombustible.findMany({
    where: { choferId, estado: 'ABIERTO' },
    include: controlIncludeBasico,
    orderBy: { createdAt: 'desc' }
  })
}

const obtenerResumen = async ({ camionId, choferId } = {}) => {
  const where = { estado: 'CERRADO', rendimientoKmLitro: { not: null } }
  if (camionId) where.camionId = camionId
  if (choferId) where.choferId = choferId

  const cerrados = await prisma.controlCombustible.findMany({
    where,
    select: { camionId: true, choferId: true, rendimientoKmLitro: true, litrosInicialesTotal: true, litrosFinalesTotal: true, clasificacion: true, camion: { select: { placa: true } }, chofer: { select: { nombre: true } } }
  })

  const agrupar = (clave, etiqueta) => {
    const mapa = new Map()
    for (const control of cerrados) {
      const key = control[clave]
      if (!key) continue
      if (!mapa.has(key)) mapa.set(key, { id: key, etiqueta: control[etiqueta]?.placa || control[etiqueta]?.nombre || key, controles: 0, sumaRendimiento: 0, criticos: 0 })
      const entrada = mapa.get(key)
      entrada.controles += 1
      entrada.sumaRendimiento += control.rendimientoKmLitro
      if (control.clasificacion === 'CRITICO') entrada.criticos += 1
    }
    return [...mapa.values()].map((entrada) => ({
      ...entrada,
      rendimientoPromedio: entrada.controles > 0 ? entrada.sumaRendimiento / entrada.controles : null
    }))
  }

  return {
    porCamion: agrupar('camionId', 'camion'),
    porChofer: agrupar('choferId', 'chofer')
  }
}

module.exports = {
  obtenerConfiguracion,
  guardarConfiguracion,
  abrirControl,
  registrarEvento,
  eliminarEvento,
  cerrarControl,
  editarControl,
  listarControles,
  obtenerControl,
  obtenerMisControlesAbiertos,
  obtenerResumen
}
