-- AlterTable
ALTER TABLE "order" ADD COLUMN     "anonymizedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "reservation" ADD COLUMN     "anonymizedAt" TIMESTAMP(3);
