-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "maxUserId" TEXT;

-- CreateTable
CREATE TABLE "MaxBotSession" (
    "maxUserId" TEXT NOT NULL,
    "step" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaxBotSession_pkey" PRIMARY KEY ("maxUserId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Employee_maxUserId_key" ON "Employee"("maxUserId");
