ALTER TABLE "retornables"
ADD COLUMN IF NOT EXISTS "fecha_devolucion_total" TIMESTAMP(3);

UPDATE "retornables"
SET "fecha_devolucion_total" = "updated_at"
WHERE "estado" = 'DEVUELTO'
  AND "fecha_devolucion_total" IS NULL;

CREATE INDEX IF NOT EXISTS "retornables_estado_fecha_devolucion_total_idx"
ON "retornables"("estado", "fecha_devolucion_total");
