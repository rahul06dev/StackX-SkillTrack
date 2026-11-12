import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateUser, authorizeRoles, } from '../middleware/authMiddleware.js';
const prisma = new PrismaClient();
const router = Router();
// GET /api/student-skills/me
// Build the logged-in student's skill profile from assigned projects.
router.get('/me', authenticateUser, authorizeRoles('STUDENT'), async (req, res) => {
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
                                category: true,
                                description: true,
                            },
                        },
                    },
                },
            },
            orderBy: {
                updatedAt: 'desc',
            },
        });
        // Group skills across projects so each skill appears only once.
        const skillMap = new Map();
        for (const project of projects) {
            for (const projectSkill of project.projectSkills) {
                const skill = projectSkill.skill;
                if (!skillMap.has(skill.id)) {
                    skillMap.set(skill.id, {
                        id: skill.id,
                        name: skill.name,
                        category: skill.category,
                        description: skill.description,
                        projects: [],
                    });
                }
                const profileSkill = skillMap.get(skill.id);
                profileSkill.projects.push({
                    id: project.id,
                    title: project.title,
                    status: project.status,
                });
            }
        }
        const skills = Array.from(skillMap.values()).sort((a, b) => a.name.localeCompare(b.name));
        return res.json({
            totalSkills: skills.length,
            totalProjects: projects.length,
            skills,
        });
    }
    catch (error) {
        console.error('Error fetching student skills profile:', error);
        return res.status(500).json({
            message: 'Failed to fetch student skills profile.',
        });
    }
});
export default router;
//# sourceMappingURL=studentSkillsRoutes.js.map