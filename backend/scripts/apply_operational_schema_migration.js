const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const prisma = require('../src/config/database')

const migrationName = '20260603130000_align_operational_schema'

const main = async () => {
  const sql = fs.readFileSync(
    path.join(__dirname, '..', 'prisma', 'migrations', migrationName, 'migration.sql'),
    'utf8'
  )

  const statements = sql
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean)

  for (const statement of statements) {
    await prisma.$executeRawUnsafe(statement)
  }

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
