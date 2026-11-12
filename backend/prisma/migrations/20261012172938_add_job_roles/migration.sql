-- CreateTable
CREATE TABLE "JobRole" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobRoleSkill" (
    "id" TEXT NOT NULL,
    "jobRoleId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobRoleSkill_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JobRole_title_key" ON "JobRole"("title");

-- CreateIndex
CREATE INDEX "JobRole_isActive_idx" ON "JobRole"("isActive");

-- CreateIndex
CREATE INDEX "JobRoleSkill_jobRoleId_idx" ON "JobRoleSkill"("jobRoleId");

-- CreateIndex
CREATE INDEX "JobRoleSkill_skillId_idx" ON "JobRoleSkill"("skillId");

-- CreateIndex
CREATE UNIQUE INDEX "JobRoleSkill_jobRoleId_skillId_key" ON "JobRoleSkill"("jobRoleId", "skillId");

-- AddForeignKey
ALTER TABLE "JobRoleSkill" ADD CONSTRAINT "JobRoleSkill_jobRoleId_fkey" FOREIGN KEY ("jobRoleId") REFERENCES "JobRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobRoleSkill" ADD CONSTRAINT "JobRoleSkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
