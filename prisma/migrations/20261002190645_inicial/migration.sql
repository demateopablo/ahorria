-- CreateEnum
CREATE TYPE "Moneda" AS ENUM ('ARS', 'USD');

-- CreateEnum
CREATE TYPE "TipoCuenta" AS ENUM ('efectivo', 'billetera', 'banco', 'tarjeta_credito', 'inversion');

-- CreateEnum
CREATE TYPE "TipoMovimiento" AS ENUM ('ingreso', 'gasto', 'transferencia');

-- CreateEnum
CREATE TYPE "TipoCategoria" AS ENUM ('gasto', 'ingreso');

-- CreateEnum
CREATE TYPE "Ambito" AS ENUM ('personal', 'compartido', 'negocio', 'familia');

-- CreateEnum
CREATE TYPE "EstadoMovimiento" AS ENUM ('confirmado', 'pendiente', 'omitido');

-- CreateEnum
CREATE TYPE "Frecuencia" AS ENUM ('mensual', 'bimestral', 'trimestral', 'semestral', 'anual');

-- CreateEnum
CREATE TYPE "TipoCotizacion" AS ENUM ('oficial', 'mep');

-- CreateTable
CREATE TABLE "Config" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "nombreHogar" TEXT NOT NULL,
    "monedaBase" "Moneda" NOT NULL DEFAULT 'ARS',
    "locale" TEXT NOT NULL DEFAULT 'es-AR',
    "timezone" TEXT NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',
    "umbralMargenBajo" DECIMAL(14,2) NOT NULL DEFAULT 0,

    CONSTRAINT "Config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Persona" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT,
    "color" TEXT NOT NULL DEFAULT '#16a34a',
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Persona_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cuenta" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoCuenta" NOT NULL,
    "moneda" "Moneda" NOT NULL DEFAULT 'ARS',
    "titularId" TEXT NOT NULL,
    "saldoInicial" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "fechaSaldoInicial" DATE,
    "tna" DECIMAL(7,2),
    "diaCierre" INTEGER,
    "diaVencimiento" INTEGER,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "archivada" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Cuenta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Categoria" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoCategoria" NOT NULL DEFAULT 'gasto',
    "padreId" TEXT,
    "icono" TEXT NOT NULL DEFAULT 'circle',
    "color" TEXT NOT NULL DEFAULT '#64748b',
    "ambitoDefault" "Ambito" NOT NULL DEFAULT 'compartido',
    "orden" INTEGER NOT NULL DEFAULT 0,
    "archivada" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Categoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Movimiento" (
    "id" TEXT NOT NULL,
    "tipo" "TipoMovimiento" NOT NULL,
    "estado" "EstadoMovimiento" NOT NULL DEFAULT 'confirmado',
    "monto" DECIMAL(14,2) NOT NULL,
    "moneda" "Moneda" NOT NULL DEFAULT 'ARS',
    "cotizacion" DECIMAL(14,4),
    "fechaConsumo" DATE NOT NULL,
    "fechaImpacto" DATE NOT NULL,
    "categoriaId" TEXT,
    "duenoId" TEXT NOT NULL,
    "ambito" "Ambito" NOT NULL DEFAULT 'compartido',
    "cuentaId" TEXT NOT NULL,
    "cuentaDestinoId" TEXT,
    "nota" TEXT,
    "etiquetas" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "recurrenciaId" TEXT,
    "periodo" TEXT,
    "planCuotasId" TEXT,
    "numeroCuota" INTEGER,
    "creadoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Movimiento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recurrencia" (
    "id" TEXT NOT NULL,
    "concepto" TEXT NOT NULL,
    "tipo" "TipoMovimiento" NOT NULL,
    "montoEstimado" DECIMAL(14,2) NOT NULL,
    "montoMin" DECIMAL(14,2),
    "montoMax" DECIMAL(14,2),
    "moneda" "Moneda" NOT NULL DEFAULT 'ARS',
    "frecuencia" "Frecuencia" NOT NULL DEFAULT 'mensual',
    "mesAncla" TEXT NOT NULL,
    "diaDelMes" INTEGER NOT NULL DEFAULT 1,
    "desde" DATE,
    "fechaFin" DATE,
    "reglaAjuste" TEXT,
    "categoriaId" TEXT,
    "duenoId" TEXT,
    "ambito" "Ambito" NOT NULL DEFAULT 'compartido',
    "cuentaId" TEXT NOT NULL,
    "etiquetas" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "nota" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "generadoHasta" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Recurrencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanCuotas" (
    "id" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "montoCuota" DECIMAL(14,2) NOT NULL,
    "cantidadCuotas" INTEGER NOT NULL,
    "cuotasPrevias" INTEGER NOT NULL DEFAULT 0,
    "primeraFechaImpacto" DATE NOT NULL,
    "fechaCompra" DATE,
    "cuentaId" TEXT NOT NULL,
    "categoriaId" TEXT,
    "duenoId" TEXT NOT NULL,
    "ambito" "Ambito" NOT NULL DEFAULT 'compartido',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanCuotas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evento" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "mes" INTEGER NOT NULL,
    "dia" INTEGER,
    "montoPresupuestado" DECIMAL(14,2) NOT NULL,
    "categoriaId" TEXT,
    "duenoId" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Evento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cotizacion" (
    "id" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "tipo" "TipoCotizacion" NOT NULL DEFAULT 'oficial',
    "valor" DECIMAL(14,4) NOT NULL,

    CONSTRAINT "Cotizacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Persona_email_key" ON "Persona"("email");

-- CreateIndex
CREATE INDEX "Movimiento_fechaImpacto_idx" ON "Movimiento"("fechaImpacto");

-- CreateIndex
CREATE INDEX "Movimiento_estado_idx" ON "Movimiento"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "Movimiento_recurrenciaId_periodo_key" ON "Movimiento"("recurrenciaId", "periodo");

-- CreateIndex
CREATE UNIQUE INDEX "Cotizacion_fecha_tipo_key" ON "Cotizacion"("fecha", "tipo");

-- AddForeignKey
ALTER TABLE "Cuenta" ADD CONSTRAINT "Cuenta_titularId_fkey" FOREIGN KEY ("titularId") REFERENCES "Persona"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Categoria" ADD CONSTRAINT "Categoria_padreId_fkey" FOREIGN KEY ("padreId") REFERENCES "Categoria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movimiento" ADD CONSTRAINT "Movimiento_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movimiento" ADD CONSTRAINT "Movimiento_duenoId_fkey" FOREIGN KEY ("duenoId") REFERENCES "Persona"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movimiento" ADD CONSTRAINT "Movimiento_cuentaId_fkey" FOREIGN KEY ("cuentaId") REFERENCES "Cuenta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movimiento" ADD CONSTRAINT "Movimiento_cuentaDestinoId_fkey" FOREIGN KEY ("cuentaDestinoId") REFERENCES "Cuenta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movimiento" ADD CONSTRAINT "Movimiento_recurrenciaId_fkey" FOREIGN KEY ("recurrenciaId") REFERENCES "Recurrencia"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movimiento" ADD CONSTRAINT "Movimiento_planCuotasId_fkey" FOREIGN KEY ("planCuotasId") REFERENCES "PlanCuotas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movimiento" ADD CONSTRAINT "Movimiento_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "Persona"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recurrencia" ADD CONSTRAINT "Recurrencia_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recurrencia" ADD CONSTRAINT "Recurrencia_duenoId_fkey" FOREIGN KEY ("duenoId") REFERENCES "Persona"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recurrencia" ADD CONSTRAINT "Recurrencia_cuentaId_fkey" FOREIGN KEY ("cuentaId") REFERENCES "Cuenta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanCuotas" ADD CONSTRAINT "PlanCuotas_cuentaId_fkey" FOREIGN KEY ("cuentaId") REFERENCES "Cuenta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanCuotas" ADD CONSTRAINT "PlanCuotas_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanCuotas" ADD CONSTRAINT "PlanCuotas_duenoId_fkey" FOREIGN KEY ("duenoId") REFERENCES "Persona"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evento" ADD CONSTRAINT "Evento_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evento" ADD CONSTRAINT "Evento_duenoId_fkey" FOREIGN KEY ("duenoId") REFERENCES "Persona"("id") ON DELETE SET NULL ON UPDATE CASCADE;
