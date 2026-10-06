/*
  Warnings:

  - You are about to drop the column `assignedStudentId` on the `Project` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."Project" DROP CONSTRAINT "Project_assignedStudentId_fkey";

-- DropIndex
DROP INDEX "public"."Project_assignedStudentId_idx";

-- AlterTable
ALTER TABLE "Project" DROP COLUMN "assignedStudentId";

-- CreateTable
CREATE TABLE "ProjectStudent" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectStudent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectStudent_projectId_idx" ON "ProjectStudent"("projectId");

-- CreateIndex
CREATE INDEX "ProjectStudent_studentId_idx" ON "ProjectStudent"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectStudent_projectId_studentId_key" ON "ProjectStudent"("projectId", "studentId");

-- AddForeignKey
ALTER TABLE "ProjectStudent" ADD CONSTRAINT "ProjectStudent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectStudent" ADD CONSTRAINT "ProjectStudent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
