import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateUser, authorizeRoles, } from '../middleware/authMiddleware.js';
const prisma = new PrismaClient();
const router = Router();
// ==========================================
// HELPER: CHECK PROJECT ACCESS
// ==========================================
const userHasProjectAccess = async (projectId, req) => {
    if (!req.user) {
        return false;
    }
    // Admins can access every project.
    if (req.user.role === 'ADMIN') {
        return true;
    }
    const project = await prisma.project.findUnique({
        where: {
            id: projectId,
        },
        select: {
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
        },
    });
    if (!project) {
        return null;
    }
    // Student → must be explicitly assigned.
    if (req.user.role === 'STUDENT') {
        return project.students.length > 0;
    }
    // Faculty → assigned faculty OR project creator.
    if (req.user.role === 'FACULTY') {
        return (project.assignedFacultyId === req.user.id ||
            project.createdById === req.user.id);
    }
    return false;
};
// ==========================================
// HELPER: GET PROJECT ID FROM COLUMN
// ==========================================
const getProjectIdFromColumn = async (columnId) => {
    const column = await prisma.column.findUnique({
        where: {
            id: columnId,
        },
        select: {
            projectId: true,
        },
    });
    return column?.projectId ?? null;
};
// ==========================================
// HELPER: GET TASK WITH PROJECT INFORMATION
// ==========================================
const getTaskWithProject = async (taskId) => {
    return prisma.task.findUnique({
        where: {
            id: taskId,
        },
        include: {
            column: {
                select: {
                    id: true,
                    title: true,
                    projectId: true,
                },
            },
        },
    });
};
// ==========================================
// HELPER: FORMAT DATE
// ==========================================
const formatDateToISO = (date) => {
    if (!date)
        return null;
    return new Date(date);
};
// ==========================================
// GET TASKS BY COLUMN ID
// GET /api/tasks?columnId=xxx
// ==========================================
router.get('/', authenticateUser, async (req, res) => {
    const { columnId } = req.query;
    if (!columnId || typeof columnId !== 'string') {
        return res.status(400).json({
            message: 'Column ID is required.',
        });
    }
    try {
        const projectId = await getProjectIdFromColumn(columnId);
        if (!projectId) {
            return res.status(404).json({
                message: 'Column not found.',
            });
        }
        const hasAccess = await userHasProjectAccess(projectId, req);
        if (hasAccess === null) {
            return res.status(404).json({
                message: 'Project not found.',
            });
        }
        if (!hasAccess) {
            return res.status(403).json({
                message: 'You do not have access to this project.',
            });
        }
        const tasks = await prisma.task.findMany({
            where: {
                columnId,
            },
            orderBy: {
                createdAt: 'asc',
            },
            select: {
                id: true,
                columnId: true,
                title: true,
                description: true,
                priority: true,
                dueDate: true,
            },
        });
        const formattedTasks = tasks.map((task) => ({
            ...task,
            assignee: 'Placeholder User',
            commentsCount: 0,
            dueDate: formatDateToISO(task.dueDate),
        }));
        res.json(formattedTasks);
    }
    catch (error) {
        console.error('❌ Error fetching tasks:', error);
        res.status(500).json({
            message: 'Failed to fetch tasks',
            error,
        });
    }
});
// ==========================================
// POST CREATE NEW TASK
// POST /api/tasks
// ==========================================
router.post('/', authenticateUser, async (req, res) => {
    const { columnId, title, description, priority, dueDate, } = req.body;
    if (!columnId || !title || !priority) {
        return res.status(400).json({
            message: 'columnId, title, and priority are required to create a task.',
        });
    }
    try {
        const projectId = await getProjectIdFromColumn(columnId);
        if (!projectId) {
            return res.status(404).json({
                message: 'Column not found.',
            });
        }
        const hasAccess = await userHasProjectAccess(projectId, req);
        if (hasAccess === null) {
            return res.status(404).json({
                message: 'Project not found.',
            });
        }
        if (!hasAccess) {
            return res.status(403).json({
                message: 'You do not have access to this project.',
            });
        }
        const newTask = await prisma.task.create({
            data: {
                columnId,
                title,
                description,
                priority,
                dueDate: dueDate
                    ? new Date(dueDate)
                    : null,
            },
        });
        res.status(201).json({
            ...newTask,
            assignee: 'Placeholder User',
            commentsCount: 0,
        });
    }
    catch (error) {
        console.error('❌ Error creating task:', error);
        res.status(500).json({
            message: 'Failed to create task',
            error,
        });
    }
});
// ==========================================
// GET FACULTY REVIEWS PENDING
// ==========================================
router.get('/faculty/reviews', authenticateUser, async (req, res) => {
    try {
        if (req.user?.role !== 'FACULTY' &&
            req.user?.role !== 'ADMIN') {
            return res.status(403).json({
                message: 'Access denied.',
            });
        }
        const facultyId = req.user.id;
        const projects = await prisma.project.findMany({
            where: req.user.role === 'ADMIN'
                ? {}
                : {
                    OR: [
                        {
                            assignedFacultyId: facultyId,
                        },
                        {
                            createdById: facultyId,
                        },
                    ],
                },
            include: {
                columns: {
                    where: {
                        title: 'In Review',
                    },
                    include: {
                        tasks: {
                            orderBy: {
                                updatedAt: 'desc',
                            },
                        },
                    },
                },
            },
            orderBy: {
                updatedAt: 'desc',
            },
        });
        const reviews = projects.flatMap((project) => project.columns.flatMap((column) => column.tasks.map((task) => ({
            id: task.id,
            title: task.title,
            description: task.description,
            priority: task.priority,
            dueDate: task.dueDate,
            updatedAt: task.updatedAt,
            projectId: project.id,
            projectTitle: project.title,
            columnId: column.id,
            columnTitle: column.title,
        }))));
        res.json(reviews);
    }
    catch (error) {
        console.error('❌ Error fetching faculty reviews:', error);
        res.status(500).json({
            message: 'Failed to fetch pending reviews.',
        });
    }
});
// ==========================================
// PUT UPDATE EXISTING TASK
// PUT /api/tasks/:id
// ==========================================
router.put('/:id', authenticateUser, async (req, res) => {
    const { id } = req.params;
    const { title, description, priority, dueDate, columnId, } = req.body;
    try {
        // Get existing task + project information.
        const existingTask = await getTaskWithProject(id);
        if (!existingTask) {
            return res.status(404).json({
                message: 'Task not found.',
            });
        }
        const projectId = existingTask.column.projectId;
        // Check access to the project.
        const hasAccess = await userHasProjectAccess(projectId, req);
        if (hasAccess === null) {
            return res.status(404).json({
                message: 'Project not found.',
            });
        }
        if (!hasAccess) {
            return res.status(403).json({
                message: 'You do not have access to this project.',
            });
        }
        // ==========================================
        // TASK MOVEMENT VALIDATION
        // ==========================================
        if (columnId &&
            columnId !== existingTask.columnId) {
            const targetColumn = await prisma.column.findUnique({
                where: {
                    id: columnId,
                },
                select: {
                    id: true,
                    title: true,
                    projectId: true,
                },
            });
            if (!targetColumn) {
                return res.status(404).json({
                    message: 'Target column not found.',
                });
            }
            // Prevent moving a task into another
            // project's column.
            if (targetColumn.projectId !==
                projectId) {
                return res.status(403).json({
                    message: 'You cannot move a task to another project.',
                });
            }
            console.log('🔄 Task movement:', {
                taskId: id,
                from: existingTask.column
                    .title,
                to: targetColumn.title,
                userRole: req.user?.role,
            });
            // ==========================================
            // COMPLETED PROTECTION
            // ==========================================
            if (targetColumn.title ===
                'Completed') {
                // Students cannot complete tasks.
                if (req.user?.role ===
                    'STUDENT') {
                    return res.status(403).json({
                        message: 'Only Faculty or Admin can mark a task as Completed.',
                    });
                }
                // Faculty/Admin can only complete
                // tasks currently in In Review.
                if (existingTask.column.title !==
                    'In Review') {
                    return res.status(403).json({
                        message: 'A task must be moved to In Review before it can be Completed.',
                    });
                }
            }
        }
        // ==========================================
        // UPDATE TASK
        // ==========================================
        const updatedTask = await prisma.task.update({
            where: {
                id,
            },
            data: {
                ...(title !== undefined && {
                    title,
                }),
                ...(description !==
                    undefined && {
                    description,
                }),
                ...(priority !==
                    undefined && {
                    priority,
                }),
                ...(columnId !==
                    undefined && {
                    columnId,
                }),
                ...(dueDate !==
                    undefined && {
                    dueDate: dueDate
                        ? new Date(dueDate)
                        : null,
                }),
            },
        });
        res.json({
            ...updatedTask,
            assignee: 'Placeholder User',
            commentsCount: 0,
        });
    }
    catch (error) {
        console.error(`❌ Error updating task ID ${id}:`, error);
        res.status(500).json({
            message: 'Failed to update task',
            error,
        });
    }
});
// ==========================================
// DELETE TASK
// DELETE /api/tasks/:id
// ==========================================
router.delete('/:id', authenticateUser, async (req, res) => {
    const { id } = req.params;
    try {
        // Find task and determine its project.
        const task = await getTaskWithProject(id);
        if (!task) {
            return res.status(404).json({
                message: 'Task not found.',
            });
        }
        const projectId = task.column.projectId;
        const hasAccess = await userHasProjectAccess(projectId, req);
        if (hasAccess === null) {
            return res.status(404).json({
                message: 'Project not found.',
            });
        }
        if (!hasAccess) {
            return res.status(403).json({
                message: 'You do not have access to this project.',
            });
        }
        // Delete associated comments first.
        await prisma.comment.deleteMany({
            where: {
                taskId: id,
            },
        });
        // Delete the task itself.
        await prisma.task.delete({
            where: {
                id,
            },
        });
        console.log(`✅ Task ID ${id} and associated comments deleted.`);
        res.status(204).send();
    }
    catch (error) {
        console.error(`❌ Error deleting task ID ${id}:`, error);
        res.status(500).json({
            message: 'Failed to delete task',
            error,
        });
    }
});
// ==========================================
// GET STUDENT NEW TASKS
// ==========================================
router.get('/student/new', authenticateUser, authorizeRoles('STUDENT'), async (req, res) => {
    try {
        const studentId = req.user?.id;
        if (!studentId) {
            return res.status(401).json({
                message: 'Authentication required.',
            });
        }
        const projects = await prisma.project.findMany({
            where: {
                students: {
                    some: {
                        studentId,
                    },
                },
            },
            include: {
                columns: {
                    where: {
                        title: 'To Do',
                    },
                    include: {
                        tasks: {
                            orderBy: {
                                createdAt: 'desc',
                            },
                        },
                    },
                },
            },
            orderBy: {
                updatedAt: 'desc',
            },
        });
        const newTasks = projects.flatMap((project) => project.columns.flatMap((column) => column.tasks.map((task) => ({
            id: task.id,
            title: task.title,
            description: task.description,
            priority: task.priority,
            dueDate: task.dueDate,
            createdAt: task.createdAt,
            projectId: project.id,
            projectTitle: project.title,
            columnId: column.id,
            columnTitle: column.title,
        }))));
        res.json(newTasks);
    }
    catch (error) {
        console.error('❌ Error fetching student new tasks:', error);
        res.status(500).json({
            message: 'Failed to fetch student new tasks.',
        });
    }
});
// ==========================================
// GET STUDENT DEADLINES
// ==========================================
router.get('/student/deadlines', authenticateUser, authorizeRoles('STUDENT'), async (req, res) => {
    try {
        const studentId = req.user?.id;
        if (!studentId) {
            return res.status(401).json({
                message: 'Authentication required.',
            });
        }
        const projects = await prisma.project.findMany({
            where: {
                students: {
                    some: {
                        studentId,
                    },
                },
            },
            include: {
                columns: {
                    where: {
                        title: {
                            not: 'Completed',
                        },
                    },
                    include: {
                        tasks: {
                            where: {
                                dueDate: {
                                    not: null,
                                    gte: new Date(),
                                },
                            },
                            orderBy: {
                                dueDate: 'asc',
                            },
                        },
                    },
                },
            },
            orderBy: {
                updatedAt: 'desc',
            },
        });
        const deadlines = projects.flatMap((project) => project.columns.flatMap((column) => column.tasks.map((task) => ({
            id: task.id,
            title: task.title,
            description: task.description,
            priority: task.priority,
            dueDate: task.dueDate,
            projectId: project.id,
            projectTitle: project.title,
            columnId: column.id,
            columnTitle: column.title,
        }))));
        deadlines.sort((a, b) => new Date(a.dueDate).getTime() -
            new Date(b.dueDate).getTime());
        res.json(deadlines);
    }
    catch (error) {
        console.error('❌ Error fetching student deadlines:', error);
        res.status(500).json({
            message: 'Failed to fetch student deadlines.',
        });
    }
});
export default router;
//# sourceMappingURL=taskRoutes.js.map