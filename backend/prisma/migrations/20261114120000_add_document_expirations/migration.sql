-- Vencimientos de documentos de choferes y unidades.
-- Aditiva: crea una tabla nueva y no modifica ninguna existente.

CREATE TABLE "documentos_vencimiento" (
    "id" TEXT NOT NULL,
    "chofer_id" TEXT,
    "camion_id" TEXT,
    "tipo" TEXT NOT NULL,
    "numero" TEXT,
    "fecha_vencimiento" DATE,
    "nota" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documentos_vencimiento_pkey" PRIMARY KEY ("id"),
    -- Cada documento pertenece a un chofer o a una unidad, nunca a ambos ni a ninguno.
    CONSTRAINT "documentos_vencimiento_dueno_check" CHECK (("chofer_id" IS NULL) <> ("camion_id" IS NULL))
);

CREATE UNIQUE INDEX "documentos_vencimiento_chofer_id_tipo_key" ON "documentos_vencimiento"("chofer_id", "tipo");
CREATE UNIQUE INDEX "documentos_vencimiento_camion_id_tipo_key" ON "documentos_vencimiento"("camion_id", "tipo");
CREATE INDEX "documentos_vencimiento_fecha_vencimiento_idx" ON "documentos_vencimiento"("fecha_vencimiento");

ALTER TABLE "documentos_vencimiento"
ADD CONSTRAINT "documentos_vencimiento_chofer_id_fkey"
FOREIGN KEY ("chofer_id") REFERENCES "choferes"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "documentos_vencimiento"
ADD CONSTRAINT "documentos_vencimiento_camion_id_fkey"
FOREIGN KEY ("camion_id") REFERENCES "camiones"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "documentos_vencimiento" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "documentos_vencimiento" FROM PUBLIC, anon, authenticated;
