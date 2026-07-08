DO $$ BEGIN
  CREATE TYPE "EstadoMotor" AS ENUM ('ENCENDIDO', 'APAGADO');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "camiones"
ADD COLUMN IF NOT EXISTS "gps_imei" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "camiones_gps_imei_key"
ON "camiones"("gps_imei");

CREATE TABLE IF NOT EXISTS "truck_positions" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "truck_id" TEXT NOT NULL,
  "latitude" DOUBLE PRECISION NOT NULL,
  "longitude" DOUBLE PRECISION NOT NULL,
  "speed" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "engine_status" "EstadoMotor",
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "truck_positions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "truck_positions_truck_id_fkey" FOREIGN KEY ("truck_id") REFERENCES "camiones"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "truck_positions_truck_id_key"
ON "truck_positions"("truck_id");

ALTER TABLE "truck_positions" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "truck_positions_select_anon" ON "truck_positions";
CREATE POLICY "truck_positions_select_anon"
ON "truck_positions"
FOR SELECT
TO anon
USING (true);

GRANT SELECT ON TABLE "truck_positions" TO anon;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE "truck_positions";
EXCEPTION
  WHEN duplicate_object THEN null;
  WHEN undefined_object THEN null;
END $$;
