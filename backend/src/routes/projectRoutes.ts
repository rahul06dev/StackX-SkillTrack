import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import {
  authenticateUser,
  authorizeRoles,
} from '../middleware/authMiddleware.js';

import type {
  AuthenticatedRequest,
} from '../middleware/authMiddleware.js';

const prisma = new PrismaClient();
const router = Router();

router.get(
  '/admin/overview',
  authenticateUser,
  authorizeRoles('ADMIN'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const [
        totalUsers,
        totalStudents,
        totalFaculty,
        totalProjects,
        activeProjects,
        completedProjects,
      ] = await Promise.all([
        prisma.user.count(),

        prisma.user.count({
          where: {
            role: 'STUDENT',
          },
        }),

        prisma.user.count({
          where: {
            role: 'FACULTY',
          },
        }),

        prisma.project.count(),

        prisma.project.count({
          where: {
            status: 'ACTIVE',
          },
        }),

        prisma.project.count({
          where: {
            status: 'COMPLETED',
          },
        }),
      ]);

      res.json({
        totalUsers,
        totalStudents,
        totalFaculty,
        totalProjects,
        activeProjects,
        completedProjects,
      });
    } catch (error) {
      console.error(
        '❌ Error fetching admin dashboard overview:',
        error
      );

      res.status(500).json({
        message: 'Failed to fetch admin dashboard overview.',
      });
    }
  }
);

router.get(
  '/admin/recent',
  authenticateUser,
  authorizeRoles('ADMIN'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const projects = await prisma.project.findMany({
        select: {
          id: true,
          title: true,
          description: true,
          status: true,
          tasksCount: true,
          membersCount: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: {
          updatedAt: 'desc',
        },
        take: 5,
      });

      res.json(projects);
    } catch (error) {
      console.error(
        '❌ Error fetching recent admin projects:',
        error
      );

      res.status(500).json({
        message: 'Failed to fetch recent projects.',
      });
    }
  }
);

router.get(
  '/admin/projects',
  authenticateUser,
  authorizeRoles('ADMIN'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const projects = await prisma.project.findMany({
        include: {
          students: {
            include: {
              student: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  role: true,
                },
              },
            },
          },

          assignedFaculty: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },

          admins: {
            include: {
              admin: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  role: true,
                },
              },
            },
          },

          columns: {
            include: {
              tasks: true,
            },
          },
        },

        orderBy: {
          updatedAt: 'desc',
        },
      });

      const formattedProjects = projects.map((project) => {
        const students = project.students.map(
          (assignment) => assignment.student
        );

        const faculty = project.assignedFaculty
          ? [project.assignedFaculty]
          : [];

        const admins = project.admins.map(
          (assignment) => assignment.admin
        );

        const tasksCount = project.columns.reduce(
          (total, column) => total + column.tasks.length,
          0
        );

        const peopleCount =
          students.length +
          faculty.length +
          admins.length;

        return {
          id: project.id,
          title: project.title,
          description: project.description,
          status: project.status,

          tasksCount,
          peopleCount,

          students,
          faculty,
          admins,

          createdAt: project.createdAt,
          updatedAt: project.updatedAt,
        };
      });

      res.json(formattedProjects);
    } catch (error) {
      console.error(
        '❌ Error fetching admin projects:',
        error
      );

      res.status(500).json({
        message: 'Failed to fetch admin projects.',
      });
    }
  }
);

// --- Project GET Route ---
// --- Project GET Route ---
router.get(
  '/',
  authenticateUser,
  authorizeRoles('STUDENT', 'FACULTY', 'ADMIN'),
  async (req: AuthenticatedRequest, res) => {
    try {
      let projects;

      if (req.user?.role === 'STUDENT') {
        projects = await prisma.project.findMany({
          where: {
            students: {
              some: {
                studentId: req.user.id,
              },
            },
          },
          select: {
            id: true,
            title: true,
            description: true,
            tasksCount: true,
            membersCount: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        });

      } else if (req.user?.role === 'FACULTY') {
        // Faculty can see projects assigned to them
        // or projects created by them
        projects = await prisma.project.findMany({
          where: {
            OR: [
              { assignedFacultyId: req.user.id },
              { createdById: req.user.id },
            ],
          },
          select: {
            id: true,
            title: true,
            description: true,
            tasksCount: true,
            membersCount: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        });

      } else {
        // Admin can see all projects
        projects = await prisma.project.findMany({
          select: {
            id: true,
            title: true,
            description: true,
            tasksCount: true,
            membersCount: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        });
      }

      const formattedProjects = projects.map(p => ({
        id: p.id,
        title: p.title,
        description: p.description,
        tasks: p.tasksCount,
        members: p.membersCount,
      }));

      res.json(formattedProjects);

    } catch (error) {
      console.error('❌ Error fetching projects:', error);

      res.status(500).json({
        message: 'Failed to fetch projects',
        error,
      });
    }
  }
);

// --- Faculty Upcoming Deadlines ---
// GET /api/projects/faculty/deadlines
router.get(
  '/faculty/deadlines',
  authenticateUser,
  authorizeRoles('FACULTY'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const facultyId = req.user?.id;

      if (!facultyId) {
        return res.status(401).json({
          message: 'Authentication required.',
        });
      }

      const deadlines = await prisma.task.findMany({
        where: {
          dueDate: {
            gte: new Date(),
          },
          column: {
            project: {
              OR: [
                { assignedFacultyId: facultyId },
                { createdById: facultyId },
              ],
            },
          },
        },

        select: {
          id: true,
          title: true,
          priority: true,
          dueDate: true,

          column: {
            select: {
              project: {
                select: {
                  id: true,
                  title: true,
                },
              },
            },
          },
        },

        orderBy: {
          dueDate: 'asc',
        },

        take: 5,
      });

      const formattedDeadlines = deadlines.map((task) => ({
        id: task.id,
        title: task.title,
        priority: task.priority,
        dueDate: task.dueDate,
        projectId: task.column.project.id,
        projectTitle: task.column.project.title,
      }));

      res.json(formattedDeadlines);
    } catch (error) {
      console.error(
        '❌ Error fetching faculty deadlines:',
        error
      );

      res.status(500).json({
        message: 'Failed to fetch faculty deadlines',
        error,
      });
    }
  }
);

router.get(
  '/team-options',
  authenticateUser,
  authorizeRoles('ADMIN'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const users = await prisma.user.findMany({
        where: {
          role: {
            in: ['STUDENT', 'FACULTY', 'ADMIN'],
          },
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
        orderBy: {
          name: 'asc',
        },
      });

      const students = users.filter(
        (user) => user.role === 'STUDENT'
      );

      const faculty = users.filter(
        (user) => user.role === 'FACULTY'
      );

      const admins = users.filter(
        (user) => user.role === 'ADMIN'
      );

      res.json({
        students,
        faculty,
        admins,
      });
    } catch (error) {
      console.error('❌ Error fetching project team options:', error);

      res.status(500).json({
        message: 'Failed to fetch project team options.',
      });
    }
  }
);

router.get(
  '/:id',
  authenticateUser,
  authorizeRoles('STUDENT', 'FACULTY', 'ADMIN'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const projectId = req.params.id;

      if (!projectId) {
        return res.status(400).json({
          message: 'Project ID is required.',
        });
      }

      const project = await prisma.project.findUnique({
        where: {
          id: projectId,
        },
        include: {
          students: {
            include: {
              student: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  role: true,
                },
              },
            },
          },

          assignedFaculty: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },

          admins: {
            include: {
              admin: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  role: true,
                },
              },
            },
          },
        },
      });

      if (!project) {
        return res.status(404).json({
          message: 'Project not found.',
        });
      }

      // -----------------------------------------
      // Check whether the current user can access
      // this project.
      // -----------------------------------------

      const userId = req.user?.id;
      const userRole = req.user?.role;

      const isAdmin = userRole === 'ADMIN';

      const isAssignedStudent = project.students.some(
        (assignment) => assignment.studentId === userId
      );

      const isAssignedFaculty =
        project.assignedFacultyId === userId;

      const isCreator =
        project.createdById === userId;

      if (
        !isAdmin &&
        !isAssignedStudent &&
        !isAssignedFaculty &&
        !isCreator
      ) {
        return res.status(403).json({
          message: 'You do not have access to this project.',
        });
      }

      const students = project.students.map(
        (assignment) => assignment.student
      );

      const faculty = project.assignedFaculty
        ? [project.assignedFaculty]
        : [];

      const admins = project.admins.map(
        (assignment) => assignment.admin
      );

      res.json({
        id: project.id,
        title: project.title,
        description: project.description,

        students,
        faculty,
        admins,
      });
    } catch (error) {
      console.error(
        '❌ Error fetching project details:',
        error
      );

      res.status(500).json({
        message: 'Failed to fetch project details.',
      });
    }
  }
);

router.put(
  '/:id/team',
  authenticateUser,
  authorizeRoles('ADMIN'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const projectId = req.params.id;

      const {
        studentIds = [],
        facultyId = null,
        adminIds = [],
      } = req.body;

      if (!projectId) {
        return res.status(400).json({
          message: 'Project ID is required.',
        });
      }

      if (!Array.isArray(studentIds)) {
        return res.status(400).json({
          message: 'studentIds must be an array.',
        });
      }

      if (!Array.isArray(adminIds)) {
        return res.status(400).json({
          message: 'adminIds must be an array.',
        });
      }

      // Check that the project exists
      const project = await prisma.project.findUnique({
        where: {
          id: projectId,
        },
      });

      if (!project) {
        return res.status(404).json({
          message: 'Project not found.',
        });
      }

      // Validate Faculty
      if (facultyId) {
        const faculty = await prisma.user.findUnique({
          where: {
            id: facultyId,
          },
        });

        if (!faculty || faculty.role !== 'FACULTY') {
          return res.status(400).json({
            message: 'Invalid faculty user.',
          });
        }
      }

      // Validate Students
      if (studentIds.length > 0) {
        const students = await prisma.user.findMany({
          where: {
            id: {
              in: studentIds,
            },
            role: 'STUDENT',
          },
        });

        if (students.length !== studentIds.length) {
          return res.status(400).json({
            message: 'One or more student IDs are invalid.',
          });
        }
      }

      // Validate Admins
      if (adminIds.length > 0) {
        const admins = await prisma.user.findMany({
          where: {
            id: {
              in: adminIds,
            },
            role: 'ADMIN',
          },
        });

        if (admins.length !== adminIds.length) {
          return res.status(400).json({
            message: 'One or more admin IDs are invalid.',
          });
        }
      }

      // Replace student assignments
      await prisma.projectStudent.deleteMany({
        where: {
          projectId,
        },
      });

      if (studentIds.length > 0) {
        await prisma.projectStudent.createMany({
          data: studentIds.map((studentId: string) => ({
            projectId,
            studentId,
          })),
        });
      }

      // Replace admin assignments
      await prisma.projectAdmin.deleteMany({
        where: {
          projectId,
        },
      });

      if (adminIds.length > 0) {
        await prisma.projectAdmin.createMany({
          data: adminIds.map((adminId: string) => ({
            projectId,
            adminId,
          })),
        });
      }

      // Update assigned faculty
      await prisma.project.update({
        where: {
          id: projectId,
        },
        data: {
          assignedFacultyId: facultyId,
        },
      });

      res.json({
        message: 'Project team updated successfully.',
      });
    } catch (error) {
      console.error(
        '❌ Error updating project team:',
        error
      );

      res.status(500).json({
        message: 'Failed to update project team.',
      });
    }
  }
);



// --- Project POST Route (Create New Project) ---
// --- Project POST Route (Create New Project) ---
router.post(
  '/',
  authenticateUser,
  authorizeRoles('FACULTY', 'ADMIN'),
  async (req: AuthenticatedRequest, res) => {
    console.log('POST /api/projects called with body:', req.body);

    const { title, description, studentIds } = req.body;

    if (!title || !description) {
      return res.status(400).json({
        message: 'Title and description are required.',
      });
    }

    try {
      const newProject = await prisma.project.create({
        data: {
          title,
          description,

          createdById: req.user?.id,

          students: {
            create: Array.isArray(studentIds)
              ? studentIds.map((studentId: string) => ({
                student: {
                  connect: {
                    id: studentId,
                  },
                },
              }))
              : [],
          },

          // Create the default Kanban workflow columns
          columns: {
            create: [
              {
                title: 'To Do',
                colorClass: 'todo',
                order: 0,
              },
              {
                title: 'In Progress',
                colorClass: 'in-progress',
                order: 1,
              },
              {
                title: 'In Review',
                colorClass: 'in-review',
                order: 2,
              },
              {
                title: 'Completed',
                colorClass: 'completed',
                order: 3,
              },
            ],
          },
        },

        include: {
          students: true,
          columns: {
            orderBy: {
              order: 'asc',
            },
          },
        },
      });

      res.status(201).json({
        id: newProject.id,
        title: newProject.title,
        description: newProject.description,
        tasks: newProject.tasksCount,
        members: newProject.membersCount,
        columns: newProject.columns,
      });
    } catch (error) {
      console.error('❌ Error creating project:', error);

      res.status(500).json({
        message: 'Failed to create project',
        error,
      });
    }
  }
);

export default router;

