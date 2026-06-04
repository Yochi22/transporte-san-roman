const crypto = require('crypto')
const prisma = require('../src/config/database')

const migrationName = '20260603140000_add_tramos_and_gasto_origin'

const main = async () => {
  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OrigenGasto') THEN
        CREATE TYPE "OrigenGasto" AS ENUM ('CHOFER', 'ADMIN');
      END IF;
    END
    $$
  `)

  await prisma.$executeRawUnsafe('ALTER TABLE "paradas" ADD COLUMN IF NOT EXISTS "tramo" INTEGER NOT NULL DEFAULT 1')
  await prisma.$executeRawUnsafe(`ALTER TABLE "gastos" ADD COLUMN IF NOT EXISTS "origen" "OrigenGasto" NOT NULL DEFAULT 'ADMIN'`)

  const [{ exists: migrationRegistered }] = await prisma.$queryRawUnsafe(
    'select exists (select 1 from "_prisma_migrations" where migration_name = $1) as exists',
    migrationName
  )

  if (!migrationRegistered) {
    await prisma.$executeRawUnsafe(
      `insert into "_prisma_migrations"
        (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
       values
        ($1, $2, now(), $3, $4, null, now(), 1)`,
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
  .finally(async () => {
    await prisma.$disconnect()
  })
