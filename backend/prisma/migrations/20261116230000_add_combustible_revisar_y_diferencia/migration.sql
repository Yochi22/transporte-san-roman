ALTER TYPE "ClasificacionRendimiento" ADD VALUE IF NOT EXISTS 'REVISAR';
ALTER TABLE "controles_combustible" ADD COLUMN "diferencia_nivel_apertura" DOUBLE PRECISION;
ALTER TABLE "controles_combustible" ADD COLUMN "nota_nivel_apertura" TEXT;
