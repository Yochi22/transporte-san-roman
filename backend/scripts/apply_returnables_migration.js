require('dotenv').config()
const prisma = require('../src/config/database')

const exec = (sql) => prisma.$executeRawUnsafe(sql)

const createEnum = async (name, values) => {
  await exec(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = '${name}') THEN CREATE TYPE "${name}" AS ENUM (${values.map((value) => `'${value}'`).join(', ')}); END IF; END $$;`)
}

const main = async () => {
  await createEnum('TipoRetornable', ['CARTON', 'PALETA', 'SEPARADOR', 'OTRO'])
  await exec(`ALTER TYPE "TipoRetornable" ADD VALUE IF NOT EXISTS 'SEPARADOR'`)
  await createEnum('EstadoRetornable', ['PENDIENTE', 'PARCIAL', 'DEVUELTO', 'AJUSTADO'])
  await createEnum('TipoMovimientoRetornable', ['REGISTRO', 'UBICACION', 'TRANSFERENCIA', 'DEVOLUCION_PARCIAL', 'DEVOLUCION_TOTAL', 'AJUSTE'])

  await exec(`CREATE TABLE IF NOT EXISTS "retornables" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "tipo" "TipoRetornable" NOT NULL,
    "empresa" TEXT NOT NULL,
    "cantidad_inicial" INTEGER NOT NULL,
    "cantidad_pendiente" INTEGER NOT NULL,
    "estado" "EstadoRetornable" NOT NULL DEFAULT 'PENDIENTE',
    "viaje_origen_id" TEXT,
    "observacion" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "retornables_pkey" PRIMARY KEY ("id")
  )`)

  await exec(`CREATE TABLE IF NOT EXISTS "retornables_movimientos" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "retornable_id" TEXT NOT NULL,
    "tipo_movimiento" "TipoMovimientoRetornable" NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "viaje_id" TEXT,
    "chofer_id" TEXT,
    "camion_id" TEXT,
    "ubicacion" TEXT,
    "origen" TEXT,
    "destino" TEXT,
    "observacion" TEXT,
    "registrado_por_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "retornables_movimientos_pkey" PRIMARY KEY ("id")
  )`)

  await exec('CREATE INDEX IF NOT EXISTS "retornables_estado_created_at_idx" ON "retornables"("estado", "created_at")')
  await exec('CREATE INDEX IF NOT EXISTS "retornables_empresa_idx" ON "retornables"("empresa")')
  await exec('CREATE INDEX IF NOT EXISTS "retornables_viaje_origen_id_idx" ON "retornables"("viaje_origen_id")')
  await exec('CREATE INDEX IF NOT EXISTS "retornables_movimientos_retornable_id_created_at_idx" ON "retornables_movimientos"("retornable_id", "created_at")')
  await exec('CREATE INDEX IF NOT EXISTS "retornables_movimientos_viaje_id_created_at_idx" ON "retornables_movimientos"("viaje_id", "created_at")')
  await exec('CREATE INDEX IF NOT EXISTS "retornables_movimientos_chofer_id_created_at_idx" ON "retornables_movimientos"("chofer_id", "created_at")')
  await exec('CREATE INDEX IF NOT EXISTS "retornables_movimientos_camion_id_created_at_idx" ON "retornables_movimientos"("camion_id", "created_at")')

  const constraints = [
    ['retornables_viaje_origen_id_fkey', 'retornables', 'viaje_origen_id', 'viajes', 'id', 'SET NULL'],
    ['retornables_movimientos_retornable_id_fkey', 'retornables_movimientos', 'retornable_id', 'retornables', 'id', 'CASCADE'],
    ['retornables_movimientos_viaje_id_fkey', 'retornables_movimientos', 'viaje_id', 'viajes', 'id', 'SET NULL'],
    ['retornables_movimientos_chofer_id_fkey', 'retornables_movimientos', 'chofer_id', 'choferes', 'id', 'SET NULL'],
    ['retornables_movimientos_camion_id_fkey', 'retornables_movimientos', 'camion_id', 'camiones', 'id', 'SET NULL'],
    ['retornables_movimientos_registrado_por_id_fkey', 'retornables_movimientos', 'registrado_por_id', 'usuarios', 'id', 'SET NULL'],
  ]

  for (const [name, table, column, refTable, refColumn, onDelete] of constraints) {
    await exec(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${name}') THEN ALTER TABLE "${table}" ADD CONSTRAINT "${name}" FOREIGN KEY ("${column}") REFERENCES "${refTable}"("${refColumn}") ON DELETE ${onDelete} ON UPDATE CASCADE; END IF; END $$;`)
  }

  await exec('ALTER TABLE "retornables" ENABLE ROW LEVEL SECURITY')
  await exec('ALTER TABLE "retornables_movimientos" ENABLE ROW LEVEL SECURITY')
  await exec('REVOKE ALL PRIVILEGES ON TABLE "retornables" FROM PUBLIC, anon, authenticated')
  await exec('REVOKE ALL PRIVILEGES ON TABLE "retornables_movimientos" FROM PUBLIC, anon, authenticated')

  console.log('Migracion de retornables aplicada correctamente.')
}

main()
  .catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })