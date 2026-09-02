-- CreateTable
CREATE TABLE "BuzzerEvent" (
    "id" TEXT NOT NULL,
    "mac" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "ip" TEXT,
    "ville" TEXT,
    "pays" TEXT,
    "firmware" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BuzzerEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BuzzerEvent_mac_idx" ON "BuzzerEvent"("mac");

-- CreateIndex
CREATE INDEX "BuzzerEvent_createdAt_idx" ON "BuzzerEvent"("createdAt");
