import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateUser, } from '../middleware/authMiddleware.js';
const prisma = new PrismaClient();
const router = Router();
// ==========================================
// CHECK PROJECT ACCESS
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
// GET COLUMNS
// GET /api/columns?projectId=xxx
// ==========================================
router.get('/', authenticateUser, async (req, res) => {
    const { projectId } = req.query;
    if (!projectId || typeof projectId !== 'string') {
        return res.status(400).json({
            message: 'Project ID is required.',
        });
    }
    try {
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
        const columns = await prisma.column.findMany({
            where: {
                projectId,
            },
            select: {
                id: true,
                title: true,
                projectId: true,
                colorClass: true,
                order: true,
            },
            orderBy: {
                order: 'asc',
            },
        });
        res.json(columns);
    }
    catch (error) {
        console.error('❌ Error fetching columns:', error);
        res.status(500).json({
            message: 'Failed to fetch columns',
            error,
        });
    }
});
// ==========================================
// POST COLUMN
// POST /api/columns
// ==========================================
router.post('/', authenticateUser, async (req, res) => {
    const { title, projectId, colorClass, order, } = req.body;
    if (!title ||
        !projectId ||
        !colorClass ||
        order === undefined) {
        return res.status(400).json({
            message: 'Title, projectId (UUID), colorClass, and order are required.',
        });
    }
    if (typeof projectId !== 'string' ||
        projectId.length < 5) {
        return res.status(400).json({
            message: 'Invalid projectId format (must be a string/UUID).',
        });
    }
    try {
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
        const newColumn = await prisma.column.create({
            data: {
                title,
                projectId,
                colorClass,
                order: Number(order),
            },
        });
        res.status(201).json(newColumn);
    }
    catch (error) {
        console.error('❌ Error creating column:', error);
        res.status(500).json({
            message: 'Failed to create column',
            error,
        });
    }
});
// ==========================================
// DELETE COLUMN
// DELETE /api/columns/:id
// ==========================================
router.delete('/:id', authenticateUser, async (req, res) => {
    const { id } = req.params;
    try {
        // Find the column first so we can determine
        // which project it belongs to.
        const column = await prisma.column.findUnique({
            where: {
                id,
            },
            select: {
                id: true,
                projectId: true,
            },
        });
        if (!column) {
            return res.status(404).json({
                message: 'Column not found.',
            });
        }
        const hasAccess = await userHasProjectAccess(column.projectId, req);
        if (!hasAccess) {
            return res.status(403).json({
                message: 'You do not have access to this project.',
            });
        }
        // Delete associated tasks first.
        await prisma.task.deleteMany({
            where: {
                columnId: id,
            },
        });
        // Delete the column itself.
        await prisma.column.delete({
            where: {
                id,
            },
        });
        console.log(`✅ Column ID ${id} and associated tasks deleted.`);
        res.status(204).send();
    }
    catch (error) {
        console.error(`❌ Error deleting column ID ${id}:`, error);
        res.status(500).json({
            message: 'Failed to delete column',
            error,
        });
    }
});
export default router;
//# sourceMappingURL=columnRoutes.js.map