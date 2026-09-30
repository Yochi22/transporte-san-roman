const prisma = require('../../config/database')

const tieneTrabajoLogisticoPendienteWhere = { paradas: { some: { estado: { not: 'COMPLETADA' } } } }

/**
 * Aplica un reporte operativo de un chofer (WhatsApp o app) de forma identica:
 * marca la parada correspondiente, registra el ReporteChofer, cierra paradas/viajes
 * cuando el tipo es LIBRE o ESPERANDO_INSTRUCCIONES sin pendientes, y recalcula el
 * estado de chofer/camion. Es la unica fuente de verdad para esta maquina de estados;
 * tanto mensajes.handler.js (WhatsApp) como el modulo /api/mi (app) llaman aqui.
 */
const aplicarReporteChofer = async ({
  chofer,
  viaje,
  paradaId = null,
  estadoParada = null,
  tipoReporte,
  ubicacion = null,
  mensajeOriginal,
  procesadoPorIa = null,
  origen = 'WHATSAPP',
  socketIO = null,
}) => {
  const paradaValida = paradaId ? viaje.paradas.find((p) => p.id === paradaId) : null
  const paradaIdFinal = paradaValida ? paradaValida.id : null
  const estadoParadaFinal = paradaIdFinal ? estadoParada : null

  const { reporte, viajesCompletados, viajesPendientesLiquidacion } = await prisma.$transaction(async (tx) => {
    if (paradaIdFinal && estadoParadaFinal) {
      await tx.parada.update({
        where: { id: paradaIdFinal },
        data: {
          estado: estadoParadaFinal,
          completadaAt: estadoParadaFinal === 'COMPLETADA' ? new Date() : undefined,
        },
      })
    }

    const reporte = await tx.reporteChofer.create({
      data: {
        viajeId: viaje.id,
        choferId: chofer.id,
        paradaId: paradaIdFinal,
        mensajeOriginal,
        tipoReporte,
        ubicacion,
        procesadoPorIa,
        origen,
      },
    })

    let viajesCompletados = []
    if (tipoReporte === 'ESPERANDO_INSTRUCCIONES') {
      const paradasPendientes = await tx.parada.count({
        where: { viajeId: viaje.id, estado: { not: 'COMPLETADA' } },
      })
      if (paradasPendientes === 0) {
        await tx.viaje.update({
          where: { id: viaje.id },
          data: { estadoLogistico: 'EN_CURSO', fechaCierre: new Date() },
        })
        viajesCompletados = [viaje.id]
      }
    }

    if (tipoReporte === 'LIBRE') {
      const viajesChofer = await tx.viaje.findMany({
        where: { choferId: chofer.id, estadoLogistico: 'EN_CURSO' },
        select: { id: true },
      })
      const ids = viajesChofer.map((v) => v.id)
      await tx.parada.updateMany({
        where: { viajeId: { in: ids }, estado: { not: 'COMPLETADA' } },
        data: { estado: 'COMPLETADA', completadaAt: new Date() },
      })
      await tx.viaje.updateMany({
        where: { id: { in: ids } },
        data: { estadoLogistico: 'EN_CURSO', fechaCierre: new Date() },
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
        data: { estadoLogistico: 'EN_CURSO', fechaCierre: new Date() },
      })
      viajesCompletados = [...new Set([...viajesCompletados, ...viajesActualizados.map((v) => v.id)])]
    }

    const dataChofer = {
      ubicacionActual: ubicacion || chofer.ubicacionActual,
      ultimoReporteAt: new Date(),
    }
    const [viajesChoferRestantes, viajesCamionRestantes] = await Promise.all([
      tx.viaje.count({ where: { choferId: chofer.id, estadoLogistico: 'EN_CURSO', ...tieneTrabajoLogisticoPendienteWhere } }),
      tx.viaje.count({
        where: {
          estadoLogistico: 'EN_CURSO',
          ...tieneTrabajoLogisticoPendienteWhere,
          OR: [
            { camionId: viaje.camionId },
            { unidades: { some: { camionId: viaje.camionId } } }
          ]
        }
      }),
    ])

    if (tipoReporte === 'LIBRE' || tipoReporte === 'ESPERANDO_INSTRUCCIONES' || viajesChoferRestantes === 0) {
      dataChofer.estado = 'DISPONIBLE'
      if (tipoReporte === 'LIBRE') dataChofer.ubicacionActual = ubicacion || 'Sede Barquisimeto'
    }

    await tx.chofer.update({
      where: { id: chofer.id },
      data: dataChofer,
    })

    const unidadIds = [...new Set([(viaje.camionId), ...(viaje.unidades || []).map((unidad) => unidad.camionId)].filter(Boolean))]
    await tx.camion.updateMany({
      where: { id: { in: unidadIds }, estado: { not: 'EN_TALLER' } },
      data: {
        ubicacionActual: ubicacion || chofer.ubicacionActual,
        estado:
          tipoReporte === 'LIBRE' || tipoReporte === 'ESPERANDO_INSTRUCCIONES' || viajesCamionRestantes === 0
            ? 'DISPONIBLE'
            : undefined,
      },
    })

    const viajesPendientesLiquidacion =
      tipoReporte === 'LIBRE'
        ? await tx.viaje.count({
            where: {
              choferId: chofer.id,
              estadoFinanciero: 'PENDIENTE',
              paradas: { every: { estado: 'COMPLETADA' } },
            },
          })
        : 0

    return { reporte, viajesCompletados, viajesPendientesLiquidacion }
  })

  if (socketIO) {
    socketIO.emit('reporte:nuevo', {
      reporte,
      chofer: { id: chofer.id, nombre: chofer.nombre, telefono: chofer.telefono },
      viaje: { codigo: viaje.codigo, id: viaje.id },
      parada: paradaIdFinal ? { id: paradaIdFinal, estado: estadoParadaFinal } : null,
      mensaje: `${chofer.nombre}: ${procesadoPorIa || mensajeOriginal}`,
    })

    if (tipoReporte === 'ESPERANDO_INSTRUCCIONES') {
      socketIO.emit('operaciones:alerta', {
        tipo: viajesCompletados.length > 0 ? 'VIAJES_COMPLETADOS' : 'CHOFER_ESPERA_INSTRUCCIONES',
        chofer: { id: chofer.id, nombre: chofer.nombre },
        ubicacion,
        viajesCompletados,
      })
    }

    if (tipoReporte === 'NOVEDAD') {
      socketIO.emit('operaciones:alerta', {
        tipo: 'NOVEDAD_VIAJE',
        mensaje: `Novedad de ${chofer.nombre} en ${viaje.codigo}: ${mensajeOriginal}`,
        chofer: { id: chofer.id, nombre: chofer.nombre },
        viaje: { id: viaje.id, codigo: viaje.codigo },
        ubicacion,
      })
    }

    if (tipoReporte === 'LIBRE') {
      socketIO.emit('operaciones:alerta', {
        tipo: 'CHOFER_LIBRE',
        mensaje: `Chofer ${chofer.nombre} llego a sede. Viajes pendientes de liquidacion: ${viajesPendientesLiquidacion}`,
        chofer: { id: chofer.id, nombre: chofer.nombre },
        ubicacion: ubicacion || 'Barquisimeto',
        viajesPendientesLiquidacion,
      })
    }
  }

  return { reporte, viajesCompletados, viajesPendientesLiquidacion, paradaIdFinal, estadoParadaFinal }
}

module.exports = { aplicarReporteChofer }
