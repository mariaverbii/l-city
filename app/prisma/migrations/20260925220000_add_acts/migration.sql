-- CreateTable
CREATE TABLE "Act" (
    "id" SERIAL NOT NULL,
    "houseId" INTEGER NOT NULL,
    "number" TEXT,
    "signCity" TEXT NOT NULL DEFAULT 'д. Лаголово',
    "periodFrom" TIMESTAMP(3) NOT NULL,
    "periodTo" TIMESTAMP(3) NOT NULL,
    "customerName" TEXT,
    "customerBasis" TEXT,
    "customerApartment" TEXT,
    "agreementNumber" TEXT,
    "agreementDate" TIMESTAMP(3),
    "contractorName" TEXT NOT NULL DEFAULT 'ООО «Л-Сити»',
    "contractorPersonName" TEXT,
    "contractorPersonRole" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "signedAt" TIMESTAMP(3),
    "totalKopecks" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Act_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActLineItem" (
    "id" SERIAL NOT NULL,
    "actId" INTEGER NOT NULL,
    "completedWorkId" INTEGER,
    "workName" TEXT NOT NULL,
    "periodicity" TEXT NOT NULL,
    "unit" TEXT,
    "unitCostKopecks" INTEGER,
    "totalCostKopecks" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActChangeLogEntry" (
    "id" SERIAL NOT NULL,
    "actId" INTEGER NOT NULL,
    "field" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActChangeLogEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ActLineItem_completedWorkId_key" ON "ActLineItem"("completedWorkId");

-- CreateIndex
CREATE INDEX "Act_houseId_idx" ON "Act"("houseId");

-- CreateIndex
CREATE INDEX "ActLineItem_actId_idx" ON "ActLineItem"("actId");

-- CreateIndex
CREATE INDEX "ActChangeLogEntry_actId_idx" ON "ActChangeLogEntry"("actId");

-- AddForeignKey
ALTER TABLE "Act" ADD CONSTRAINT "Act_houseId_fkey" FOREIGN KEY ("houseId") REFERENCES "House"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActLineItem" ADD CONSTRAINT "ActLineItem_actId_fkey" FOREIGN KEY ("actId") REFERENCES "Act"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActLineItem" ADD CONSTRAINT "ActLineItem_completedWorkId_fkey" FOREIGN KEY ("completedWorkId") REFERENCES "CompletedWork"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActChangeLogEntry" ADD CONSTRAINT "ActChangeLogEntry_actId_fkey" FOREIGN KEY ("actId") REFERENCES "Act"("id") ON DELETE CASCADE ON UPDATE CASCADE;
