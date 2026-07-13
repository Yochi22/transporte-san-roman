CREATE INDEX IF NOT EXISTS "choferes_estado_activo_idx"
ON "choferes"("estado", "activo");

CREATE INDEX IF NOT EXISTS "camiones_estado_activo_idx"
ON "camiones"("estado", "activo");

CREATE INDEX IF NOT EXISTS "truck_positions_updated_at_idx"
ON "truck_positions"("updated_at");

CREATE INDEX IF NOT EXISTS "mantenimientos_vehiculos_camion_id_fecha_ingreso_idx"
ON "mantenimientos_vehiculos"("camion_id", "fecha_ingreso");

CREATE INDEX IF NOT EXISTS "mantenimientos_vehiculos_estado_idx"
ON "mantenimientos_vehiculos"("estado");

CREATE INDEX IF NOT EXISTS "viajes_estado_logistico_estado_financiero_idx"
ON "viajes"("estado_logistico", "estado_financiero");

CREATE INDEX IF NOT EXISTS "viajes_camion_id_estado_logistico_idx"
ON "viajes"("camion_id", "estado_logistico");

CREATE INDEX IF NOT EXISTS "viajes_chofer_id_estado_logistico_idx"
ON "viajes"("chofer_id", "estado_logistico");

CREATE INDEX IF NOT EXISTS "viajes_created_at_idx"
ON "viajes"("created_at");

CREATE INDEX IF NOT EXISTS "paradas_viaje_id_orden_idx"
ON "paradas"("viaje_id", "orden");

CREATE INDEX IF NOT EXISTS "paradas_estado_idx"
ON "paradas"("estado");

CREATE INDEX IF NOT EXISTS "reportes_chofer_created_at_idx"
ON "reportes_chofer"("created_at");

CREATE INDEX IF NOT EXISTS "reportes_chofer_viaje_id_created_at_idx"
ON "reportes_chofer"("viaje_id", "created_at");

CREATE INDEX IF NOT EXISTS "reportes_chofer_chofer_id_created_at_idx"
ON "reportes_chofer"("chofer_id", "created_at");

CREATE INDEX IF NOT EXISTS "gastos_viaje_id_created_at_idx"
ON "gastos"("viaje_id", "created_at");

CREATE INDEX IF NOT EXISTS "gastos_chofer_id_created_at_idx"
ON "gastos"("chofer_id", "created_at");

DROP POLICY IF EXISTS "truck_positions_select_anon" ON "truck_positions";
REVOKE SELECT ON TABLE "truck_positions" FROM anon;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime DROP TABLE "truck_positions";
EXCEPTION
  WHEN undefined_object THEN null;
  WHEN undefined_table THEN null;
END $$;
