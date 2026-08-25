ALTER TABLE IF EXISTS "usuarios" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "choferes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "camiones" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "choferes_unidades" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "truck_positions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "mantenimientos_vehiculos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "viajes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "viajes_unidades" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "paradas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "reportes_chofer" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "retornables" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "retornables_movimientos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "gastos" ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE "usuarios" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE "choferes" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE "camiones" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE "choferes_unidades" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE "truck_positions" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE "mantenimientos_vehiculos" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE "viajes" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE "viajes_unidades" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE "paradas" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE "reportes_chofer" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE "retornables" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE "retornables_movimientos" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE "gastos" FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "truck_positions_select_anon" ON "truck_positions";
REVOKE SELECT ON TABLE "truck_positions" FROM anon;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime DROP TABLE "truck_positions";
EXCEPTION
  WHEN undefined_object THEN null;
  WHEN undefined_table THEN null;
END $$;
