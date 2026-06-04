const crypto = require('crypto')
const prisma = require('../src/config/database')

const migrationName = '20260603150000_add_driver_fees'

const main = async () => {
  await prisma.$executeRawUnsafe('ALTER TABLE "viajes" ADD COLUMN IF NOT EXISTS "honorarios_chofer" DECIMAL(65,30) NOT NULL DEFAULT 0')
  await prisma.$executeRawUnsafe('ALTER TABLE "viajes" ADD COLUMN IF NOT EXISTS "fecha_liquidacion" TIMESTAMP(3)')
  await prisma.$executeRawUnsafe(`UPDATE "viajes" SET "fecha_liquidacion" = COALESCE("fecha_cierre", "updated_at") WHERE "estado_financiero" = 'LIQUIDADO' AND "fecha_liquidacion" IS NULL`)

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
      'Applied manually because prisma schema engine failed with empty error.'
    )
  }

  console.log(`Migration applied/verified: ${migrationName}`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => prisma.$disconnect())
