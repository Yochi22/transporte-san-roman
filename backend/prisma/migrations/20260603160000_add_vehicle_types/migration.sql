CREATE TYPE "TipoVehiculo" AS ENUM ('NPR', 'TORONTO', 'FURGON');

ALTER TABLE "camiones" ADD COLUMN "tipo_vehiculo" "TipoVehiculo" NOT NULL DEFAULT 'NPR';
ALTER TABLE "camiones" ADD COLUMN "placa_furgon" TEXT;
ALTER TABLE "camiones" ADD COLUMN "placa_chuto" TEXT;

CREATE UNIQUE INDEX "camiones_placa_furgon_key" ON "camiones"("placa_furgon");
CREATE UNIQUE INDEX "camiones_placa_chuto_key" ON "camiones"("placa_chuto");
