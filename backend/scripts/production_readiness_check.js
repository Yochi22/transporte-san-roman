const fs = require('fs')
const path = require('path')
require('dotenv').config()
const prisma = require('../src/config/database')

const DIAS_RETENCION_REPORTES = Math.max(1, Number(process.env.DIAS_RETENCION_REPORTES) || 5)
const REQUIRED_RLS_TABLES = [
  'usuarios',
  'choferes',
  'camiones',
  'choferes_unidades',
  'truck_positions',
  'mantenimientos_vehiculos',
  'viajes',
  'viajes_unidades',
  'paradas',
  'reportes_chofer',
  'retornables',
  'retornables_movimientos',
  'gastos',
]

const add = (items, ok, message, detail = null) => items.push({ ok, message, detail })
const sqlStringList = (items) => items.map((item) => `'${String(item).replace(/'/g, "''")}'`).join(', ')

const staticFrontendScan = () => {
  const root = path.resolve(__dirname, '../../frontend')
  const hits = []
  const skipDirs = new Set(['node_modules', '.git'])
  const patterns = [/SERVICE_ROLE/i, /SUPABASE_SERVICE_ROLE/i]

  const walk = (dir) => {
    if (!fs.existsSync(dir)) return
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!skipDirs.has(entry.name)) walk(path.join(dir, entry.name))
        continue
      }
      if (!/\.(js|jsx|ts|tsx|html|css|env)$/i.test(entry.name)) continue
      const file = path.join(dir, entry.name)
      const text = fs.readFileSync(file, 'utf8')
      if (patterns.some((pattern) => pattern.test(text))) {
        hits.push(path.relative(root, file))
      }
    }
  }

  walk(path.join(root, 'src'))
  return hits
}

async function main() {
  const results = []

  const [truckPositions, camionesConGps, duplicatePositions] = await Promise.all([
    prisma.truckPosition.count(),
    prisma.camion.count({ where: { gpsImei: { not: null }, activo: true } }),
    prisma.$queryRaw`
      SELECT truck_id, COUNT(*)::int AS total
      FROM truck_positions
      GROUP BY truck_id
      HAVING COUNT(*) > 1
    `,
  ])
  add(results, duplicatePositions.length === 0, 'truck_positions mantiene una sola fila por unidad', duplicatePositions)
  add(results, truckPositions <= Math.max(camionesConGps, 1), 'truck_positions no luce como historial acumulado', { truckPositions, camionesConGps })

  const limite = new Date()
  limite.setDate(limite.getDate() - DIAS_RETENCION_REPORTES)
  const reportesAntiguos = await prisma.reporteChofer.count({ where: { createdAt: { lte: limite } } })
  add(results, reportesAntiguos === 0, `reportes/novedades cumplen retencion de ${DIAS_RETENCION_REPORTES} dias`, { reportesAntiguos })

  const rlsRows = await prisma.$queryRawUnsafe(`
    SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relname IN (${sqlStringList(REQUIRED_RLS_TABLES)})
    ORDER BY c.relname
  `)
  const rlsMap = new Map(rlsRows.map((row) => [row.table_name, row.rls_enabled]))
  const missingRls = REQUIRED_RLS_TABLES.filter((table) => rlsMap.get(table) !== true)
  add(results, missingRls.length === 0, 'RLS habilitado en tablas operativas', missingRls)

  const exposedGrants = await prisma.$queryRawUnsafe(`
    SELECT table_name, grantee, privilege_type
    FROM information_schema.role_table_grants
    WHERE table_schema = 'public'
      AND grantee IN ('anon', 'authenticated', 'PUBLIC')
      AND table_name IN (${sqlStringList(REQUIRED_RLS_TABLES)})
    ORDER BY table_name, grantee, privilege_type
  `)
  add(results, exposedGrants.length === 0, 'anon/authenticated/PUBLIC sin privilegios directos sobre tablas sensibles', exposedGrants)

  const realtimeTables = await prisma.$queryRawUnsafe(`
    SELECT tablename
    FROM pg_publication_tables
    WHERE schemaname = 'public'
      AND pubname = 'supabase_realtime'
  `)
  const realtimeNames = realtimeTables.map((row) => row.tablename)
  add(results, !realtimeNames.includes('truck_positions'), 'truck_positions no esta publicado directo en Supabase Realtime', realtimeNames)

  const serviceRoleHits = staticFrontendScan()
  add(results, serviceRoleHits.length === 0, 'SERVICE_ROLE_KEY no aparece en frontend', serviceRoleHits)

  const failed = results.filter((item) => !item.ok)
  for (const item of results) {
    console.log(`${item.ok ? 'OK' : 'FAIL'} - ${item.message}`)
    if (item.detail && (!Array.isArray(item.detail) || item.detail.length > 0)) {
      console.log(JSON.stringify(item.detail, null, 2))
    }
  }

  if (failed.length > 0) {
    console.error(`Chequeo productivo fallo: ${failed.length} punto(s) requieren atencion.`)
    process.exitCode = 1
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
