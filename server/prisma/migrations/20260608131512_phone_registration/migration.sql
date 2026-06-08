-- Inscription / vérification par téléphone (OTP SMS).
ALTER TABLE "User" ADD COLUMN "phoneVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "phoneCode" TEXT;
ALTER TABLE "User" ADD COLUMN "phoneCodeExpiry" TIMESTAMP(3);
CREATE UNIQUE INDEX "User_telephone_key" ON "User"("telephone");
