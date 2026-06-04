const crypto = require('crypto')
const prisma = require('../src/config/database')

const migrationName = '20260603120000_add_parada_to_reporte'

const main = async () => {
  const [{ exists: hasColumn }] = await prisma.$queryRawUnsafe(`
    select exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'reportes_chofer'
        and column_name = 'parada_id'
    ) as exists
  `)

  if (!hasColumn) {
    await prisma.$executeRawUnsafe(`
      alter table "reportes_chofer"
      add column "parada_id" text
    `)
  }

  const [{ exists: hasConstraint }] = await prisma.$queryRawUnsafe(`
    select exists (
      select 1
      from pg_constraint
      where conname = 'reportes_chofer_parada_id_fkey'
    ) as exists
  `)

  if (!hasConstraint) {
    await prisma.$executeRawUnsafe(`
      alter table "reportes_chofer"
      add constraint "reportes_chofer_parada_id_fkey"
      foreign key ("parada_id") references "paradas"("id")
      on delete set null on update cascade
    `)
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
