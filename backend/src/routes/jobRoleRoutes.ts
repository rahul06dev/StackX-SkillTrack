
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

import {
    authenticateUser,
    authorizeRoles,
} from '../middleware/authMiddleware.js';

const prisma = new PrismaClient();
const router = Router();

router.use(authenticateUser);
router.use(authorizeRoles('ADMIN'));

// GET /api/job-roles
router.get('/', async (_req, res) => {
    try {
        const roles = await prisma.jobRole.findMany({
            include: {
                requiredSkills: {
                    include: {
                        skill: true,
                    },
                },
            },
            orderBy: {
                title: 'asc',
            },
        });

        return res.json(roles);
    } catch (error) {
        console.error('Error fetching job roles:', error);
        return res.status(500).json({
            message: 'Failed to fetch job roles.',
        });
    }
});

// POST /api/job-roles
router.post('/', async (req, res) => {
    try {
        const title =
            typeof req.body.title === 'string'
                ? req.body.title.trim()
                : '';

        const description =
            typeof req.body.description === 'string'
                ? req.body.description.trim()
                : null;

        const rawSkillIds: unknown = req.body.skillIds;

        const skillIds: string[] = Array.isArray(rawSkillIds)
            ? [...new Set(
                rawSkillIds.filter(
                    (id: unknown): id is string =>
                        typeof id === 'string'
                )
            )]
            : [];

        if (!title) {
            return res.status(400).json({
                message: 'Job role title is required.',
            });
        }

        if (
            !Array.isArray(req.body.skillIds) ||
            skillIds.length !== req.body.skillIds.length
        ) {
            return res.status(400).json({
                message: 'skillIds must be an array of unique skill IDs.',
            });
        }

        if (skillIds.length === 0) {
            return res.status(400).json({
                message: 'Select at least one required skill.',
            });
        }

        const activeSkills = await prisma.skill.findMany({
            where: {
                id: { in: skillIds },
                isActive: true,
            },
            select: { id: true },
        });

        if (activeSkills.length !== skillIds.length) {
            return res.status(400).json({
                message: 'One or more selected skills are invalid or inactive.',
            });
        }

        const role = await prisma.jobRole.create({
            data: {
                title,
                description,
                requiredSkills: {
                    create: skillIds.map((skillId) => ({
                        skill: {
                            connect: { id: skillId },
                        },
                    })),
                },
            },
            include: {
                requiredSkills: {
                    include: {
                        skill: true,
                    },
                },
            },
        });

        return res.status(201).json(role);
    } catch (error) {
        if (
            error &&
            typeof error === 'object' &&
            'code' in error &&
            error.code === 'P2002'
        ) {
            return res.status(409).json({
                message: 'A job role with this title already exists.',
            });
        }

        console.error('Error creating job role:', error);
        return res.status(500).json({
            message: 'Failed to create job role.',
        });
    }
});

// PUT /api/job-roles/:id
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const existingRole = await prisma.jobRole.findUnique({
            where: { id },
        });

        if (!existingRole) {
            return res.status(404).json({
                message: 'Job role not found.',
            });
        }

        const data: {
            title?: string;
            description?: string | null;
            isActive?: boolean;
        } = {};

        if (req.body.title !== undefined) {
            if (
                typeof req.body.title !== 'string' ||
                !req.body.title.trim()
            ) {
                return res.status(400).json({
                    message: 'Job role title must not be empty.',
                });
            }

            data.title = req.body.title.trim();
        }

        if (req.body.description !== undefined) {
            if (
                req.body.description !== null &&
                typeof req.body.description !== 'string'
            ) {
                return res.status(400).json({
                    message: 'Description must be a string or null.',
                });
            }

            data.description =
                typeof req.body.description === 'string'
                    ? req.body.description.trim()
                    : null;
        }

        if (req.body.isActive !== undefined) {
            if (typeof req.body.isActive !== 'boolean') {
                return res.status(400).json({
                    message: 'isActive must be a boolean.',
                });
            }

            data.isActive = req.body.isActive;
        }

        const updatesSkills = req.body.skillIds !== undefined;
        let skillIds: string[] = [];

        if (updatesSkills) {
            if (
                !Array.isArray(req.body.skillIds) ||
                !req.body.skillIds.every(
                    (skillId: unknown) => typeof skillId === 'string'
                )
            ) {
                return res.status(400).json({
                    message: 'skillIds must be an array of skill IDs.',
                });
            }

            skillIds = [
                ...new Set(
                    (req.body.skillIds as unknown[]).filter(
                        (skillId): skillId is string =>
                            typeof skillId === 'string'
                    )
                ),
            ];

            if (skillIds.length === 0) {
                return res.status(400).json({
                    message: 'Select at least one required skill.',
                });
            }

            const activeSkills = await prisma.skill.findMany({
                where: {
                    id: { in: skillIds },
                    isActive: true,
                },
                select: { id: true },
            });

            if (activeSkills.length !== skillIds.length) {
                return res.status(400).json({
                    message: 'One or more selected skills are invalid or inactive.',
                });
            }
        }

        const role = await prisma.$transaction(async (tx) => {
            if (updatesSkills) {
                await tx.jobRoleSkill.deleteMany({
                    where: { jobRoleId: id },
                });
            }

            return tx.jobRole.update({
                where: { id },
                data: {
                    ...data,
                    ...(updatesSkills
                        ? {
                            requiredSkills: {
                                create: skillIds.map((skillId) => ({
                                    skill: {
                                        connect: { id: skillId },
                                    },
                                })),
                            },
                        }
                        : {}),
                },
                include: {
                    requiredSkills: {
                        include: {
                            skill: true,
                        },
                    },
                },
            });
        });

        return res.json(role);
    } catch (error) {
        if (
            error &&
            typeof error === 'object' &&
            'code' in error &&
            error.code === 'P2002'
        ) {
            return res.status(409).json({
                message: 'A job role with this title already exists.',
            });
        }

        console.error('Error updating job role:', error);
        return res.status(500).json({
            message: 'Failed to update job role.',
        });
    }
});

// DELETE /api/job-roles/:id
// Soft-delete: retain the role and its requirements.
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const role = await prisma.jobRole.findUnique({
            where: { id },
        });

        if (!role) {
            return res.status(404).json({
                message: 'Job role not found.',
            });
        }

        await prisma.jobRole.update({
            where: { id },
            data: { isActive: false },
        });

        return res.json({
            message: 'Job role deactivated successfully.',
        });
    } catch (error) {
        console.error('Error deactivating job role:', error);
        return res.status(500).json({
            message: 'Failed to deactivate job role.',
        });
    }
});

export default router;
