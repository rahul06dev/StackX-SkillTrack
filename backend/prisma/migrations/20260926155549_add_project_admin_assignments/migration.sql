-- CreateTable
CREATE TABLE "ProjectAdmin" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectAdmin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectAdmin_projectId_idx" ON "ProjectAdmin"("projectId");

-- CreateIndex
CREATE INDEX "ProjectAdmin_adminId_idx" ON "ProjectAdmin"("adminId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectAdmin_projectId_adminId_key" ON "ProjectAdmin"("projectId", "adminId");

-- AddForeignKey
ALTER TABLE "ProjectAdmin" ADD CONSTRAINT "ProjectAdmin_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectAdmin" ADD CONSTRAINT "ProjectAdmin_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
