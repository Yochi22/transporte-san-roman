ALTER TYPE "TipoVehiculo" ADD VALUE IF NOT EXISTS 'CHUTO';
ALTER TYPE "TipoVehiculo" ADD VALUE IF NOT EXISTS 'CORTINERO';
ALTER TYPE "TipoVehiculo" ADD VALUE IF NOT EXISTS 'BATEA';

CREATE TABLE IF NOT EXISTS "choferes_unidades" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "chofer_id" TEXT NOT NULL,
  "camion_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "choferes_unidades_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "choferes_unidades_chofer_id_fkey" FOREIGN KEY ("chofer_id") REFERENCES "choferes"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "choferes_unidades_camion_id_fkey" FOREIGN KEY ("camion_id") REFERENCES "camiones"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "choferes_unidades_chofer_id_camion_id_key"
ON "choferes_unidades"("chofer_id", "camion_id");

CREATE INDEX IF NOT EXISTS "choferes_unidades_camion_id_idx"
ON "choferes_unidades"("camion_id");

ALTER TABLE "viajes"
ADD COLUMN IF NOT EXISTS "odometro_inicial" INTEGER,
ADD COLUMN IF NOT EXISTS "odometro_final" INTEGER,
ADD COLUMN IF NOT EXISTS "combustible_inicial" DECIMAL(65,30),
ADD COLUMN IF NOT EXISTS "combustible_final" DECIMAL(65,30);

ALTER TABLE "choferes_unidades" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "choferes_unidades" FROM PUBLIC, anon, authenticated;
