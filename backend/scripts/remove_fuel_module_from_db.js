require('dotenv').config()
const prisma = require('../src/config/database')

const exec = (sql) => prisma.$executeRawUnsafe(sql)

const main = async () => {
  await exec('DROP TABLE IF EXISTS "combustible_eventos" CASCADE')
  await exec('DROP TABLE IF EXISTS "combustible_estandares_ruta" CASCADE')
  await exec('ALTER TABLE "camiones" DROP COLUMN IF EXISTS "capacidad_tanque_litros"')
  await exec('ALTER TABLE "camiones" DROP COLUMN IF EXISTS "rendimiento_esperado_km_l"')
  await exec('ALTER TABLE "camiones" DROP COLUMN IF EXISTS "tolerancia_combustible_pct"')
  await exec('ALTER TABLE "viajes" DROP COLUMN IF EXISTS "combustible_inicial"')
  await exec('ALTER TABLE "viajes" DROP COLUMN IF EXISTS "combustible_final"')
  await exec('DROP TYPE IF EXISTS "TipoEventoCombustible"')
  await exec(`UPDATE "gastos" SET "tipo" = 'OTRO' WHERE "tipo"::text = 'COMBUSTIBLE'`)
  await exec(`DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TipoGasto') AND EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'TipoGasto' AND e.enumlabel = 'COMBUSTIBLE') THEN ALTER TYPE "TipoGasto" RENAME TO "TipoGasto_old"; CREATE TYPE "TipoGasto" AS ENUM ('PEAJE', 'COMIDA', 'HOSPEDAJE', 'REPARACION', 'OTRO'); ALTER TABLE "gastos" ALTER COLUMN "tipo" TYPE "TipoGasto" USING "tipo"::text::"TipoGasto"; DROP TYPE "TipoGasto_old"; END IF; END $$;`)
  console.log('Modulo de combustible eliminado de la base de datos.')
}

main()
  .catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })