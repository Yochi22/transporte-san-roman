const crypto = require('crypto')
const prisma = require('../src/config/database')

const migrationName = '20260604193000_add_load_after_unloading'

const main = async () => {
  await prisma.$executeRawUnsafe('ALTER TABLE "paradas" ADD COLUMN IF NOT EXISTS "cargar_al_descargar" BOOLEAN NOT NULL DEFAULT false')

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
      'Applied manually.'
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
