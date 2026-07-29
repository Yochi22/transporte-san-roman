const prisma = require('../src/config/database')

const exec = (sql) => prisma.$executeRawUnsafe(sql)

const main = async () => {
  await exec(`ALTER TABLE "gastos" ADD COLUMN IF NOT EXISTS "moneda" TEXT NOT NULL DEFAULT 'VES'`)
  await exec('ALTER TABLE "gastos" ADD COLUMN IF NOT EXISTS "monto_original" DECIMAL(65,30) NOT NULL DEFAULT 0')
  await exec('ALTER TABLE "gastos" ADD COLUMN IF NOT EXISTS "tasa_bcv" DECIMAL(65,30)')
  await exec('UPDATE "gastos" SET "monto_original" = "monto" WHERE "monto_original" = 0')
  await exec('CREATE INDEX IF NOT EXISTS "gastos_moneda_created_at_idx" ON "gastos"("moneda", "created_at")')
  console.log('Migracion de moneda de gastos aplicada correctamente.')
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => prisma.$disconnect())
