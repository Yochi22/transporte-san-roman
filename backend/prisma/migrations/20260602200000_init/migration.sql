-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('ADMIN', 'OPERACIONES');

-- CreateEnum
CREATE TYPE "EstadoCamion" AS ENUM ('DISPONIBLE', 'EN_RUTA', 'EN_TALLER');

-- CreateEnum
CREATE TYPE "EstadoChofer" AS ENUM ('DISPONIBLE', 'EN_RUTA', 'DESCANSO');

-- CreateEnum
CREATE TYPE "EstadoLogistico" AS ENUM ('PENDIENTE', 'EN_CURSO', 'COMPLETADO');

-- CreateEnum
CREATE TYPE "EstadoFinanciero" AS ENUM ('PENDIENTE', 'LIQUIDADO');

-- CreateEnum
CREATE TYPE "TipoParada" AS ENUM ('CARGA', 'DESCARGA', 'PERNOCTA');

-- CreateEnum
CREATE TYPE "EstadoParada" AS ENUM ('PENDIENTE', 'EN_CURSO', 'COMPLETADA');

-- CreateEnum
CREATE TYPE "TipoReporte" AS ENUM ('CARGANDO', 'EN_RUTA', 'EN_PERNOCTA', 'DESCARGADO', 'ESPERANDO_INSTRUCCIONES', 'LIBRE', 'OTRO');

-- CreateEnum
CREATE TYPE "TipoGasto" AS ENUM ('COMBUSTIBLE', 'PEAJE', 'COMIDA', 'HOSPEDAJE', 'REPARACION', 'OTRO');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "rol" "Rol" NOT NULL DEFAULT 'OPERACIONES',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "choferes" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "whatsapp_chat_id" TEXT,
    "licencia" TEXT,
    "estado" "EstadoChofer" NOT NULL DEFAULT 'DISPONIBLE',
    "ubicacion_actual" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "choferes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "camiones" (
    "id" TEXT NOT NULL,
    "placa" TEXT NOT NULL,
    "marca_modelo" TEXT NOT NULL,
    "estado" "EstadoCamion" NOT NULL DEFAULT 'DISPONIBLE',
    "motivo_taller" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "camiones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "viajes" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "camion_id" TEXT NOT NULL,
    "chofer_id" TEXT NOT NULL,
    "creado_por_id" TEXT NOT NULL,
    "estado_logistico" "EstadoLogistico" NOT NULL DEFAULT 'PENDIENTE',
    "estado_financiero" "EstadoFinanciero" NOT NULL DEFAULT 'PENDIENTE',
    "viaticos_depositados" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "viaticos_gastados" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "observaciones" TEXT,
    "fecha_inicio" TIMESTAMP(3),
    "fecha_cierre" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "viajes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paradas" (
    "id" TEXT NOT NULL,
    "viaje_id" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "tipo" "TipoParada" NOT NULL,
    "lugar" TEXT NOT NULL,
    "ciudad" TEXT NOT NULL,
    "descripcion_carga" TEXT,
    "estado" "EstadoParada" NOT NULL DEFAULT 'PENDIENTE',
    "completada_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "paradas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reportes_chofer" (
    "id" TEXT NOT NULL,
    "viaje_id" TEXT NOT NULL,
    "chofer_id" TEXT NOT NULL,
    "mensaje_original" TEXT NOT NULL,
    "tipo_reporte" "TipoReporte" NOT NULL,
    "ubicacion" TEXT,
    "procesado_por_ia" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reportes_chofer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gastos" (
    "id" TEXT NOT NULL,
    "viaje_id" TEXT NOT NULL,
    "chofer_id" TEXT NOT NULL,
    "tipo" "TipoGasto" NOT NULL,
    "monto" DECIMAL(65,30) NOT NULL,
    "descripcion" TEXT,
    "comprobante_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gastos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "choferes_usuario_id_key" ON "choferes"("usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "choferes_telefono_key" ON "choferes"("telefono");

-- CreateIndex
CREATE UNIQUE INDEX "camiones_placa_key" ON "camiones"("placa");

-- CreateIndex
CREATE UNIQUE INDEX "viajes_codigo_key" ON "viajes"("codigo");

-- AddForeignKey
ALTER TABLE "choferes" ADD CONSTRAINT "choferes_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "viajes" ADD CONSTRAINT "viajes_camion_id_fkey" FOREIGN KEY ("camion_id") REFERENCES "camiones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "viajes" ADD CONSTRAINT "viajes_chofer_id_fkey" FOREIGN KEY ("chofer_id") REFERENCES "choferes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "viajes" ADD CONSTRAINT "viajes_creado_por_id_fkey" FOREIGN KEY ("creado_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paradas" ADD CONSTRAINT "paradas_viaje_id_fkey" FOREIGN KEY ("viaje_id") REFERENCES "viajes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reportes_chofer" ADD CONSTRAINT "reportes_chofer_viaje_id_fkey" FOREIGN KEY ("viaje_id") REFERENCES "viajes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reportes_chofer" ADD CONSTRAINT "reportes_chofer_chofer_id_fkey" FOREIGN KEY ("chofer_id") REFERENCES "choferes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gastos" ADD CONSTRAINT "gastos_viaje_id_fkey" FOREIGN KEY ("viaje_id") REFERENCES "viajes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gastos" ADD CONSTRAINT "gastos_chofer_id_fkey" FOREIGN KEY ("chofer_id") REFERENCES "choferes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
