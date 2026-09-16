-- CreateTable
CREATE TABLE "CompletedWork" (
    "id" SERIAL NOT NULL,
    "houseId" INTEGER NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "volume" TEXT NOT NULL,
    "materials" TEXT NOT NULL,
    "beforePhotoKey" TEXT,
    "beforePhotoType" TEXT,
    "afterPhotoKey" TEXT,
    "afterPhotoType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompletedWork_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompletedWork_houseId_idx" ON "CompletedWork"("houseId");

-- CreateIndex
CREATE INDEX "CompletedWork_employeeId_idx" ON "CompletedWork"("employeeId");

-- AddForeignKey
ALTER TABLE "CompletedWork" ADD CONSTRAINT "CompletedWork_houseId_fkey" FOREIGN KEY ("houseId") REFERENCES "House"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompletedWork" ADD CONSTRAINT "CompletedWork_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;