const crypto = require('crypto')
const prisma = require('../src/config/database')

const migrationName = '20260603170000_add_trip_guide_number'

const main = async () => {
  await prisma.$executeRawUnsafe('ALTER TABLE "viajes" ADD COLUMN IF NOT EXISTS "numero_guia" TEXT')
  await prisma.$executeRawUnsafe('CREATE UNIQUE INDEX IF NOT EXISTS "viajes_numero_guia_key" ON "viajes"("numero_guia")')

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
