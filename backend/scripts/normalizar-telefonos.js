require('dotenv').config()
const { PrismaClient } = require('@prisma/client')
const { normalizarTelefono } = require('../src/utils/normalizarTelefono')

const prisma = new PrismaClient()

async function main() {
  const choferes = await prisma.chofer.findMany()

  console.log(`Encontrados ${choferes.length} choferes en la base de datos:\n`)

  for (const chofer of choferes) {
    const telefonoNormalizado = normalizarTelefono(chofer.telefono)
    const cambio = chofer.telefono !== telefonoNormalizado

    console.log(`  ${chofer.nombre}:`)
    console.log(`    Actual:      "${chofer.telefono}"`)
    console.log(`    Normalizado: "${telefonoNormalizado}"`)
    console.log(`    ${cambio ? '⚠️  SE VA A ACTUALIZAR' : '✅ Ya está correcto'}`)
    console.log()

    if (cambio) {
      await prisma.chofer.update({
        where: { id: chofer.id },
        data: { telefono: telefonoNormalizado }
      })
      console.log(`    ✅ Actualizado exitosamente`)
    }
  }

  console.log('\n✅ Proceso completado')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
