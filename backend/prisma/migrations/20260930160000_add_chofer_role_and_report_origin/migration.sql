ALTER TYPE "Rol" ADD VALUE IF NOT EXISTS 'CHOFER';

CREATE TYPE "OrigenReporte" AS ENUM ('WHATSAPP', 'APP');

ALTER TABLE "usuarios" ALTER COLUMN "email" DROP NOT NULL;
ALTER TABLE "usuarios" ADD COLUMN "username" TEXT;
ALTER TABLE "usuarios" ADD COLUMN "chofer_id" TEXT;

CREATE UNIQUE INDEX "usuarios_username_key" ON "usuarios"("username");
CREATE UNIQUE INDEX "usuarios_chofer_id_key" ON "usuarios"("chofer_id");

ALTER TABLE "usuarios"
ADD CONSTRAINT "usuarios_chofer_id_fkey"
FOREIGN KEY ("chofer_id") REFERENCES "choferes"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "reportes_chofer" ADD COLUMN "origen" "OrigenReporte" NOT NULL DEFAULT 'WHATSAPP';
