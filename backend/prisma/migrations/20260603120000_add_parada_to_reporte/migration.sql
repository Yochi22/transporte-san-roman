ALTER TABLE "reportes_chofer" ADD COLUMN "parada_id" TEXT;

ALTER TABLE "reportes_chofer"
ADD CONSTRAINT "reportes_chofer_parada_id_fkey"
FOREIGN KEY ("parada_id") REFERENCES "paradas"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
