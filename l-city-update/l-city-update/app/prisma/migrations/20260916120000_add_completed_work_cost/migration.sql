-- AlterTable
ALTER TABLE "CompletedWork" ADD COLUMN     "costKopecks" INTEGER,
ADD COLUMN     "costConfirmed" BOOLEAN NOT NULL DEFAULT false;
