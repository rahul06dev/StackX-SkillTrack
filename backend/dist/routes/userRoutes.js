import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateUser, authorizeRoles, } from '../middleware/authMiddleware.js';
const prisma = new PrismaClient();
const router = Router();
router.get('/students', authenticateUser, authorizeRoles('FACULTY', 'ADMIN'), async (req, res) => {
    try {
        const students = await prisma.user.findMany({
            where: {
                role: 'STUDENT',
            },
            select: {
                id: true,
                name: true,
                email: true,
            },
            orderBy: {
                name: 'asc',
            },
        });
        res.json(students);
    }
    catch (error) {
        console.error('❌ Error fetching students:', error);
        res.status(500).json({
            message: 'Failed to fetch students',
            error,
        });
    }
});
export default router;
//# sourceMappingURL=userRoutes.js.map