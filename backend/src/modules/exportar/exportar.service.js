const prisma = require('../../config/database')
const { parsearFecha, inicioDiaCaracas, finDiaCaracas, diasEntre } = require('../../utils/fechasCaracas')
const documentosService = require('../documentos/documentos.service')

const MAX_DIAS = 366
const MAX_FILAS = 5000

const ESTADO_DOCUMENTO = {
  VENCIDO: 'Vencido',
  POR_VENCER: 'Por vencer (30 dias o menos)',
  PROXIMO: 'Proximo (31 a 60 dias)',
  VIGENTE: 'Vigente',
  NO_VENCE: 'No vence',
}

const col = (clave, titulo, tipo = 'texto', ancho = 18) => ({ clave, titulo, tipo, ancho })
const numero = (valor) => (valor === null || valor === undefined ? null : Number(valor))

const unidadesDeViaje = (viaje) => {
  const placas = (viaje.unidades || []).map((unidad) => unidad.camion?.placa).filter(Boolean)
  return (placas.length > 0 ? placas : [viaje.camion?.placa].filter(Boolean)).join(' + ')
}

const rutaDeViaje = (viaje) => {
  const ciudades = []
  for (const parada of viaje.paradas || []) {
    if (ciudades[ciudades.length - 1] !== parada.ciudad) ciudades.push(parada.ciudad)
  }
  return ciudades.join(' - ')
}

const estadoDeViaje = (viaje) => {
  if (viaje.estadoLogistico === 'CANCELADO') return 'Cancelado'
  if (viaje.estadoFinanciero === 'LIQUIDADO') return 'Liquidado'
  const completo = (viaje.paradas || []).length > 0 && viaje.paradas.every((parada) => parada.estado === 'COMPLETADA')
  return completo ? 'Por liquidar' : 'En curso'
}

const viajeSelect = {
  codigo: true,
  estadoLogistico: true,
  estadoFinanciero: true,
  documentacionRecibida: true,
  numeroGuia: true,
  viaticosDepositados: true,
  viaticosGastados: true,
  fechaInicio: true,
  fechaCierre: true,
  fechaLiquidacion: true,
  createdAt: true,
  empresa: { select: { nombre: true } },
  chofer: { select: { nombre: true, cedula: true } },
  camion: { select: { placa: true } },
  unidades: { select: { camion: { select: { placa: true } } } },
  paradas: { orderBy: { orden: 'asc' }, select: { ciudad: true, estado: true } },
}

const hojaViajes = async (rango, esAdmin) => {
  const viajes = await prisma.viaje.findMany({
    where: { createdAt: rango },
    select: viajeSelect,
    orderBy: { createdAt: 'asc' },
    take: MAX_FILAS,
  })
  const columnas = [
    col('codigo', 'Viaje', 'texto', 16),
    col('empresa', 'Empresa', 'texto', 24),
    col('chofer', 'Chofer', 'texto', 28),
    col('unidades', 'Unidades', 'texto', 20),
    col('ruta', 'Ruta', 'texto', 36),
    col('estado', 'Estado', 'texto', 14),
    col('agendado', 'Agendado', 'fechaHora'),
    col('inicio', 'Inicio programado', 'fechaHora'),
    col('cierre', 'Cierre logistico', 'fechaHora'),
  ]
  // Los montos y la guia son informacion financiera: solo ADMIN, igual que en el panel.
  if (esAdmin) {
    columnas.push(
      col('guia', 'Numero de guia', 'texto', 16),
      col('depositado', 'Viaticos depositados (Bs)', 'monto', 22),
      col('gastado', 'Viaticos gastados (Bs)', 'monto', 22),
      col('saldo', 'Saldo (Bs)', 'monto', 16),
      col('liquidado', 'Fecha de liquidacion', 'fechaHora')
    )
  }
  const filas = viajes.map((viaje) => ({
    codigo: viaje.codigo,
    empresa: viaje.empresa?.nombre || 'Sin empresa',
    chofer: viaje.chofer?.nombre || '',
    unidades: unidadesDeViaje(viaje),
    ruta: rutaDeViaje(viaje),
    estado: estadoDeViaje(viaje),
    agendado: viaje.createdAt,
    inicio: viaje.fechaInicio,
    cierre: viaje.fechaCierre,
    ...(esAdmin ? {
      guia: viaje.numeroGuia,
      depositado: numero(viaje.viaticosDepositados),
      gastado: numero(viaje.viaticosGastados),
      saldo: numero(viaje.viaticosDepositados) - numero(viaje.viaticosGastados),
      liquidado: viaje.fechaLiquidacion,
    } : {}),
  }))
  return { nombre: 'Viajes', columnas, filas }
}

const hojaLiquidaciones = async (rango) => {
  const viajes = await prisma.viaje.findMany({
    where: { estadoFinanciero: 'LIQUIDADO', fechaLiquidacion: rango },
    select: viajeSelect,
    orderBy: { fechaLiquidacion: 'asc' },
    take: MAX_FILAS,
  })
  return {
    nombre: 'Liquidaciones',
    columnas: [
      col('liquidado', 'Fecha de liquidacion', 'fechaHora'),
      col('codigo', 'Viaje', 'texto', 16),
      col('empresa', 'Empresa', 'texto', 24),
      col('chofer', 'Chofer', 'texto', 28),
      col('cedula', 'Cedula', 'texto', 14),
      col('unidades', 'Unidades', 'texto', 20),
      col('ruta', 'Ruta', 'texto', 36),
      col('guia', 'Numero de guia', 'texto', 16),
      col('documentacion', 'Documentacion recibida', 'texto', 22),
      col('depositado', 'Viaticos depositados (Bs)', 'monto', 22),
      col('gastado', 'Viaticos gastados (Bs)', 'monto', 22),
      col('saldo', 'Saldo (Bs)', 'monto', 16),
    ],
    filas: viajes.map((viaje) => ({
      liquidado: viaje.fechaLiquidacion,
      codigo: viaje.codigo,
      empresa: viaje.empresa?.nombre || 'Sin empresa',
      chofer: viaje.chofer?.nombre || '',
      cedula: viaje.chofer?.cedula || '',
      unidades: unidadesDeViaje(viaje),
      ruta: rutaDeViaje(viaje),
      guia: viaje.numeroGuia,
      documentacion: viaje.documentacionRecibida ? 'Si' : 'No',
      depositado: numero(viaje.viaticosDepositados),
      gastado: numero(viaje.viaticosGastados),
      saldo: numero(viaje.viaticosDepositados) - numero(viaje.viaticosGastados),
    })),
  }
}

const hojaGastos = async (rango) => {
  const gastos = await prisma.gasto.findMany({
    where: { createdAt: rango },
    select: {
      createdAt: true, tipo: true, descripcion: true, moneda: true, monto: true, montoOriginal: true, tasaBcv: true,
      viaje: { select: { codigo: true, empresa: { select: { nombre: true } } } },
      chofer: { select: { nombre: true } },
    },
    orderBy: { createdAt: 'asc' },
    take: MAX_FILAS,
  })
  return {
    nombre: 'Gastos',
    columnas: [
      col('fecha', 'Fecha', 'fechaHora'),
      col('viaje', 'Viaje', 'texto', 16),
      col('empresa', 'Empresa', 'texto', 24),
      col('chofer', 'Chofer', 'texto', 28),
      col('tipo', 'Tipo', 'texto', 14),
      col('descripcion', 'Descripcion', 'texto', 36),
      col('moneda', 'Moneda', 'texto', 10),
      col('montoOriginal', 'Monto original', 'monto', 16),
      col('tasa', 'Tasa BCV', 'monto', 12),
      col('montoBs', 'Monto (Bs)', 'monto', 16),
    ],
    filas: gastos.map((gasto) => ({
      fecha: gasto.createdAt,
      viaje: gasto.viaje?.codigo || '',
      empresa: gasto.viaje?.empresa?.nombre || 'Sin empresa',
      chofer: gasto.chofer?.nombre || '',
      tipo: gasto.tipo,
      descripcion: gasto.descripcion,
      moneda: gasto.moneda,
      // Los gastos anteriores a la doble moneda guardaron 0 como monto original.
      montoOriginal: numero(gasto.montoOriginal) || numero(gasto.monto),
      tasa: numero(gasto.tasaBcv),
      montoBs: numero(gasto.monto),
    })),
  }
}

const TIPO_EVENTO = {
  RECARGA_TRANSPORTE: 'Recarga en transporte',
  RECARGA_ESTACION: 'Recarga en estacion',
  TRANSFERENCIA_SALIDA: 'Transferencia (salida)',
  TRANSFERENCIA_ENTRADA: 'Transferencia (entrada)',
}

const hojasCombustible = async (rango) => {
  const [controles, eventos] = await Promise.all([
    prisma.controlCombustible.findMany({
      where: { estado: 'CERRADO', cerradoAt: rango },
      include: {
        camion: { select: { placa: true } },
        chofer: { select: { nombre: true } },
        viaje: { select: { codigo: true } },
        eventos: { select: { tipo: true, litros: true } },
      },
      orderBy: { cerradoAt: 'asc' },
      take: MAX_FILAS,
    }),
    prisma.eventoCombustible.findMany({
      where: { createdAt: rango },
      include: {
        controlCombustible: {
          select: { camion: { select: { placa: true } }, chofer: { select: { nombre: true } }, viaje: { select: { codigo: true } } },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: MAX_FILAS,
    }),
  ])

  const sumar = (lista, tipos) => lista.filter((evento) => tipos.includes(evento.tipo)).reduce((total, evento) => total + evento.litros, 0)

  return [
    {
      nombre: 'Combustible',
      columnas: [
        col('cierre', 'Cierre', 'fechaHora'),
        col('unidad', 'Unidad', 'texto', 12),
        col('chofer', 'Chofer', 'texto', 28),
        col('viaje', 'Viaje', 'texto', 16),
        col('apertura', 'Apertura', 'fechaHora'),
        col('odometroInicial', 'Odometro inicial', 'numero', 16),
        col('odometroFinal', 'Odometro final', 'numero', 16),
        col('km', 'Km recorridos', 'monto', 14),
        col('litrosIniciales', 'Litros iniciales', 'monto', 15),
        col('recargas', 'Recargas (L)', 'monto', 13),
        col('entradas', 'Transf. recibidas (L)', 'monto', 19),
        col('salidas', 'Transf. entregadas (L)', 'monto', 20),
        col('litrosFinales', 'Litros finales', 'monto', 14),
        col('consumo', 'Consumo neto (L)', 'monto', 16),
        col('rendimiento', 'Rendimiento (km/L)', 'monto', 18),
        col('clasificacion', 'Clasificacion', 'texto', 14),
      ],
      filas: controles.map((control) => ({
        cierre: control.cerradoAt,
        unidad: control.camion?.placa || '',
        chofer: control.chofer?.nombre || '',
        viaje: control.viaje?.codigo || '',
        apertura: control.createdAt,
        odometroInicial: control.odometroInicial,
        odometroFinal: control.odometroFinal,
        km: control.kmRecorridos,
        litrosIniciales: control.litrosInicialesTotal,
        recargas: sumar(control.eventos, ['RECARGA_TRANSPORTE', 'RECARGA_ESTACION']),
        entradas: sumar(control.eventos, ['TRANSFERENCIA_ENTRADA']),
        salidas: sumar(control.eventos, ['TRANSFERENCIA_SALIDA']),
        litrosFinales: control.litrosFinalesTotal,
        consumo: control.consumoNetoLitros,
        rendimiento: control.rendimientoKmLitro,
        clasificacion: control.clasificacion,
      })),
    },
    {
      nombre: 'Recargas',
      columnas: [
        col('fecha', 'Fecha', 'fechaHora'),
        col('unidad', 'Unidad', 'texto', 12),
        col('chofer', 'Chofer', 'texto', 28),
        col('viaje', 'Viaje', 'texto', 16),
        col('tipo', 'Tipo', 'texto', 24),
        col('litros', 'Litros', 'monto', 10),
        col('costo', 'Costo', 'monto', 12),
        col('moneda', 'Moneda', 'texto', 10),
        col('ubicacion', 'Ubicacion', 'texto', 24),
        col('observacion', 'Observacion', 'texto', 36),
      ],
      filas: eventos.map((evento) => ({
        fecha: evento.createdAt,
        unidad: evento.controlCombustible?.camion?.placa || '',
        chofer: evento.controlCombustible?.chofer?.nombre || '',
        viaje: evento.controlCombustible?.viaje?.codigo || '',
        tipo: TIPO_EVENTO[evento.tipo] || evento.tipo,
        litros: evento.litros,
        costo: numero(evento.costo),
        moneda: evento.moneda,
        ubicacion: evento.ubicacion,
        observacion: evento.observacion,
      })),
    },
  ]
}

const hojaTaller = async (rango) => {
  const mantenimientos = await prisma.mantenimientoVehiculo.findMany({
    where: { fechaIngreso: rango },
    include: { camion: { select: { placa: true, tipoVehiculo: true } } },
    orderBy: { fechaIngreso: 'asc' },
    take: MAX_FILAS,
  })
  return {
    nombre: 'Taller',
    columnas: [
      col('ingreso', 'Ingreso', 'fechaHora'),
      col('salida', 'Salida', 'fechaHora'),
      col('unidad', 'Unidad', 'texto', 12),
      col('tipoVehiculo', 'Tipo de vehiculo', 'texto', 16),
      col('tipo', 'Trabajo', 'texto', 16),
      col('estado', 'Estado', 'texto', 14),
      col('falla', 'Falla o trabajo', 'texto', 36),
      col('descripcion', 'Descripcion', 'texto', 40),
      col('kilometraje', 'Kilometraje', 'numero', 14),
      col('costo', 'Costo', 'monto', 14),
    ],
    filas: mantenimientos.map((item) => ({
      ingreso: item.fechaIngreso,
      salida: item.fechaSalida,
      unidad: item.camion?.placa || '',
      tipoVehiculo: item.camion?.tipoVehiculo || '',
      tipo: item.tipo,
      estado: item.estado === 'COMPLETADO' ? 'Completado' : 'En proceso',
      falla: item.falla,
      descripcion: item.descripcion,
      kilometraje: item.kilometraje,
      costo: numero(item.costo),
    })),
  }
}

// Los vencimientos no dependen del rango: es la foto actual de todos los documentos.
const hojaVencimientos = async () => {
  const documentos = await documentosService.listar({})
  return {
    nombre: 'Vencimientos',
    columnas: [
      col('entidad', 'Pertenece a', 'texto', 12),
      col('titular', 'Chofer / Placa', 'texto', 28),
      col('detalle', 'Cedula / Tipo', 'texto', 16),
      col('tipo', 'Documento', 'texto', 22),
      col('numero', 'Numero', 'texto', 16),
      col('fecha', 'Vence', 'fecha', 14),
      col('dias', 'Dias restantes', 'numero', 14),
      col('estado', 'Estado', 'texto', 28),
      col('nota', 'Nota', 'texto', 32),
    ],
    filas: documentos.map((documento) => ({
      entidad: documento.entidad === 'chofer' ? 'Chofer' : 'Unidad',
      titular: documento.titular,
      detalle: documento.titularDetalle,
      tipo: documento.tipoEtiqueta,
      numero: documento.numero,
      fecha: documento.fechaVencimiento,
      dias: documento.diasRestantes,
      estado: ESTADO_DOCUMENTO[documento.estado] || documento.estado,
      nota: documento.nota,
    })),
  }
}

// Que conjuntos puede exportar cada rol. Coincide con lo que cada uno ya ve en el panel.
const CONJUNTOS = {
  viajes: { roles: ['ADMIN', 'OPERACIONES'], generar: (rango, esAdmin) => hojaViajes(rango, esAdmin) },
  liquidaciones: { roles: ['ADMIN'], generar: (rango) => hojaLiquidaciones(rango) },
  gastos: { roles: ['ADMIN'], generar: (rango) => hojaGastos(rango) },
  combustible: { roles: ['ADMIN', 'OPERACIONES', 'COMBUSTIBLE_TALLER'], generar: (rango) => hojasCombustible(rango) },
  taller: { roles: ['ADMIN', 'OPERACIONES', 'COMBUSTIBLE_TALLER'], generar: (rango) => hojaTaller(rango) },
  vencimientos: { roles: ['ADMIN', 'OPERACIONES', 'COMBUSTIBLE_TALLER'], generar: () => hojaVencimientos() },
}

const conjuntosPermitidos = (rol) => Object.keys(CONJUNTOS).filter((clave) => CONJUNTOS[clave].roles.includes(rol))

const exportar = async ({ desde, hasta, conjuntos }, rol) => {
  const fechaDesde = parsearFecha(desde)
  const fechaHasta = parsearFecha(hasta)
  if (!fechaDesde || !fechaHasta) throw { status: 400, message: 'Indica el rango de fechas (desde y hasta)' }
  if (fechaDesde > fechaHasta) throw { status: 400, message: 'El rango de fechas esta invertido' }
  if (diasEntre(fechaDesde, fechaHasta) > MAX_DIAS) {
    throw { status: 400, message: 'El rango no puede superar un ano. Exporta por periodos mas cortos.' }
  }

  const solicitados = [...new Set(String(conjuntos || '').split(',').map((item) => item.trim()).filter(Boolean))]
  if (solicitados.length === 0) throw { status: 400, message: 'Selecciona al menos un conjunto de datos' }
  for (const clave of solicitados) {
    if (!Object.hasOwn(CONJUNTOS, clave)) throw { status: 400, message: 'Conjunto de datos invalido' }
    if (!CONJUNTOS[clave].roles.includes(rol)) throw { status: 403, message: 'No tienes permiso para exportar esos datos' }
  }

  const rango = { gte: inicioDiaCaracas(fechaDesde), lte: finDiaCaracas(fechaHasta) }
  const hojas = []
  for (const clave of solicitados) {
    hojas.push(...[await CONJUNTOS[clave].generar(rango, rol === 'ADMIN')].flat())
  }
  return {
    desde,
    hasta,
    hojas: hojas.map((hoja) => ({ ...hoja, truncado: hoja.filas.length >= MAX_FILAS })),
  }
}

module.exports = { exportar, conjuntosPermitidos }
