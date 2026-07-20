CREATE TABLE IF NOT EXISTS "viajes_unidades" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "viaje_id" TEXT NOT NULL,
  "camion_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "viajes_unidades_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "viajes_unidades_viaje_id_camion_id_key" ON "viajes_unidades"("viaje_id", "camion_id");
CREATE INDEX IF NOT EXISTS "viajes_unidades_camion_id_idx" ON "viajes_unidades"("camion_id");

ALTER TABLE "viajes_unidades"
  ADD CONSTRAINT "viajes_unidades_viaje_id_fkey"
  FOREIGN KEY ("viaje_id") REFERENCES "viajes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "viajes_unidades"
  ADD CONSTRAINT "viajes_unidades_camion_id_fkey"
  FOREIGN KEY ("camion_id") REFERENCES "camiones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "viajes_unidades" ("id", "viaje_id", "camion_id")
SELECT gen_random_uuid()::text, "id", "camion_id"
FROM "viajes"
ON CONFLICT ("viaje_id", "camion_id") DO NOTHING;

ALTER TABLE "viajes_unidades" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "viajes_unidades" FROM PUBLIC, anon, authenticated;
