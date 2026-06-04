ALTER TABLE "viajes" ADD COLUMN "honorarios_chofer" DECIMAL(65,30) NOT NULL DEFAULT 0;
ALTER TABLE "viajes" ADD COLUMN "fecha_liquidacion" TIMESTAMP(3);
