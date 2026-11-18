import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

import {
  authenticateUser,
  authorizeRoles,
  type AuthenticatedRequest,
} from '../middleware/authMiddleware.js';

const prisma = new PrismaClient();
const router = Router();

/*
  ==========================================
  GET PROJECT SKILLS
  GET /api/project-skills/:projectId
  ==========================================

  ADMIN   → Can view
  FACULTY → Can view if assigned/creator
  STUDENT → Can view if assigned
*/

router.get(
  '/:projectId',
  authenticateUser,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { projectId } = req.params;

      if (!req.user) {
        return res.status(401).json({
          message: 'Authentication required.',
        });
      }

      const project = await prisma.project.findUnique({
        where: {
          id: projectId,
        },
        select: {
          id: true,
          createdById: true,
          assignedFacultyId: true,

          students: {
            where: {
              studentId: req.user.id,
            },
            select: {
              id: true,
            },
          },
          faculty: {
            where: {
              facultyId: req.user.id,
            },
            select: {
              id: true,
            },
          },
        },
      });

      if (!project) {
        return res.status(404).json({
          message: 'Project not found.',
        });
      }

      // ==========================================
      // CHECK PROJECT ACCESS
      // ==========================================

      const isAdmin = req.user.role === 'ADMIN';

      const isAssignedStudent =
        req.user.role === 'STUDENT' &&
        project.students.length > 0;

      const isAssignedFaculty =
        req.user.role === 'FACULTY' &&
        (project.assignedFacultyId === req.user.id || project.faculty.length > 0);

      const isCreator =
        project.createdById === req.user.id;

      if (
        !isAdmin &&
        !isAssignedStudent &&
        !isAssignedFaculty &&
        !isCreator
      ) {
        return res.status(403).json({
          message:
            'You do not have access to this project.',
        });
      }

      // ==========================================
      // FETCH PROJECT SKILLS
      // ==========================================

      const projectSkills =
        await prisma.projectSkill.findMany({
          where: {
            projectId,
          },
          include: {
            skill: true,
          },
          orderBy: {
            skill: {
              name: 'asc',
            },
          },
        });

      return res.json(projectSkills);
    } catch (error) {
      console.error(
        'Error fetching project skills:',
        error
      );

      return res.status(500).json({
        message: 'Failed to fetch project skills.',
      });
    }
  }
);

/*
  ==========================================
  ATTACH SKILL TO PROJECT
  POST /api/project-skills/:projectId
  ==========================================

  ADMIN   → Can add
  FACULTY → Can add if assigned/creator
  STUDENT → Can add if assigned team member or creator
*/

router.post(
  '/:projectId',
  authenticateUser,
  authorizeRoles('ADMIN', 'FACULTY', 'STUDENT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { projectId } = req.params;
      const { skillId } = req.body;

      if (!req.user) {
        return res.status(401).json({
          message: 'Authentication required.',
        });
      }

      if (!skillId) {
        return res.status(400).json({
          message: 'Skill ID is required.',
        });
      }

      // ==========================================
      // CHECK PROJECT ACCESS
      // ==========================================

      const project = await prisma.project.findUnique({
        where: {
          id: projectId,
        },
        select: {
          id: true,
          createdById: true,
          assignedFacultyId: true,
          students: {
            where: {
              studentId: req.user.id,
            },
            select: {
              id: true,
            },
          },
          faculty: {
            where: {
              facultyId: req.user.id,
            },
            select: {
              id: true,
            },
          },
        },
      });

      if (!project) {
        return res.status(404).json({
          message: 'Project not found.',
        });
      }

      const isAdmin = req.user.role === 'ADMIN';

      const isAssignedFaculty =
        req.user.role === 'FACULTY' &&
        (project.assignedFacultyId === req.user.id || project.faculty.length > 0);

      const isCreator =
        project.createdById === req.user.id;

      const isAssignedStudent =
        req.user.role === 'STUDENT' &&
        project.students.length > 0;

      if (
        !isAdmin &&
        !isAssignedFaculty &&
        !isCreator &&
        !isAssignedStudent
      ) {
        return res.status(403).json({
          message:
            'You do not have permission to add skills to this project.',
        });
      }

      // ==========================================
      // CHECK SKILL
      // ==========================================

      const skill = await prisma.skill.findUnique({
        where: {
          id: skillId,
        },
      });

      if (!skill) {
        return res.status(404).json({
          message: 'Skill not found.',
        });
      }

      if (!skill.isActive) {
        return res.status(400).json({
          message: 'This skill is currently disabled.',
        });
      }

      // ==========================================
      // CHECK DUPLICATE
      // ==========================================

      const existingProjectSkill =
        await prisma.projectSkill.findUnique({
          where: {
            projectId_skillId: {
              projectId,
              skillId,
            },
          },
        });

      if (existingProjectSkill) {
        return res.status(409).json({
          message:
            'This skill is already attached to the project.',
        });
      }

      // ==========================================
      // CREATE PROJECT SKILL
      // ==========================================

      const projectSkill =
        await prisma.projectSkill.create({
          data: {
            projectId,
            skillId,
          },
          include: {
            skill: true,
          },
        });

      return res.status(201).json(projectSkill);
    } catch (error) {
      console.error(
        'Error attaching skill to project:',
        error
      );

      return res.status(500).json({
        message:
          'Failed to attach skill to project.',
      });
    }
  }
);

/*
  ==========================================
  REMOVE SKILL FROM PROJECT
  DELETE /api/project-skills/:projectId/:skillId
  ==========================================

  ADMIN   → Can remove
  FACULTY → Can remove if assigned/creator
  STUDENT → Can remove if assigned team member or creator
*/

router.delete(
  '/:projectId/:skillId',
  authenticateUser,
  authorizeRoles('ADMIN', 'FACULTY', 'STUDENT'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { projectId, skillId } = req.params;

      if (!req.user) {
        return res.status(401).json({
          message: 'Authentication required.',
        });
      }

      // Check project access
      const project = await prisma.project.findUnique({
        where: {
          id: projectId,
        },
        select: {
          id: true,
          createdById: true,
          assignedFacultyId: true,
          students: {
            where: {
              studentId: req.user.id,
            },
            select: {
              id: true,
            },
          },
          faculty: {
            where: {
              facultyId: req.user.id,
            },
            select: {
              id: true,
            },
          },
        },
      });

      if (!project) {
        return res.status(404).json({
          message: 'Project not found.',
        });
      }

      const isAdmin = req.user.role === 'ADMIN';
      const isAssignedFaculty =
        req.user.role === 'FACULTY' &&
        (project.assignedFacultyId === req.user.id || project.faculty.length > 0);
      const isCreator = project.createdById === req.user.id;
      const isAssignedStudent =
        req.user.role === 'STUDENT' &&
        project.students.length > 0;

      if (!isAdmin && !isAssignedFaculty && !isCreator && !isAssignedStudent) {
        return res.status(403).json({
          message:
            'You do not have permission to remove skills from this project.',
        });
      }

      // Check if attached
      const existingProjectSkill = await prisma.projectSkill.findUnique({
        where: {
          projectId_skillId: {
            projectId,
            skillId,
          },
        },
      });

      if (!existingProjectSkill) {
        return res.status(404).json({
          message: 'Skill is not attached to this project.',
        });
      }

      await prisma.$transaction(async (tx) => {
        // 1. Delete the ProjectSkill attachment
        await tx.projectSkill.delete({
          where: {
            projectId_skillId: {
              projectId,
              skillId,
            },
          },
        });

        // 2. Find any StudentSkillEvidence linking this project to a claim for this skill
        const matchingEvidences = await tx.studentSkillEvidence.findMany({
          where: {
            projectId,
            studentSkill: {
              skillId,
            },
          },
          select: {
            id: true,
            studentSkillId: true,
          },
        });

        if (matchingEvidences.length > 0) {
          const studentSkillIds = Array.from(
            new Set(matchingEvidences.map((e) => e.studentSkillId))
          );

          // Delete the evidence records linking this project to this skill claim
          await tx.studentSkillEvidence.deleteMany({
            where: {
              id: {
                in: matchingEvidences.map((e) => e.id),
              },
            },
          });

          // 3. For each affected claim, check if it has any remaining valid project evidence
          for (const sSkillId of studentSkillIds) {
            const remainingValidEvidence = await tx.studentSkillEvidence.count({
              where: {
                studentSkillId: sSkillId,
                project: {
                  projectSkills: {
                    some: {
                      skillId,
                    },
                  },
                },
              },
            });

            // If no valid project evidence remains backing this claim, automatically delete the claim
            if (remainingValidEvidence === 0) {
              await tx.studentSkill.delete({
                where: {
                  id: sSkillId,
                },
              });
            }
          }
        }
      });

      return res.status(200).json({
        message: 'Skill removed from project successfully.',
      });
    } catch (error) {
      console.error('Error removing skill from project:', error);
      return res.status(500).json({
        message: 'Failed to remove skill from project.',
      });
    }
  }
);

export default router;