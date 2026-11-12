
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

import {
  authenticateUser,
  authorizeRoles,
} from '../middleware/authMiddleware.js';

const prisma = new PrismaClient();
const router = Router();

// GET /api/talent-search?jobRoleId=<role-id>
// Admin-only student matching against a selected job role.
router.get(
  '/',
  authenticateUser,
  authorizeRoles('ADMIN'),
  async (req, res) => {
    try {
      const jobRoleId =
        typeof req.query.jobRoleId === 'string'
          ? req.query.jobRoleId
          : '';

      if (!jobRoleId) {
        return res.status(400).json({
          message: 'Please select a job role.',
        });
      }

      // Fetch the selected active role and its required skills.
      const jobRole = await prisma.jobRole.findFirst({
        where: {
          id: jobRoleId,
          isActive: true,
        },
        select: {
          id: true,
          title: true,
          description: true,
          requiredSkills: {
            select: {
              skill: {
                select: {
                  id: true,
                  name: true,
                  isActive: true,
                },
              },
            },
          },
        },
      });

      if (!jobRole) {
        return res.status(404).json({
          message: 'Active job role not found.',
        });
      }

      // Only active catalogue skills are included in matching.
      const requiredSkills = jobRole.requiredSkills
        .map((item) => item.skill)
        .filter((skill) => skill.isActive);

      const requiredSkillIds = new Set(
        requiredSkills.map((skill) => skill.id)
      );

      // Get all students, including students with no assigned projects.
      const students = await prisma.user.findMany({
        where: {
          role: 'STUDENT',
        },
        select: {
          id: true,
          name: true,
          email: true,
        },
      });

      const results = await Promise.all(
        students.map(async (student) => {
          // Fetch projects assigned to this student and their active skills.
          const projects = await prisma.project.findMany({
            where: {
              students: {
                some: {
                  studentId: student.id,
                },
              },
            },
            select: {
              id: true,
              title: true,
              status: true,
              projectSkills: {
                where: {
                  skill: {
                    isActive: true,
                  },
                },
                select: {
                  skill: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
              },
            },
            orderBy: {
              updatedAt: 'desc',
            },
          });

          // Collect supporting projects for each required skill.
          const evidenceMap = new Map<
            string,
            Array<{
              id: string;
              title: string;
              status: string;
            }>
          >();

          for (const project of projects) {
            for (const projectSkill of project.projectSkills) {
              const skill = projectSkill.skill;

              // Ignore skills not required by the selected job role.
              if (!requiredSkillIds.has(skill.id)) {
                continue;
              }

              if (!evidenceMap.has(skill.id)) {
                evidenceMap.set(skill.id, []);
              }

              evidenceMap.get(skill.id)!.push({
                id: project.id,
                title: project.title,
                status: project.status,
              });
            }
          }

          const matchedSkills = requiredSkills
            .filter((skill) => evidenceMap.has(skill.id))
            .map((skill) => ({
              id: skill.id,
              name: skill.name,
              projects: evidenceMap.get(skill.id) ?? [],
            }));

          const missingSkills = requiredSkills
            .filter((skill) => !evidenceMap.has(skill.id))
            .map((skill) => ({
              id: skill.id,
              name: skill.name,
            }));

          const totalRequiredSkills = requiredSkills.length;

          const matchPercentage =
            totalRequiredSkills > 0
              ? Math.round(
                  (matchedSkills.length / totalRequiredSkills) * 100
                )
              : 0;

          return {
            id: student.id,
            name: student.name,
            email: student.email,
            totalProjects: projects.length,
            matchPercentage,
            matchedSkillCount: matchedSkills.length,
            totalRequiredSkills,
            matchedSkills,
            missingSkills,
          };
        })
      );

      // Highest match first; use name to break ties.
      results.sort(
        (a, b) =>
          b.matchPercentage - a.matchPercentage ||
          (a.name ?? '').localeCompare(b.name ?? '')
      );

      return res.json({
        jobRole: {
          id: jobRole.id,
          title: jobRole.title,
          description: jobRole.description,
        },
        totalRequiredSkills: requiredSkills.length,
        totalStudents: results.length,
        students: results,
      });
    } catch (error) {
      console.error('Error performing talent search:', error);

      return res.status(500).json({
        message: 'Failed to perform talent search.',
      });
    }
  }
);

export default router;
