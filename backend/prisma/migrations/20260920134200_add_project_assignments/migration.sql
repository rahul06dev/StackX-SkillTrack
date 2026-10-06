-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('ACTIVE', 'COMPLETED');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "assignedFacultyId" TEXT,
ADD COLUMN     "assignedStudentId" TEXT,
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "status" "ProjectStatus" NOT NULL DEFAULT 'ACTIVE';

-- CreateIndex
CREATE INDEX "Project_createdById_idx" ON "Project"("createdById");

-- CreateIndex
CREATE INDEX "Project_assignedFacultyId_idx" ON "Project"("assignedFacultyId");

-- CreateIndex
CREATE INDEX "Project_assignedStudentId_idx" ON "Project"("assignedStudentId");

-- CreateIndex
CREATE INDEX "Project_status_idx" ON "Project"("status");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_assignedFacultyId_fkey" FOREIGN KEY ("assignedFacultyId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_assignedStudentId_fkey" FOREIGN KEY ("assignedStudentId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
