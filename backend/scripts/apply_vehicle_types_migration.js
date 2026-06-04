const crypto = require('crypto')
const prisma = require('../src/config/database')

const migrationName = '20260603160000_add_vehicle_types'

const main = async () => {
  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TipoVehiculo') THEN
        CREATE TYPE "TipoVehiculo" AS ENUM ('NPR', 'TORONTO', 'FURGON');
      END IF;
    END
    $$
  `)
  await prisma.$executeRawUnsafe(`ALTER TABLE "camiones" ADD COLUMN IF NOT EXISTS "tipo_vehiculo" "TipoVehiculo" NOT NULL DEFAULT 'NPR'`)
  await prisma.$executeRawUnsafe('ALTER TABLE "camiones" ADD COLUMN IF NOT EXISTS "placa_furgon" TEXT')
  await prisma.$executeRawUnsafe('ALTER TABLE "camiones" ADD COLUMN IF NOT EXISTS "placa_chuto" TEXT')
  await prisma.$executeRawUnsafe('CREATE UNIQUE INDEX IF NOT EXISTS "camiones_placa_furgon_key" ON "camiones"("placa_furgon")')
  await prisma.$executeRawUnsafe('CREATE UNIQUE INDEX IF NOT EXISTS "camiones_placa_chuto_key" ON "camiones"("placa_chuto")')

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
