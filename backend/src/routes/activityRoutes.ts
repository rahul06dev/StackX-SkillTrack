import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import {
  authenticateUser,
  type AuthenticatedRequest,
} from '../middleware/authMiddleware.js';

const prisma = new PrismaClient();
const router = Router();

// ==========================================
// GET PROJECT ACTIVITIES
// GET /api/activities/project/:projectId
// ==========================================
router.get(
  '/project/:projectId',
  authenticateUser,
  async (req: AuthenticatedRequest, res) => {
    const { projectId } = req.params;

    try {
      if (req.user?.role !== 'ADMIN') {
        const project = await prisma.project.findUnique({
          where: { id: projectId },
          select: {
            createdById: true,
            assignedFacultyId: true,
            students: {
              where: { studentId: req.user!.id },
              select: { id: true },
            },
          },
        });

        if (!project) {
          return res.status(404).json({ message: 'Project not found.' });
        }

        const isAssignedStudent = project.students.length > 0;
        const isFaculty =
          req.user?.role === 'FACULTY' &&
          (project.assignedFacultyId === req.user.id || project.createdById === req.user.id);

        if (!isAssignedStudent && !isFaculty) {
          return res.status(403).json({ message: 'Access denied to this project activity.' });
        }
      }

      const activities = await prisma.activity.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });

      return res.json(activities);
    } catch (error) {
      console.error('Error fetching project activities:', error);
      return res.status(500).json({ message: 'Failed to fetch project activity history.' });
    }
  }
);

export default router;

