-- AlterTable
ALTER TABLE "User" ADD COLUMN "username" TEXT,
                   ADD COLUMN "googleId" TEXT,
                   ALTER COLUMN "password" SET DEFAULT '',
                   ALTER COLUMN "prenom" SET DEFAULT '';

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");
