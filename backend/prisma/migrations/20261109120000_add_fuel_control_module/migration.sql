CREATE TYPE "EstadoControlCombustible" AS ENUM ('ABIERTO', 'CERRADO');

CREATE TYPE "TipoEventoCombustible" AS ENUM ('RECARGA_TRANSPORTE', 'RECARGA_ESTACION', 'TRANSFERENCIA_SALIDA', 'TRANSFERENCIA_ENTRADA');

CREATE TYPE "ClasificacionRendimiento" AS ENUM ('OPTIMO', 'DEFICIENTE', 'CRITICO');

CREATE TABLE "configuraciones_combustible_camion" (
    "id" TEXT NOT NULL,
    "camion_id" TEXT NOT NULL,
    "umbral_optimo_km_litro" DOUBLE PRECISION NOT NULL,
    "umbral_deficiente_km_litro" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "configuraciones_combustible_camion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tanques_combustible" (
    "id" TEXT NOT NULL,
    "configuracion_id" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "capacidad_litros" DOUBLE PRECISION NOT NULL,
    CONSTRAINT "tanques_combustible_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "puntos_calibracion_tanque" (
    "id" TEXT NOT NULL,
    "tanque_id" TEXT NOT NULL,
    "altura_cm" DOUBLE PRECISION NOT NULL,
    "litros" DOUBLE PRECISION NOT NULL,
    CONSTRAINT "puntos_calibracion_tanque_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "controles_combustible" (
    "id" TEXT NOT NULL,
    "viaje_id" TEXT,
    "camion_id" TEXT NOT NULL,
    "chofer_id" TEXT,
    "estado" "EstadoControlCombustible" NOT NULL DEFAULT 'ABIERTO',
    "odometro_inicial" DOUBLE PRECISION NOT NULL,
    "lecturas_iniciales_tanques" JSONB NOT NULL,
    "litros_iniciales_total" DOUBLE PRECISION NOT NULL,
    "odometro_final" DOUBLE PRECISION,
    "lecturas_finales_tanques" JSONB,
    "litros_finales_total" DOUBLE PRECISION,
    "km_recorridos" DOUBLE PRECISION,
    "consumo_neto_litros" DOUBLE PRECISION,
    "rendimiento_km_litro" DOUBLE PRECISION,
    "clasificacion" "ClasificacionRendimiento",
    "creado_por_id" TEXT,
    "cerrado_por_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cerrado_at" TIMESTAMP(3),
    CONSTRAINT "controles_combustible_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "eventos_combustible" (
    "id" TEXT NOT NULL,
    "control_combustible_id" TEXT NOT NULL,
    "tipo" "TipoEventoCombustible" NOT NULL,
    "litros" DOUBLE PRECISION NOT NULL,
    "costo" DECIMAL(65,30),
    "moneda" TEXT,
    "ubicacion" TEXT,
    "observacion" TEXT,
    "evento_vinculado_id" TEXT,
    "registrado_por_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "eventos_combustible_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "configuraciones_combustible_camion_camion_id_key" ON "configuraciones_combustible_camion"("camion_id");

CREATE UNIQUE INDEX "tanques_combustible_configuracion_id_numero_key" ON "tanques_combustible"("configuracion_id", "numero");

CREATE UNIQUE INDEX "puntos_calibracion_tanque_tanque_id_altura_cm_key" ON "puntos_calibracion_tanque"("tanque_id", "altura_cm");

CREATE INDEX "controles_combustible_camion_id_estado_idx" ON "controles_combustible"("camion_id", "estado");

CREATE INDEX "controles_combustible_chofer_id_idx" ON "controles_combustible"("chofer_id");

CREATE UNIQUE INDEX "eventos_combustible_evento_vinculado_id_key" ON "eventos_combustible"("evento_vinculado_id");

CREATE INDEX "eventos_combustible_control_combustible_id_created_at_idx" ON "eventos_combustible"("control_combustible_id", "created_at");

ALTER TABLE "configuraciones_combustible_camion" ADD CONSTRAINT "configuraciones_combustible_camion_camion_id_fkey" FOREIGN KEY ("camion_id") REFERENCES "camiones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "tanques_combustible" ADD CONSTRAINT "tanques_combustible_configuracion_id_fkey" FOREIGN KEY ("configuracion_id") REFERENCES "configuraciones_combustible_camion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "puntos_calibracion_tanque" ADD CONSTRAINT "puntos_calibracion_tanque_tanque_id_fkey" FOREIGN KEY ("tanque_id") REFERENCES "tanques_combustible"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "controles_combustible" ADD CONSTRAINT "controles_combustible_viaje_id_fkey" FOREIGN KEY ("viaje_id") REFERENCES "viajes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "controles_combustible" ADD CONSTRAINT "controles_combustible_camion_id_fkey" FOREIGN KEY ("camion_id") REFERENCES "camiones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "controles_combustible" ADD CONSTRAINT "controles_combustible_chofer_id_fkey" FOREIGN KEY ("chofer_id") REFERENCES "choferes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "eventos_combustible" ADD CONSTRAINT "eventos_combustible_control_combustible_id_fkey" FOREIGN KEY ("control_combustible_id") REFERENCES "controles_combustible"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "eventos_combustible" ADD CONSTRAINT "eventos_combustible_evento_vinculado_id_fkey" FOREIGN KEY ("evento_vinculado_id") REFERENCES "eventos_combustible"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "configuraciones_combustible_camion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tanques_combustible" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "puntos_calibracion_tanque" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "controles_combustible" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "eventos_combustible" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "configuraciones_combustible_camion" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE "tanques_combustible" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE "puntos_calibracion_tanque" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE "controles_combustible" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE "eventos_combustible" FROM PUBLIC, anon, authenticated;
