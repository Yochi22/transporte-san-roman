require('dotenv').config()
const prisma = require('../src/config/database')

const main = async () => {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "viajes_unidades" (
      "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
      "viaje_id" TEXT NOT NULL,
      "camion_id" TEXT NOT NULL,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "viajes_unidades_pkey" PRIMARY KEY ("id")
    )
  `)

  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "viajes_unidades_viaje_id_camion_id_key"
    ON "viajes_unidades"("viaje_id", "camion_id")
  `)

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "viajes_unidades_camion_id_idx"
    ON "viajes_unidades"("camion_id")
  `)

  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'viajes_unidades_viaje_id_fkey'
      ) THEN
        ALTER TABLE "viajes_unidades"
        ADD CONSTRAINT "viajes_unidades_viaje_id_fkey"
        FOREIGN KEY ("viaje_id") REFERENCES "viajes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      END IF;
    END $$;
  `)

  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'viajes_unidades_camion_id_fkey'
      ) THEN
        ALTER TABLE "viajes_unidades"
        ADD CONSTRAINT "viajes_unidades_camion_id_fkey"
        FOREIGN KEY ("camion_id") REFERENCES "camiones"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      END IF;
    END $$;
  `)

  await prisma.$executeRawUnsafe(`
    INSERT INTO "viajes_unidades" ("id", "viaje_id", "camion_id")
    SELECT gen_random_uuid()::text, "id", "camion_id"
    FROM "viajes"
    ON CONFLICT ("viaje_id", "camion_id") DO NOTHING
  `)

  await prisma.$executeRawUnsafe('ALTER TABLE "viajes_unidades" ENABLE ROW LEVEL SECURITY')
  await prisma.$executeRawUnsafe('REVOKE ALL PRIVILEGES ON TABLE "viajes_unidades" FROM PUBLIC, anon, authenticated')

  console.log('Migracion viajes_unidades aplicada correctamente.')
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
