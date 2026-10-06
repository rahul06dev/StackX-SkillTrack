import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import {
    authenticateUser,
    type AuthenticatedRequest,
} from '../middleware/authMiddleware.js';

const prisma = new PrismaClient();
const router = Router();


// ==========================================
// HELPER: GET TASK + PROJECT
// ==========================================

const getTaskWithProject = async (
    taskId: string
) => {
    return prisma.task.findUnique({
        where: {
            id: taskId,
        },
        include: {
            column: {
                select: {
                    projectId: true,
                },
            },
        },
    });
};


// ==========================================
// HELPER: CHECK PROJECT ACCESS
// ==========================================

const userHasProjectAccess = async (
    projectId: string,
    req: AuthenticatedRequest
) => {
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
        return (
            project.assignedFacultyId === req.user.id ||
            project.createdById === req.user.id
        );
    }

    return false;
};


// ==========================================
// GET COMMENTS BY TASK ID
// GET /api/comments/task/:taskId
// ==========================================

router.get(
    '/task/:taskId',
    authenticateUser,
    async (
        req: AuthenticatedRequest,
        res
    ) => {
        const { taskId } = req.params;

        try {
            // Find the task and determine its project.
            const task =
                await getTaskWithProject(taskId);

            if (!task) {
                return res.status(404).json({
                    message: 'Task not found.',
                });
            }

            const projectId =
                task.column.projectId;

            // Check project access.
            const hasAccess =
                await userHasProjectAccess(
                    projectId,
                    req
                );

            if (hasAccess === null) {
                return res.status(404).json({
                    message: 'Project not found.',
                });
            }

            if (!hasAccess) {
                return res.status(403).json({
                    message:
                        'You do not have access to this project.',
                });
            }

            const comments =
                await prisma.comment.findMany({
                    where: {
                        taskId,
                    },
                    orderBy: {
                        createdAt: 'desc',
                    },
                });

            // Format for frontend.
            const formattedComments =
                comments.map((comment) => ({
                    id: comment.id,
                    userName: comment.userName,
                    userInitials:
                        comment.userName
                            .charAt(0)
                            .toUpperCase(),
                    timestamp:
                        comment.createdAt.toLocaleString(),
                    content: comment.content,
                }));

            res.json(formattedComments);
        } catch (error) {
            console.error(
                '❌ Error fetching comments:',
                error
            );

            res.status(500).json({
                message:
                    'Failed to fetch comments',
                error,
            });
        }
    }
);


// ==========================================
// POST CREATE NEW COMMENT
// POST /api/comments/task/:taskId
// ==========================================

router.post(
    '/task/:taskId',
    authenticateUser,
    async (
        req: AuthenticatedRequest,
        res
    ) => {
        const { taskId } = req.params;

        const { content } = req.body;

        if (!content) {
            return res.status(400).json({
                message:
                    'Comment content is required.',
            });
        }

        try {
            // Find the task and determine its project.
            const task =
                await getTaskWithProject(taskId);

            if (!task) {
                return res.status(404).json({
                    message: 'Task not found.',
                });
            }

            const projectId =
                task.column.projectId;

            // Check project access.
            const hasAccess =
                await userHasProjectAccess(
                    projectId,
                    req
                );

            if (hasAccess === null) {
                return res.status(404).json({
                    message: 'Project not found.',
                });
            }

            if (!hasAccess) {
                return res.status(403).json({
                    message:
                        'You do not have access to this project.',
                });
            }

            // Get the authenticated user's name.
            const user = await prisma.user.findUnique({
                where: {
                    id: req.user!.id,
                },
                select: {
                    name: true,
                },
            });

            if (!user) {
                return res.status(404).json({
                    message: 'User not found.',
                });
            }

            const newComment =
                await prisma.comment.create({
                    data: {
                        taskId,
                        userId: req.user!.id,
                        userName: user.name,
                        content,
                    },
                });

            // Format response for frontend.
            res.status(201).json({
                id: newComment.id,
                userName: newComment.userName,
                userInitials:
                    newComment.userName
                        .charAt(0)
                        .toUpperCase(),
                timestamp:
                    newComment.createdAt.toLocaleString(),
                content: newComment.content,
            });
        } catch (error) {
            console.error(
                '❌ Error creating comment:',
                error
            );

            res.status(500).json({
                message:
                    'Failed to create comment record',
                error,
            });
        }
    }
);


export default router;