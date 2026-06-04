ALTER TABLE "viajes" ADD COLUMN "numero_guia" TEXT;
CREATE UNIQUE INDEX "viajes_numero_guia_key" ON "viajes"("numero_guia");
