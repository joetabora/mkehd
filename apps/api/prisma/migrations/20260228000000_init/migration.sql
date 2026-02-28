-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'APPROVER');

-- CreateEnum
CREATE TYPE "SeasonType" AS ENUM ('INDOOR', 'OUTDOOR');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'READY', 'LIVE', 'DONE');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'DONE', 'BLOCKED');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('PLAYBOOK', 'CHECK_REQUEST', 'CASH_RECEIPT', 'W9', 'STAFF_AGREEMENT', 'ASSET');

-- CreateEnum
CREATE TYPE "StorageProvider" AS ENUM ('LOCAL', 'GDRIVE', 'ONEDRIVE');

-- CreateEnum
CREATE TYPE "IntegrationProvider" AS ENUM ('GOOGLE', 'MICROSOFT');

-- CreateEnum
CREATE TYPE "SyncJobType" AS ENUM ('CALENDAR_SYNC');

-- CreateEnum
CREATE TYPE "SyncJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ApprovalType" AS ENUM ('CHECK_REQUEST');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('QR_FORM');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "roles" "UserRole"[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "seasonType" "SeasonType" NOT NULL,
    "status" "EventStatus" NOT NULL DEFAULT 'DRAFT',
    "goalQrScans" INTEGER,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventTask" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3),
    "ownerUserId" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'TODO',
    "dependsOnId" TEXT,

    CONSTRAINT "EventTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "eventId" TEXT,
    "type" "DocumentType" NOT NULL,
    "storageKey" TEXT NOT NULL,
    "provider" "StorageProvider" NOT NULL DEFAULT 'LOCAL',
    "uploadedById" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "originalName" TEXT,
    "mimeType" TEXT,
    "externalId" TEXT,
    "externalUrl" TEXT,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Approval" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "type" "ApprovalType" NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "requestedById" TEXT NOT NULL,
    "approverEmail" TEXT NOT NULL,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Approval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadCapture" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "source" "LeadSource" NOT NULL,
    "contactRef" TEXT,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadCapture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "IntegrationProvider" NOT NULL,
    "providerAccountId" TEXT,
    "email" TEXT,
    "accessTokenEnc" TEXT NOT NULL,
    "refreshTokenEnc" TEXT,
    "tokenType" TEXT,
    "scope" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarEventSync" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "integrationAccountId" TEXT NOT NULL,
    "provider" "IntegrationProvider" NOT NULL,
    "externalEventId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarEventSync_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncJob" (
    "id" TEXT NOT NULL,
    "type" "SyncJobType" NOT NULL,
    "status" "SyncJobStatus" NOT NULL DEFAULT 'PENDING',
    "payload" JSONB NOT NULL,
    "result" JSONB,
    "requestedById" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "SyncJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationAccount_userId_provider_key" ON "IntegrationAccount"("userId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarEventSync_eventId_integrationAccountId_provider_key" ON "CalendarEventSync"("eventId", "integrationAccountId", "provider");

-- CreateIndex
CREATE INDEX "SyncJob_status_runAt_idx" ON "SyncJob"("status", "runAt");

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventTask" ADD CONSTRAINT "EventTask_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventTask" ADD CONSTRAINT "EventTask_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventTask" ADD CONSTRAINT "EventTask_dependsOnId_fkey" FOREIGN KEY ("dependsOnId") REFERENCES "EventTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadCapture" ADD CONSTRAINT "LeadCapture_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationAccount" ADD CONSTRAINT "IntegrationAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEventSync" ADD CONSTRAINT "CalendarEventSync_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEventSync" ADD CONSTRAINT "CalendarEventSync_integrationAccountId_fkey" FOREIGN KEY ("integrationAccountId") REFERENCES "IntegrationAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncJob" ADD CONSTRAINT "SyncJob_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

