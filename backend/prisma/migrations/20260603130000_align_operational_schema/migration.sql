ALTER TABLE "choferes" ADD COLUMN IF NOT EXISTS "cedula" TEXT;
ALTER TABLE "choferes" ADD COLUMN IF NOT EXISTS "ultimo_reporte_at" TIMESTAMP(3);
ALTER TABLE "camiones" ADD COLUMN IF NOT EXISTS "ubicacion_actual" TEXT DEFAULT 'Sede';

UPDATE "choferes"
SET "cedula" = 'PEND-' || SUBSTRING(MD5("id"), 1, 12)
WHERE "cedula" IS NULL OR "cedula" = '';

ALTER TABLE "choferes" ALTER COLUMN "cedula" SET NOT NULL;
ALTER TABLE "choferes" ALTER COLUMN "ubicacion_actual" SET DEFAULT 'Sede';

CREATE UNIQUE INDEX IF NOT EXISTS "choferes_cedula_key" ON "choferes"("cedula");
