const crypto = require('crypto')
const prisma = require('../src/config/database')

const migrationName = '20260604170000_add_active_resources_and_stop_schedule'

const main = async () => {
  await prisma.$executeRawUnsafe('ALTER TABLE "choferes" ADD COLUMN IF NOT EXISTS "activo" BOOLEAN NOT NULL DEFAULT true')
  await prisma.$executeRawUnsafe('ALTER TABLE "camiones" ADD COLUMN IF NOT EXISTS "activo" BOOLEAN NOT NULL DEFAULT true')
  await prisma.$executeRawUnsafe('ALTER TABLE "paradas" ADD COLUMN IF NOT EXISTS "fecha_programada" TIMESTAMP(3)')

  await prisma.$executeRawUnsafe(`
    UPDATE "choferes" c
    SET "estado" = CASE
      WHEN EXISTS (
        SELECT 1 FROM "viajes" v
        WHERE v."chofer_id" = c."id" AND v."estado_logistico" = 'EN_CURSO'
      ) THEN 'EN_RUTA'::"EstadoChofer"
      ELSE 'DISPONIBLE'::"EstadoChofer"
    END
  `)

  await prisma.$executeRawUnsafe(`
    UPDATE "camiones" c
    SET "estado" = CASE
      WHEN c."estado" = 'EN_TALLER' THEN 'EN_TALLER'::"EstadoCamion"
      WHEN EXISTS (
        SELECT 1 FROM "viajes" v
        WHERE v."camion_id" = c."id" AND v."estado_logistico" = 'EN_CURSO'
      ) THEN 'EN_RUTA'::"EstadoCamion"
      ELSE 'DISPONIBLE'::"EstadoCamion"
    END
  `)

  const [{ exists }] = await prisma.$queryRawUnsafe(
    'select exists (select 1 from "_prisma_migrations" where migration_name = $1) as exists',
    migrationName
  )

  if (!exists) {
    await prisma.$executeRawUnsafe(
      `insert into "_prisma_migrations"
        (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
       values ($1, $2, now(), $3, $4, null, now(), 1)`,
      crypto.randomUUID(),
      'manual-apply',
      migrationName,
      'Applied manually and synchronized operational resource states.'
    )
  }

  console.log(`Migration applied/verified: ${migrationName}`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => prisma.$disconnect())
