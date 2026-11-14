// Carga inicial de vencimientos de documentos desde un archivo JSON generado
// a partir de la hoja de control de la oficina.
//
// Por defecto SOLO SIMULA: lee la base, muestra que choferes y unidades del
// archivo coinciden con los registrados y que cambiaria, sin escribir nada.
// Para escribir hay que pasar --aplicar.
//
//   node scripts/importar_vencimientos.js /ruta/vencimientos.json
//   node scripts/importar_vencimientos.js /ruta/vencimientos.json --aplicar
//
// El archivo contiene datos personales: no debe guardarse en el repositorio.
require('dotenv').config()
const fs = require('fs')
const prisma = require('../src/config/database')
const { TIPOS_CHOFER, TIPOS_CAMION, etiquetaTipo } = require('../src/modules/documentos/documentos.catalogo')
const { parsearFecha, formatearFecha } = require('../src/utils/fechasCaracas')

const normalizarNombre = (valor = '') => String(valor)
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .toUpperCase()
  .replace(/[^A-Z0-9 ]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizarPlaca = (valor = '') => String(valor).toUpperCase().replace(/[^A-Z0-9]/g, '')
const soloDigitos = (valor = '') => String(valor).replace(/\D/g, '')

// Empareja un nombre del archivo con un chofer registrado. Primero exacto;
// luego, si todas las palabras de uno estan contenidas en el otro (la hoja a
// veces trae solo "nombre apellido" y el sistema el nombre completo, o al
// reves). Solo acepta la coincidencia si es unica.
const buscarChofer = (entrada, choferes) => {
  if (entrada.cedula) {
    const cedula = soloDigitos(entrada.cedula)
    const porCedula = choferes.filter((chofer) => soloDigitos(chofer.cedula) === cedula)
    if (porCedula.length === 1) return { chofer: porCedula[0], via: 'cedula' }
    return { motivo: 'la cedula indicada no esta registrada' }
  }

  const nombre = normalizarNombre(entrada.nombre)
  const exactos = choferes.filter((chofer) => chofer.clave === nombre || chofer.clave.replace(/ /g, '') === nombre.replace(/ /g, ''))
  if (exactos.length === 1) return { chofer: exactos[0], via: 'nombre exacto' }
  if (exactos.length > 1) return { motivo: 'hay varios choferes con ese mismo nombre' }

  const palabras = nombre.split(' ')
  if (palabras.length < 2) return { motivo: 'no hay un chofer registrado con ese nombre' }
  const parciales = choferes.filter((chofer) => {
    const otras = chofer.clave.split(' ')
    if (otras.length < 2) return false
    return palabras.every((palabra) => otras.includes(palabra)) || otras.every((palabra) => palabras.includes(palabra))
  })
  if (parciales.length === 1) return { chofer: parciales[0], via: 'nombre parcial' }
  if (parciales.length > 1) {
    return { motivo: `coincide con varios: ${parciales.map((chofer) => chofer.nombre).join(' / ')}` }
  }
  return { motivo: 'no hay un chofer registrado con ese nombre' }
}

const prepararDocumentos = (documentos, catalogo, etiqueta, problemas) => {
  const lista = []
  for (const [tipo, valor] of Object.entries(documentos || {})) {
    if (!Object.hasOwn(catalogo, tipo)) {
      problemas.push(`${etiqueta}: tipo de documento desconocido "${tipo}"`)
      continue
    }
    const fecha = valor === null ? null : parsearFecha(valor)
    if (valor !== null && !fecha) {
      problemas.push(`${etiqueta}: fecha invalida en ${etiquetaTipo(tipo)} ("${valor}")`)
      continue
    }
    lista.push({ tipo, fecha })
  }
  return lista
}

const main = async () => {
  const args = process.argv.slice(2)
  const aplicar = args.includes('--aplicar')
  const ruta = args.find((arg) => !arg.startsWith('--'))
  if (!ruta) throw new Error('Indica la ruta del archivo JSON de vencimientos')

  const archivo = JSON.parse(fs.readFileSync(ruta, 'utf8'))
  const entradasCamiones = Array.isArray(archivo.camiones) ? archivo.camiones : []
  const entradasChoferes = Array.isArray(archivo.choferes) ? archivo.choferes : []

  const [camiones, choferesBase, existentes] = await Promise.all([
    prisma.camion.findMany({ select: { id: true, placa: true, tipoVehiculo: true, activo: true } }),
    prisma.chofer.findMany({ select: { id: true, nombre: true, cedula: true, activo: true } }),
    prisma.documentoVencimiento.findMany({ select: { id: true, choferId: true, camionId: true, tipo: true, fechaVencimiento: true } }),
  ])
  const choferes = choferesBase.map((chofer) => ({ ...chofer, clave: normalizarNombre(chofer.nombre) }))
  const camionPorPlaca = new Map(camiones.map((camion) => [normalizarPlaca(camion.placa), camion]))
  const existentePorClave = new Map(existentes.map((doc) => [`${doc.choferId || ''}|${doc.camionId || ''}|${doc.tipo}`, doc]))

  const problemas = []
  const operaciones = []
  const usados = { camiones: new Set(), choferes: new Set() }
  const sinCoincidencia = { camiones: [], choferes: [] }
  const coincidencias = { camiones: [], choferes: [] }

  for (const entrada of entradasCamiones) {
    const camion = camionPorPlaca.get(normalizarPlaca(entrada.placa))
    const origen = [entrada.tabla || entrada.hoja, entrada.nota].filter(Boolean).join(' - ')
    if (!camion) {
      sinCoincidencia.camiones.push(`${entrada.placa}${origen ? `  (${origen})` : ''}`)
      continue
    }
    if (usados.camiones.has(camion.id)) {
      problemas.push(`Unidad ${entrada.placa}: aparece mas de una vez en el archivo; se usa la primera`)
      continue
    }
    usados.camiones.add(camion.id)
    coincidencias.camiones.push(`${camion.placa}  ${camion.tipoVehiculo}${camion.activo ? '' : '  [INACTIVA en el sistema]'}${entrada.nota ? `  (${entrada.nota})` : ''}`)
    for (const doc of prepararDocumentos(entrada.documentos, TIPOS_CAMION, `Unidad ${entrada.placa}`, problemas)) {
      operaciones.push({ camionId: camion.id, choferId: null, titular: camion.placa, ...doc })
    }
  }

  for (const entrada of entradasChoferes) {
    const { chofer, via, motivo } = buscarChofer(entrada, choferes)
    if (!chofer) {
      sinCoincidencia.choferes.push(`${entrada.nombre}  (${motivo})`)
      continue
    }
    if (usados.choferes.has(chofer.id)) {
      problemas.push(`Chofer "${entrada.nombre}": coincide con ${chofer.nombre}, que ya fue emparejado con otra fila; se omite`)
      continue
    }
    usados.choferes.add(chofer.id)
    const aviso = via === 'nombre parcial' ? '  [coincidencia parcial: REVISAR]' : ''
    coincidencias.choferes.push(`${entrada.nombre}  ->  ${chofer.nombre} (C.I. ${chofer.cedula})${chofer.activo ? '' : '  [INACTIVO en el sistema]'}${aviso}`)
    for (const doc of prepararDocumentos(entrada.documentos, TIPOS_CHOFER, `Chofer ${entrada.nombre}`, problemas)) {
      operaciones.push({ choferId: chofer.id, camionId: null, titular: chofer.nombre, ...doc })
    }
  }

  const nuevos = []
  const cambios = []
  let iguales = 0
  for (const operacion of operaciones) {
    const existente = existentePorClave.get(`${operacion.choferId || ''}|${operacion.camionId || ''}|${operacion.tipo}`)
    if (!existente) nuevos.push(operacion)
    else if (formatearFecha(existente.fechaVencimiento) !== formatearFecha(operacion.fecha)) cambios.push({ ...operacion, id: existente.id, anterior: existente.fechaVencimiento })
    else iguales += 1
  }

  const imprimirLista = (titulo, lista) => {
    console.log(`\n${titulo} (${lista.length})`)
    for (const linea of lista) console.log(`  ${linea}`)
  }

  console.log(`Archivo: ${entradasCamiones.length} unidades y ${entradasChoferes.length} choferes`)
  console.log(`Sistema: ${camiones.length} unidades y ${choferes.length} choferes registrados`)
  imprimirLista('UNIDADES QUE COINCIDEN', coincidencias.camiones)
  imprimirLista('UNIDADES DEL ARCHIVO QUE NO ESTAN EN EL SISTEMA', sinCoincidencia.camiones)
  imprimirLista('UNIDADES ACTIVAS DEL SISTEMA QUE NO ESTAN EN EL ARCHIVO',
    camiones.filter((camion) => camion.activo && !usados.camiones.has(camion.id)).map((camion) => `${camion.placa}  ${camion.tipoVehiculo}`))
  imprimirLista('CHOFERES QUE COINCIDEN', coincidencias.choferes)
  imprimirLista('CHOFERES DEL ARCHIVO QUE NO SE PUDIERON EMPAREJAR', sinCoincidencia.choferes)
  imprimirLista('CHOFERES ACTIVOS DEL SISTEMA QUE NO ESTAN EN EL ARCHIVO',
    choferes.filter((chofer) => chofer.activo && !usados.choferes.has(chofer.id)).map((chofer) => `${chofer.nombre} (C.I. ${chofer.cedula})`))
  if (cambios.length > 0) {
    imprimirLista('FECHAS QUE CAMBIARIAN (ya existe el documento con otra fecha)',
      cambios.map((cambio) => `${cambio.titular}  ${etiquetaTipo(cambio.tipo)}: ${formatearFecha(cambio.anterior) || 'no vence'} -> ${formatearFecha(cambio.fecha) || 'no vence'}`))
  }
  if (problemas.length > 0) imprimirLista('AVISOS', problemas)

  console.log(`\nResumen: ${nuevos.length} documentos nuevos, ${cambios.length} con fecha distinta, ${iguales} sin cambios.`)

  if (!aplicar) {
    console.log('\nSIMULACION: no se escribio nada. Revisa las listas y repite el comando con --aplicar para cargar.')
    console.log('Para forzar un chofer que no se emparejo por nombre, agrega su "cedula" en esa fila del archivo JSON.')
    return
  }

  await prisma.$transaction(async (tx) => {
    if (nuevos.length > 0) {
      await tx.documentoVencimiento.createMany({
        data: nuevos.map((doc) => ({ choferId: doc.choferId, camionId: doc.camionId, tipo: doc.tipo, fechaVencimiento: doc.fecha })),
      })
    }
    for (const cambio of cambios) {
      await tx.documentoVencimiento.update({ where: { id: cambio.id }, data: { fechaVencimiento: cambio.fecha } })
    }
  }, { timeout: 60000 })
  console.log(`\nCARGA APLICADA: ${nuevos.length} creados y ${cambios.length} actualizados.`)
}

main()
  .catch((error) => {
    console.error('No se pudo completar:', error.message)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
