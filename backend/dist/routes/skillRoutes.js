import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateUser, authorizeRoles, } from '../middleware/authMiddleware.js';
const prisma = new PrismaClient();
const router = Router();
/*
  ==========================================
  GET SKILLS
  GET /api/skills
  ==========================================

  ADMIN
  → Can see all skills, including disabled ones.

  FACULTY / STUDENT
  → Can see active skills only.
*/
router.get('/', authenticateUser, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                message: 'Authentication required.',
            });
        }
        const isAdmin = req.user.role === 'ADMIN';
        const skills = await prisma.skill.findMany({
            where: isAdmin
                ? {}
                : {
                    isActive: true,
                },
            orderBy: [
                {
                    isActive: 'desc',
                },
                {
                    name: 'asc',
                },
            ],
        });
        return res.json(skills);
    }
    catch (error) {
        console.error('Error fetching skills:', error);
        return res.status(500).json({
            message: 'Failed to fetch skills.',
        });
    }
});
/*
  ==========================================
  CREATE SKILL
  POST /api/skills
  ==========================================

  ADMIN ONLY
*/
router.post('/', authenticateUser, authorizeRoles('ADMIN'), async (req, res) => {
    try {
        const { name, category, description, } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({
                message: 'Skill name is required.',
            });
        }
        const existingSkill = await prisma.skill.findUnique({
            where: {
                name: name.trim(),
            },
        });
        if (existingSkill) {
            return res.status(409).json({
                message: 'A skill with this name already exists.',
            });
        }
        const skill = await prisma.skill.create({
            data: {
                name: name.trim(),
                category: category?.trim() || null,
                description: description?.trim() || null,
            },
        });
        return res.status(201).json(skill);
    }
    catch (error) {
        console.error('Error creating skill:', error);
        return res.status(500).json({
            message: 'Failed to create skill.',
        });
    }
});
/*
  ==========================================
  UPDATE SKILL
  PUT /api/skills/:id
  ==========================================

  ADMIN ONLY
*/
router.put('/:id', authenticateUser, authorizeRoles('ADMIN'), async (req, res) => {
    try {
        const { id } = req.params;
        const { name, category, description, isActive, } = req.body;
        const existingSkill = await prisma.skill.findUnique({
            where: {
                id,
            },
        });
        if (!existingSkill) {
            return res.status(404).json({
                message: 'Skill not found.',
            });
        }
        if (name !== undefined) {
            if (!name.trim()) {
                return res.status(400).json({
                    message: 'Skill name cannot be empty.',
                });
            }
            const duplicateSkill = await prisma.skill.findFirst({
                where: {
                    name: name.trim(),
                    NOT: {
                        id,
                    },
                },
            });
            if (duplicateSkill) {
                return res.status(409).json({
                    message: 'A skill with this name already exists.',
                });
            }
        }
        const updatedSkill = await prisma.skill.update({
            where: {
                id,
            },
            data: {
                ...(name !== undefined && {
                    name: name.trim(),
                }),
                ...(category !== undefined && {
                    category: category?.trim() || null,
                }),
                ...(description !== undefined && {
                    description: description?.trim() || null,
                }),
                ...(isActive !== undefined && {
                    isActive,
                }),
            },
        });
        return res.json(updatedSkill);
    }
    catch (error) {
        console.error('Error updating skill:', error);
        return res.status(500).json({
            message: 'Failed to update skill.',
        });
    }
});
/*
  ==========================================
  DISABLE SKILL
  DELETE /api/skills/:id
  ==========================================

  Soft delete only.
  Historical project/student skill records
  are preserved.

  ADMIN ONLY
*/
router.delete('/:id', authenticateUser, authorizeRoles('ADMIN'), async (req, res) => {
    try {
        const { id } = req.params;
        const existingSkill = await prisma.skill.findUnique({
            where: {
                id,
            },
        });
        if (!existingSkill) {
            return res.status(404).json({
                message: 'Skill not found.',
            });
        }
        const updatedSkill = await prisma.skill.update({
            where: {
                id,
            },
            data: {
                isActive: false,
            },
        });
        return res.json({
            message: 'Skill disabled successfully.',
            skill: updatedSkill,
        });
    }
    catch (error) {
        console.error('Error disabling skill:', error);
        return res.status(500).json({
            message: 'Failed to disable skill.',
        });
    }
});
export default router;
//# sourceMappingURL=skillRoutes.js.map