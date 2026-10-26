-- AlterTable
ALTER TABLE "Service" ADD COLUMN "noteRu" TEXT;
ALTER TABLE "Service" ADD COLUMN "noteUa" TEXT;

-- CreateTable
CREATE TABLE "PriceItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "serviceId" TEXT NOT NULL,
    "labelUa" TEXT NOT NULL,
    "labelRu" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "isSurcharge" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PriceItem_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "PriceItem_serviceId_sortOrder_idx" ON "PriceItem"("serviceId", "sortOrder");
