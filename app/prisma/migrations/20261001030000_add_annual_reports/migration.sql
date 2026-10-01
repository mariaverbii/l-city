-- CreateTable
CREATE TABLE "AnnualReport" (
    "id" SERIAL NOT NULL,
    "houseId" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "publishedAt" TIMESTAMP(3),
    "orgFullName" TEXT DEFAULT 'ООО «Л-Сити»',
    "receptionAddress" TEXT,
    "ogrnOrInn" TEXT,
    "contactName" TEXT,
    "contactPhone" TEXT,
    "contactEmail" TEXT,
    "totalAreaSqm" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnnualReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnnualReportMaintenanceItem" (
    "id" SERIAL NOT NULL,
    "reportId" INTEGER NOT NULL,
    "completedWorkId" INTEGER,
    "workName" TEXT NOT NULL,
    "unit" TEXT,
    "unitPriceKopecks" INTEGER,
    "planQuantity" DOUBLE PRECISION,
    "planCostKopecks" INTEGER,
    "actualQuantity" DOUBLE PRECISION,
    "actualCostKopecks" INTEGER,
    "categoryConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnnualReportMaintenanceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnnualReportRepairItem" (
    "id" SERIAL NOT NULL,
    "reportId" INTEGER NOT NULL,
    "completedWorkId" INTEGER,
    "workName" TEXT NOT NULL,
    "basis" TEXT,
    "costKopecks" INTEGER NOT NULL,
    "volumeWithUnit" TEXT,
    "actReference" TEXT,
    "categoryConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnnualReportRepairItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AnnualReportMaintenanceItem_completedWorkId_key" ON "AnnualReportMaintenanceItem"("completedWorkId");

-- CreateIndex
CREATE INDEX "AnnualReportMaintenanceItem_reportId_idx" ON "AnnualReportMaintenanceItem"("reportId");

-- CreateIndex
CREATE UNIQUE INDEX "AnnualReportRepairItem_completedWorkId_key" ON "AnnualReportRepairItem"("completedWorkId");

-- CreateIndex
CREATE INDEX "AnnualReportRepairItem_reportId_idx" ON "AnnualReportRepairItem"("reportId");

-- CreateIndex
CREATE UNIQUE INDEX "AnnualReport_houseId_year_key" ON "AnnualReport"("houseId", "year");

-- CreateIndex
CREATE INDEX "AnnualReport_houseId_idx" ON "AnnualReport"("houseId");

-- AddForeignKey
ALTER TABLE "AnnualReport" ADD CONSTRAINT "AnnualReport_houseId_fkey" FOREIGN KEY ("houseId") REFERENCES "House"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnualReportMaintenanceItem" ADD CONSTRAINT "AnnualReportMaintenanceItem_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "AnnualReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnualReportMaintenanceItem" ADD CONSTRAINT "AnnualReportMaintenanceItem_completedWorkId_fkey" FOREIGN KEY ("completedWorkId") REFERENCES "CompletedWork"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnualReportRepairItem" ADD CONSTRAINT "AnnualReportRepairItem_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "AnnualReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnualReportRepairItem" ADD CONSTRAINT "AnnualReportRepairItem_completedWorkId_fkey" FOREIGN KEY ("completedWorkId") REFERENCES "CompletedWork"("id") ON DELETE SET NULL ON UPDATE CASCADE;

