const crypto = require('crypto')
const prisma = require('../src/config/database')

const migrationName = '20260604203000_add_vehicle_maintenance'

const main = async () => {
  await prisma.$executeRawUnsafe(`DO $$ BEGIN
    CREATE TYPE "TipoMantenimiento" AS ENUM ('REPARACION', 'CAMBIO_ACEITE', 'CAUCHOS', 'FRENOS', 'BATERIA', 'REVISION', 'OTRO');
  EXCEPTION WHEN duplicate_object THEN null;
  END $$;`)
  await prisma.$executeRawUnsafe(`DO $$ BEGIN
    CREATE TYPE "EstadoMantenimiento" AS ENUM ('EN_PROCESO', 'COMPLETADO');
  EXCEPTION WHEN duplicate_object THEN null;
  END $$;`)
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "mantenimientos_vehiculos" (
    "id" TEXT NOT NULL,
    "camion_id" TEXT NOT NULL,
    "tipo" "TipoMantenimiento" NOT NULL,
    "estado" "EstadoMantenimiento" NOT NULL DEFAULT 'EN_PROCESO',
    "falla" TEXT NOT NULL,
    "descripcion" TEXT,
    "kilometraje" INTEGER,
    "costo" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "fecha_ingreso" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_salida" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "mantenimientos_vehiculos_pkey" PRIMARY KEY ("id")
  )`)
  await prisma.$executeRawUnsafe(`DO $$ BEGIN
    ALTER TABLE "mantenimientos_vehiculos"
    ADD CONSTRAINT "mantenimientos_vehiculos_camion_id_fkey"
    FOREIGN KEY ("camion_id") REFERENCES "camiones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  EXCEPTION WHEN duplicate_object THEN null;
  END $$;`)

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
