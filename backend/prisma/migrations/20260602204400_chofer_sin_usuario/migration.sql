/*
  Warnings:

  - You are about to drop the column `usuario_id` on the `choferes` table. All the data in the column will be lost.
  - Added the required column `nombre` to the `choferes` table without a default value. This is not possible if the table is not empty.

*/
ALTER TABLE "choferes" DROP CONSTRAINT "choferes_usuario_id_fkey";

DROP INDEX "choferes_usuario_id_key";

ALTER TABLE "choferes" DROP COLUMN "usuario_id",
ADD COLUMN     "nombre" TEXT NOT NULL;
