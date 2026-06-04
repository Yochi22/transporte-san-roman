CREATE TYPE "TipoMantenimiento" AS ENUM ('REPARACION', 'CAMBIO_ACEITE', 'CAUCHOS', 'FRENOS', 'BATERIA', 'REVISION', 'OTRO');
CREATE TYPE "EstadoMantenimiento" AS ENUM ('EN_PROCESO', 'COMPLETADO');

CREATE TABLE "mantenimientos_vehiculos" (
  "id" TEXT NOT NULL,
  "camion_id" TEXT NOT NULL,
  "tipo" "TipoMantenimiento" NOT NULL,
  "estado" "EstadoMantenimiento" NOT NULL DEFAULT 'EN_PROCESO',
  "falla" TEXT NOT NULL,
  "descripcion" TEXT,
  "kilometraje" INTEGER,
  "costo" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "fecha_ingreso" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "fecha_salida" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "mantenimientos_vehiculos_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "mantenimientos_vehiculos"
ADD CONSTRAINT "mantenimientos_vehiculos_camion_id_fkey"
FOREIGN KEY ("camion_id") REFERENCES "camiones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
