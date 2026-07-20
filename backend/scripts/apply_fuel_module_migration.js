require('dotenv').config()
const prisma = require('../src/config/database')

const exec = (sql) => prisma.$executeRawUnsafe(sql)

const main = async () => {
  await exec(`
    ALTER TABLE "camiones"
    ADD COLUMN IF NOT EXISTS "capacidad_tanque_litros" DECIMAL(12,2),
    ADD COLUMN IF NOT EXISTS "rendimiento_esperado_km_l" DECIMAL(12,4),
    ADD COLUMN IF NOT EXISTS "tolerancia_combustible_pct" DECIMAL(5,2) DEFAULT 10
  `)

  await exec(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TipoEventoCombustible') THEN
        CREATE TYPE "TipoEventoCombustible" AS ENUM ('CARGA', 'TRANSFERENCIA_SALIDA', 'TRANSFERENCIA_ENTRADA', 'AJUSTE', 'PERDIDA');
      END IF;
    END $$;
  `)

  await exec(`
    CREATE TABLE IF NOT EXISTS "combustible_eventos" (
      "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
      "viaje_id" TEXT NOT NULL,
      "chofer_id" TEXT NOT NULL,
      "camion_id" TEXT NOT NULL,
      "tipo" "TipoEventoCombustible" NOT NULL,
      "litros" DECIMAL(12,2) NOT NULL,
      "monto" DECIMAL(12,2) NOT NULL DEFAULT 0,
      "moneda" TEXT NOT NULL DEFAULT 'USD',
      "tasa_bcv" DECIMAL(12,4),
      "ubicacion" TEXT,
      "descripcion" TEXT,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "combustible_eventos_pkey" PRIMARY KEY ("id")
    )
  `)

  await exec(`
    CREATE TABLE IF NOT EXISTS "combustible_estandares_ruta" (
      "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
      "origen" TEXT NOT NULL,
      "destino" TEXT NOT NULL,
      "tipo_vehiculo" "TipoVehiculo",
      "camion_id" TEXT,
      "litros_esperados" DECIMAL(12,2) NOT NULL,
      "tolerancia_pct" DECIMAL(5,2) NOT NULL DEFAULT 10,
      "activo" BOOLEAN NOT NULL DEFAULT true,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "combustible_estandares_ruta_pkey" PRIMARY KEY ("id")
    )
  `)

  await exec('CREATE INDEX IF NOT EXISTS "combustible_eventos_viaje_id_created_at_idx" ON "combustible_eventos"("viaje_id", "created_at")')
  await exec('CREATE INDEX IF NOT EXISTS "combustible_eventos_chofer_id_created_at_idx" ON "combustible_eventos"("chofer_id", "created_at")')
  await exec('CREATE INDEX IF NOT EXISTS "combustible_eventos_camion_id_created_at_idx" ON "combustible_eventos"("camion_id", "created_at")')
  await exec('CREATE INDEX IF NOT EXISTS "combustible_estandares_ruta_origen_destino_activo_idx" ON "combustible_estandares_ruta"("origen", "destino", "activo")')
  await exec('CREATE INDEX IF NOT EXISTS "combustible_estandares_ruta_camion_id_idx" ON "combustible_estandares_ruta"("camion_id")')

  const constraints = [
    ['combustible_eventos_viaje_id_fkey', 'combustible_eventos', 'viaje_id', 'viajes', 'id', 'CASCADE'],
    ['combustible_eventos_chofer_id_fkey', 'combustible_eventos', 'chofer_id', 'choferes', 'id', 'CASCADE'],
    ['combustible_eventos_camion_id_fkey', 'combustible_eventos', 'camion_id', 'camiones', 'id', 'CASCADE'],
    ['combustible_estandares_ruta_camion_id_fkey', 'combustible_estandares_ruta', 'camion_id', 'camiones', 'id', 'SET NULL'],
  ]

  for (const [name, table, column, refTable, refColumn, onDelete] of constraints) {
    await exec(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${name}') THEN
          ALTER TABLE "${table}"
          ADD CONSTRAINT "${name}"
          FOREIGN KEY ("${column}") REFERENCES "${refTable}"("${refColumn}") ON DELETE ${onDelete} ON UPDATE CASCADE;
        END IF;
      END $$;
    `)
  }

  await exec('ALTER TABLE "combustible_eventos" ENABLE ROW LEVEL SECURITY')
  await exec('ALTER TABLE "combustible_estandares_ruta" ENABLE ROW LEVEL SECURITY')
  await exec('REVOKE ALL PRIVILEGES ON TABLE "combustible_eventos" FROM PUBLIC, anon, authenticated')
  await exec('REVOKE ALL PRIVILEGES ON TABLE "combustible_estandares_ruta" FROM PUBLIC, anon, authenticated')

  console.log('Migracion del modulo de combustible aplicada correctamente.')
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
