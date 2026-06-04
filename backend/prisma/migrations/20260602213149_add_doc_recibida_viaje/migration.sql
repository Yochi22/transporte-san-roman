ALTER TABLE "paradas" ADD COLUMN     "comprobante_url" TEXT;

ALTER TABLE "viajes" ADD COLUMN     "documentacion_recibida" BOOLEAN NOT NULL DEFAULT false;
