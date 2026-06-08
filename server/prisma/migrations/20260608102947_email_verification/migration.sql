-- Vérification d'email (inscription par email).
ALTER TABLE "User" ADD COLUMN "emailVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "verifyCode" TEXT;
ALTER TABLE "User" ADD COLUMN "verifyToken" TEXT;
ALTER TABLE "User" ADD COLUMN "verifyExpiry" TIMESTAMP(3);
CREATE UNIQUE INDEX "User_verifyToken_key" ON "User"("verifyToken");
