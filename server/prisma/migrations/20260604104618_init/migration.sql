-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('FREE', 'PRO', 'ENTREPRISE', 'ECOLE');

-- CreateEnum
CREATE TYPE "PackTier" AS ENUM ('GRATUIT', 'PREMIUM', 'ENTREPRISE', 'EVENEMENT', 'ECOLE');

-- CreateEnum
CREATE TYPE "SubscriptionStatut" AS ENUM ('PENDING', 'ACTIVE', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaiementStatut" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PartieStatus" AS ENUM ('EN_ATTENTE', 'EN_COURS', 'TERMINEE', 'ANNULEE');

-- CreateEnum
CREATE TYPE "BuzzerStatus" AS ENUM ('OFFLINE', 'ONLINE', 'IN_GAME', 'AWAITING_CLAIM');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('BUZZER', 'QCM', 'VRAI_FAUX', 'IMAGE', 'AUDIO', 'VIDEO');

-- CreateEnum
CREATE TYPE "Difficulte" AS ENUM ('FACILE', 'MOYEN', 'DIFFICILE');

-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('IMAGE', 'AUDIO', 'VIDEO');

-- CreateEnum
CREATE TYPE "PackStatut" AS ENUM ('ACTIF', 'INACTIF', 'ARCHIVE');

-- CreateEnum
CREATE TYPE "PackContentMode" AS ENUM ('DYNAMIQUE', 'MANUEL');

-- CreateEnum
CREATE TYPE "PackDuree" AS ENUM ('RAPIDE', 'STANDARD', 'LONGUE');

-- CreateEnum
CREATE TYPE "OffreCategorie" AS ENUM ('PERSONNEL', 'ORGANISATION');

-- CreateEnum
CREATE TYPE "OrgType" AS ENUM ('ENTREPRISE', 'ECOLE', 'UNIVERSITE', 'ASSOCIATION', 'ONG', 'COLLECTIVITE');

-- CreateEnum
CREATE TYPE "OrgStatut" AS ENUM ('ACTIVE', 'SUSPENDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "OrgRole" AS ENUM ('RESPONSABLE', 'GESTIONNAIRE', 'MEMBRE');

-- CreateEnum
CREATE TYPE "MembreStatut" AS ENUM ('ACTIF', 'SUSPENDU');

-- CreateEnum
CREATE TYPE "InvitStatut" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL DEFAULT '',
    "prenom" TEXT NOT NULL DEFAULT '',
    "nom" TEXT,
    "username" TEXT,
    "telephone" TEXT,
    "avatarUrl" TEXT,
    "theme" TEXT NOT NULL DEFAULT 'dark',
    "langue" TEXT NOT NULL DEFAULT 'fr',
    "googleId" TEXT,
    "plan" "Plan" NOT NULL DEFAULT 'FREE',
    "planStartedAt" TIMESTAMP(3),
    "planExpireAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isGuest" BOOLEAN NOT NULL DEFAULT false,
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Media" (
    "id" TEXT NOT NULL,
    "type" "MediaType" NOT NULL,
    "url" TEXT NOT NULL,
    "thumbUrl" TEXT,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "titre" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "duration" INTEGER,
    "tags" TEXT[],
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Partie" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" "PartieStatus" NOT NULL DEFAULT 'EN_ATTENTE',
    "animateurId" TEXT,
    "creatorId" TEXT,
    "modeAuto" BOOLEAN NOT NULL DEFAULT false,
    "modeVote" BOOLEAN NOT NULL DEFAULT false,
    "masquerReponses" BOOLEAN NOT NULL DEFAULT false,
    "timerBuzz" INTEGER NOT NULL DEFAULT 10,
    "timerVote" INTEGER NOT NULL DEFAULT 15,
    "packId" TEXT,
    "packNom" TEXT,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Partie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameEvent" (
    "id" TEXT NOT NULL,
    "partieId" TEXT NOT NULL,
    "questionIndex" INTEGER NOT NULL,
    "questionId" TEXT,
    "participantId" TEXT,
    "type" TEXT NOT NULL,
    "valide" BOOLEAN,
    "responseMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Participant" (
    "id" TEXT NOT NULL,
    "partieId" TEXT NOT NULL,
    "userId" TEXT,
    "prenom" TEXT NOT NULL,
    "buzzerId" TEXT,
    "isAnimateur" BOOLEAN NOT NULL DEFAULT false,
    "score" INTEGER NOT NULL DEFAULT 0,
    "rang" INTEGER,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Participant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Buzzer" (
    "id" TEXT NOT NULL,
    "mac" TEXT NOT NULL,
    "nom" TEXT,
    "couleur" TEXT NOT NULL DEFAULT '#3B82F6',
    "ownerId" TEXT,
    "claimedAt" TIMESTAMP(3),
    "status" "BuzzerStatus" NOT NULL DEFAULT 'OFFLINE',
    "lastSeenAt" TIMESTAMP(3),
    "firmware" TEXT,
    "battery" INTEGER,
    "rssi" INTEGER,
    "lastTelemetryAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Buzzer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vote" (
    "id" TEXT NOT NULL,
    "partieId" TEXT NOT NULL,
    "questionIndex" INTEGER NOT NULL,
    "participantId" TEXT NOT NULL,
    "valide" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Paiement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "montant" INTEGER NOT NULL,
    "devise" TEXT NOT NULL DEFAULT 'XOF',
    "statut" "PaiementStatut" NOT NULL DEFAULT 'PENDING',
    "plan" "Plan",
    "offreId" TEXT,
    "packId" TEXT,
    "description" TEXT,
    "operateur" TEXT,
    "transactionId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Paiement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "plan" "Plan" NOT NULL,
    "offreId" TEXT,
    "statut" "SubscriptionStatut" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "montant" INTEGER NOT NULL DEFAULT 0,
    "reference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackRating" (
    "id" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "note" INTEGER NOT NULL,
    "commentaire" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PackRating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userAgent" TEXT,
    "ip" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Categorie" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "emoji" TEXT,
    "description" TEXT,
    "publique" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Categorie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rubrique" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "categorieId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Rubrique_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "enonce" TEXT NOT NULL,
    "type" "QuestionType" NOT NULL DEFAULT 'BUZZER',
    "reponse" TEXT NOT NULL,
    "indice" TEXT,
    "choix" TEXT[],
    "points" INTEGER NOT NULL DEFAULT 100,
    "tempsLimite" INTEGER NOT NULL DEFAULT 30,
    "mediaUrl" TEXT,
    "videoUrl" TEXT,
    "videoDebut" INTEGER,
    "videoFin" INTEGER,
    "audioUrl" TEXT,
    "explication" TEXT,
    "source" TEXT,
    "tags" TEXT[],
    "difficulte" "Difficulte" NOT NULL DEFAULT 'MOYEN',
    "publique" BOOLEAN NOT NULL DEFAULT false,
    "categorieId" TEXT,
    "rubriqueId" TEXT,
    "mediaId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Manche" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL,
    "partieId" TEXT NOT NULL,
    "pointsParQ" INTEGER NOT NULL DEFAULT 100,
    "tempsLimite" INTEGER NOT NULL DEFAULT 30,
    "theme" TEXT NOT NULL DEFAULT 'MELANGE',
    "difficulte" TEXT NOT NULL DEFAULT 'MIXTE',
    "nbQuestions" INTEGER NOT NULL DEFAULT 10,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Manche_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MancheQuestion" (
    "id" TEXT NOT NULL,
    "mancheId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MancheQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pack" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "emoji" TEXT,
    "couleur" TEXT NOT NULL DEFAULT '#6366F1',
    "imageUrl" TEXT,
    "banniereUrl" TEXT,
    "categorie" TEXT,
    "tags" TEXT[],
    "difficulte" TEXT NOT NULL DEFAULT 'MIXTE',
    "duree" "PackDuree" NOT NULL DEFAULT 'STANDARD',
    "categories" TEXT[],
    "typesAutorises" TEXT[],
    "modeRecommande" TEXT NOT NULL DEFAULT 'animateur',
    "contentMode" "PackContentMode" NOT NULL DEFAULT 'DYNAMIQUE',
    "nbManches" INTEGER NOT NULL DEFAULT 2,
    "nbQuestions" INTEGER NOT NULL DEFAULT 10,
    "tempsParQuestion" INTEGER NOT NULL DEFAULT 30,
    "pointsParQuestion" INTEGER NOT NULL DEFAULT 100,
    "tier" "PackTier" NOT NULL DEFAULT 'GRATUIT',
    "prix" INTEGER NOT NULL DEFAULT 0,
    "noteMoyenne" DOUBLE PRECISION,
    "nbAvis" INTEGER NOT NULL DEFAULT 0,
    "priorite" INTEGER NOT NULL DEFAULT 50,
    "vedette" BOOLEAN NOT NULL DEFAULT false,
    "signature" BOOLEAN NOT NULL DEFAULT false,
    "statut" "PackStatut" NOT NULL DEFAULT 'ACTIF',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackQuestion" (
    "id" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "manche" INTEGER NOT NULL DEFAULT 1,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PackQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Offre" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "categorie" "OffreCategorie" NOT NULL DEFAULT 'PERSONNEL',
    "plan" "Plan" NOT NULL DEFAULT 'FREE',
    "prix" INTEGER NOT NULL DEFAULT 0,
    "dureeJours" INTEGER NOT NULL DEFAULT 30,
    "sieges" INTEGER NOT NULL DEFAULT 1,
    "quotas" JSONB,
    "fonctionnalites" TEXT[],
    "couleur" TEXT NOT NULL DEFAULT '#6366F1',
    "populaire" BOOLEAN NOT NULL DEFAULT false,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Offre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organisation" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "type" "OrgType" NOT NULL DEFAULT 'ENTREPRISE',
    "ownerId" TEXT NOT NULL,
    "offreId" TEXT,
    "plan" "Plan" NOT NULL DEFAULT 'ENTREPRISE',
    "sieges" INTEGER NOT NULL DEFAULT 0,
    "statut" "OrgStatut" NOT NULL DEFAULT 'ACTIVE',
    "expireAt" TIMESTAMP(3),
    "inviteToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organisation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganisationMembre" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "OrgRole" NOT NULL DEFAULT 'MEMBRE',
    "statut" "MembreStatut" NOT NULL DEFAULT 'ACTIF',
    "groupeId" TEXT,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganisationMembre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganisationGroupe" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganisationGroupe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "email" TEXT,
    "token" TEXT NOT NULL,
    "role" "OrgRole" NOT NULL DEFAULT 'MEMBRE',
    "statut" "InvitStatut" NOT NULL DEFAULT 'PENDING',
    "invitedById" TEXT,
    "acceptedByUserId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");

-- CreateIndex
CREATE UNIQUE INDEX "Media_sha256_key" ON "Media"("sha256");

-- CreateIndex
CREATE INDEX "Media_type_idx" ON "Media"("type");

-- CreateIndex
CREATE UNIQUE INDEX "Partie_code_key" ON "Partie"("code");

-- CreateIndex
CREATE INDEX "GameEvent_partieId_idx" ON "GameEvent"("partieId");

-- CreateIndex
CREATE UNIQUE INDEX "Participant_partieId_userId_key" ON "Participant"("partieId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Buzzer_mac_key" ON "Buzzer"("mac");

-- CreateIndex
CREATE UNIQUE INDEX "Vote_partieId_questionIndex_participantId_key" ON "Vote"("partieId", "questionIndex", "participantId");

-- CreateIndex
CREATE UNIQUE INDEX "Paiement_reference_key" ON "Paiement"("reference");

-- CreateIndex
CREATE INDEX "Paiement_userId_idx" ON "Paiement"("userId");

-- CreateIndex
CREATE INDEX "Paiement_statut_idx" ON "Paiement"("statut");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_reference_key" ON "Subscription"("reference");

-- CreateIndex
CREATE INDEX "Subscription_userId_idx" ON "Subscription"("userId");

-- CreateIndex
CREATE INDEX "Subscription_statut_idx" ON "Subscription"("statut");

-- CreateIndex
CREATE INDEX "PackRating_packId_idx" ON "PackRating"("packId");

-- CreateIndex
CREATE UNIQUE INDEX "PackRating_packId_userId_key" ON "PackRating"("packId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_token_key" ON "RefreshToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "Categorie_nom_key" ON "Categorie"("nom");

-- CreateIndex
CREATE UNIQUE INDEX "MancheQuestion_mancheId_ordre_key" ON "MancheQuestion"("mancheId", "ordre");

-- CreateIndex
CREATE UNIQUE INDEX "MancheQuestion_mancheId_questionId_key" ON "MancheQuestion"("mancheId", "questionId");

-- CreateIndex
CREATE UNIQUE INDEX "Pack_slug_key" ON "Pack"("slug");

-- CreateIndex
CREATE INDEX "Pack_statut_idx" ON "Pack"("statut");

-- CreateIndex
CREATE INDEX "Pack_priorite_idx" ON "Pack"("priorite");

-- CreateIndex
CREATE INDEX "Pack_tier_idx" ON "Pack"("tier");

-- CreateIndex
CREATE INDEX "PackQuestion_packId_idx" ON "PackQuestion"("packId");

-- CreateIndex
CREATE UNIQUE INDEX "PackQuestion_packId_questionId_key" ON "PackQuestion"("packId", "questionId");

-- CreateIndex
CREATE UNIQUE INDEX "Offre_code_key" ON "Offre"("code");

-- CreateIndex
CREATE INDEX "Offre_categorie_idx" ON "Offre"("categorie");

-- CreateIndex
CREATE UNIQUE INDEX "Organisation_inviteToken_key" ON "Organisation"("inviteToken");

-- CreateIndex
CREATE INDEX "Organisation_ownerId_idx" ON "Organisation"("ownerId");

-- CreateIndex
CREATE INDEX "OrganisationMembre_organisationId_idx" ON "OrganisationMembre"("organisationId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganisationMembre_organisationId_userId_key" ON "OrganisationMembre"("organisationId", "userId");

-- CreateIndex
CREATE INDEX "OrganisationGroupe_organisationId_idx" ON "OrganisationGroupe"("organisationId");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_token_key" ON "Invitation"("token");

-- CreateIndex
CREATE INDEX "Invitation_organisationId_idx" ON "Invitation"("organisationId");

-- AddForeignKey
ALTER TABLE "Media" ADD CONSTRAINT "Media_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Partie" ADD CONSTRAINT "Partie_animateurId_fkey" FOREIGN KEY ("animateurId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameEvent" ADD CONSTRAINT "GameEvent_partieId_fkey" FOREIGN KEY ("partieId") REFERENCES "Partie"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Participant" ADD CONSTRAINT "Participant_partieId_fkey" FOREIGN KEY ("partieId") REFERENCES "Partie"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Participant" ADD CONSTRAINT "Participant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Participant" ADD CONSTRAINT "Participant_buzzerId_fkey" FOREIGN KEY ("buzzerId") REFERENCES "Buzzer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Buzzer" ADD CONSTRAINT "Buzzer_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_partieId_fkey" FOREIGN KEY ("partieId") REFERENCES "Partie"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Paiement" ADD CONSTRAINT "Paiement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackRating" ADD CONSTRAINT "PackRating_packId_fkey" FOREIGN KEY ("packId") REFERENCES "Pack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackRating" ADD CONSTRAINT "PackRating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rubrique" ADD CONSTRAINT "Rubrique_categorieId_fkey" FOREIGN KEY ("categorieId") REFERENCES "Categorie"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_categorieId_fkey" FOREIGN KEY ("categorieId") REFERENCES "Categorie"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_rubriqueId_fkey" FOREIGN KEY ("rubriqueId") REFERENCES "Rubrique"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Manche" ADD CONSTRAINT "Manche_partieId_fkey" FOREIGN KEY ("partieId") REFERENCES "Partie"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MancheQuestion" ADD CONSTRAINT "MancheQuestion_mancheId_fkey" FOREIGN KEY ("mancheId") REFERENCES "Manche"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MancheQuestion" ADD CONSTRAINT "MancheQuestion_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackQuestion" ADD CONSTRAINT "PackQuestion_packId_fkey" FOREIGN KEY ("packId") REFERENCES "Pack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackQuestion" ADD CONSTRAINT "PackQuestion_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Organisation" ADD CONSTRAINT "Organisation_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganisationMembre" ADD CONSTRAINT "OrganisationMembre_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganisationMembre" ADD CONSTRAINT "OrganisationMembre_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganisationMembre" ADD CONSTRAINT "OrganisationMembre_groupeId_fkey" FOREIGN KEY ("groupeId") REFERENCES "OrganisationGroupe"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganisationGroupe" ADD CONSTRAINT "OrganisationGroupe_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
