CREATE TABLE "empresas" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "empresas_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "empresas_sedes" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "ciudad" TEXT NOT NULL,
    "direccion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "empresas_sedes_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "viajes" ADD COLUMN "empresa_id" TEXT;
ALTER TABLE "paradas" ADD COLUMN "empresa_sede_id" TEXT;

CREATE UNIQUE INDEX "empresas_nombre_key" ON "empresas"("nombre");
CREATE INDEX "empresas_activo_nombre_idx" ON "empresas"("activo", "nombre");
CREATE UNIQUE INDEX "empresas_sedes_empresa_id_nombre_ciudad_key" ON "empresas_sedes"("empresa_id", "nombre", "ciudad");
CREATE INDEX "empresas_sedes_empresa_id_activo_idx" ON "empresas_sedes"("empresa_id", "activo");
CREATE INDEX "viajes_empresa_id_estado_logistico_estado_financiero_idx" ON "viajes"("empresa_id", "estado_logistico", "estado_financiero");
CREATE INDEX "paradas_empresa_sede_id_idx" ON "paradas"("empresa_sede_id");

ALTER TABLE "empresas_sedes"
ADD CONSTRAINT "empresas_sedes_empresa_id_fkey"
FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "viajes"
ADD CONSTRAINT "viajes_empresa_id_fkey"
FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "paradas"
ADD CONSTRAINT "paradas_empresa_sede_id_fkey"
FOREIGN KEY ("empresa_sede_id") REFERENCES "empresas_sedes"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "empresas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "empresas_sedes" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "empresas" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE "empresas_sedes" FROM PUBLIC, anon, authenticated;
