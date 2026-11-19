import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateUser, authorizeRoles, } from '../middleware/authMiddleware.js';
import { logActivity } from '../services/activityService.js';
import { parseTaskDescription, formatTaskDescription } from '../utils/taskUtils.js';
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
        return null;
    }
    // Student → must be explicitly assigned or project creator.
    if (req.user.role === 'STUDENT') {
        return project.students.length > 0 || project.createdById === req.user.id;
    }
    // Faculty → assigned faculty OR project creator.
    if (req.user.role === 'FACULTY') {
        return (project.assignedFacultyId === req.user.id ||
            project.faculty.length > 0 ||
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
        const formattedTasks = tasks.map((task) => {
            const parsed = parseTaskDescription(task.description);
            return {
                ...task,
                description: parsed.description,
                assignee: parsed.assignee || 'Team Member',
                commentsCount: 0,
                dueDate: formatDateToISO(task.dueDate),
            };
        });
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
    const { columnId, title, description, priority, dueDate, assignee, } = req.body;
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
        let taskAssignee = assignee;
        if (!taskAssignee && req.user?.id) {
            const creator = await prisma.user.findUnique({
                where: { id: req.user.id },
                select: { name: true },
            });
            taskAssignee = creator?.name || 'Task Creator';
        }
        const finalDescription = formatTaskDescription(description, taskAssignee);
        const newTask = await prisma.task.create({
            data: {
                columnId,
                title,
                description: finalDescription,
                priority,
                dueDate: dueDate
                    ? new Date(dueDate)
                    : null,
            },
        });
        res.status(201).json({
            ...newTask,
            description: description || '',
            assignee: taskAssignee || 'Team Member',
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
                            faculty: {
                                some: {
                                    facultyId,
                                },
                            },
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
const updateTaskHandler = async (req, res) => {
    const { id } = req.params;
    const { title, description, priority, dueDate, columnId, assignee, } = req.body;
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
        const currentParsed = parseTaskDescription(existingTask.description);
        const resolvedAssignee = assignee !== undefined ? assignee : currentParsed.assignee;
        const resolvedDescription = description !== undefined ? description : currentParsed.description;
        const finalDescription = (description !== undefined || assignee !== undefined)
            ? formatTaskDescription(resolvedDescription, resolvedAssignee)
            : undefined;
        const updatedTask = await prisma.task.update({
            where: {
                id,
            },
            data: {
                ...(title !== undefined && {
                    title,
                }),
                ...(finalDescription !== undefined && {
                    description: finalDescription,
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
            description: resolvedDescription,
            assignee: resolvedAssignee || 'Team Member',
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
};
// ==========================================
// PATCH REORDER / MOVE TASK
// PATCH /api/tasks/reorder
// ==========================================
const reorderTaskHandler = async (req, res) => {
    const { taskId, targetColumnId, newIndex } = req.body;
    if (!taskId || !targetColumnId) {
        return res.status(400).json({
            message: 'taskId and targetColumnId are required.',
        });
    }
    try {
        const task = await getTaskWithProject(taskId);
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
        const targetColumn = await prisma.column.findUnique({
            where: { id: targetColumnId },
            select: { id: true, title: true, projectId: true },
        });
        if (!targetColumn) {
            return res.status(404).json({
                message: 'Target column not found.',
            });
        }
        if (targetColumn.projectId !== projectId) {
            return res.status(403).json({
                message: 'You cannot move a task to another project.',
            });
        }
        // Workflow restriction: Students cannot move tasks to Completed
        if (targetColumn.title === 'Completed') {
            if (req.user?.role === 'STUDENT') {
                return res.status(403).json({
                    message: 'Only Faculty or Admin can mark a task as Completed.',
                });
            }
            if (task.column.title !== 'In Review') {
                return res.status(403).json({
                    message: 'A task must be moved to In Review before it can be Completed.',
                });
            }
        }
        const isColumnChanged = task.columnId !== targetColumnId;
        const updatedTask = await prisma.task.update({
            where: { id: taskId },
            data: {
                columnId: targetColumnId,
                ...(typeof newIndex === 'number' && { order: newIndex }),
            },
        });
        if (isColumnChanged) {
            const actor = await prisma.user.findUnique({
                where: { id: req.user.id },
                select: { name: true },
            });
            await logActivity({
                projectId,
                userId: req.user.id,
                userName: actor?.name || 'User',
                action: 'TASK_MOVED',
                details: `Moved task "${task.title}" from "${task.column.title}" to "${targetColumn.title}"`,
            });
        }
        const parsed = parseTaskDescription(task.description);
        return res.json({
            ...updatedTask,
            description: parsed.description,
            assignee: parsed.assignee || 'Team Member',
            commentsCount: 0,
        });
    }
    catch (error) {
        console.error('❌ Error reordering task:', error);
        return res.status(500).json({
            message: 'Failed to reorder task',
            error,
        });
    }
};
router.patch('/reorder', authenticateUser, reorderTaskHandler);
router.put('/:id', authenticateUser, updateTaskHandler);
router.patch('/:id', authenticateUser, updateTaskHandler);
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