import { Router } from 'express';
import crypto from 'crypto';
import { PrismaClient, SkillLevel } from '@prisma/client';
import { authenticateUser, authorizeRoles, } from '../middleware/authMiddleware.js';
import { logActivity } from '../services/activityService.js';
import { createNotification } from '../services/notificationService.js';
const prisma = new PrismaClient();
const router = Router();
// ─────────────────────────────────────────────────────────────────
// GET /api/student-skills/me
// Strictly implements Eq. (3)-(4) of the research paper:
// Only faculty-verified skills populate the student verified profile.
// Categorizes into verified competencies, pending claims, and rejected claims.
// ─────────────────────────────────────────────────────────────────
router.get('/me', authenticateUser, authorizeRoles('STUDENT'), async (req, res) => {
    try {
        const studentId = req.user?.id;
        if (!studentId) {
            return res.status(401).json({
                message: 'Authentication required.',
            });
        }
        // 1. Projects this student is enrolled in
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
        // 2. Build Project Exposure map (skills used in projects, not yet all verified)
        const exposureMap = new Map();
        for (const project of projects) {
            for (const projectSkill of project.projectSkills) {
                const skill = projectSkill.skill;
                if (!exposureMap.has(skill.id)) {
                    exposureMap.set(skill.id, {
                        id: skill.id,
                        name: skill.name,
                        category: skill.category,
                        description: skill.description,
                        projects: [],
                    });
                }
                exposureMap.get(skill.id).projects.push({
                    id: project.id,
                    title: project.title,
                    status: project.status,
                });
            }
        }
        const exposureSkills = Array.from(exposureMap.values()).sort((a, b) => a.name.localeCompare(b.name));
        // 3. Fetch all StudentSkill claim records (Verified, Pending, Rejected)
        const studentSkillRecords = await prisma.studentSkill.findMany({
            where: { studentId },
            select: {
                id: true,
                level: true,
                verification: true,
                verifiedAt: true,
                rejectionReason: true,
                feedback: true,
                createdAt: true,
                updatedAt: true,
                skill: {
                    select: {
                        id: true,
                        name: true,
                        category: true,
                        description: true,
                    },
                },
                verifiedBy: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
                evidence: {
                    select: {
                        project: {
                            select: {
                                id: true,
                                title: true,
                                status: true,
                            },
                        },
                    },
                },
            },
            orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
        });
        // (A) VERIFIED COMPETENCIES (Paper Eq. 3-4)
        const verifiedSkills = studentSkillRecords
            .filter((ss) => ss.verification === 'VERIFIED')
            .map((ss) => ({
            id: ss.id,
            skillId: ss.skill.id,
            name: ss.skill.name,
            category: ss.skill.category,
            description: ss.skill.description,
            level: ss.level,
            verification: ss.verification,
            verifiedAt: ss.verifiedAt,
            verifiedBy: ss.verifiedBy,
            feedback: ss.feedback,
            projects: ss.evidence.map((e) => e.project),
        }));
        // (B) PENDING CLAIMS
        const pendingSkills = studentSkillRecords
            .filter((ss) => ss.verification === 'PENDING')
            .map((ss) => ({
            id: ss.id,
            skillId: ss.skill.id,
            name: ss.skill.name,
            category: ss.skill.category,
            description: ss.skill.description,
            level: ss.level,
            verification: ss.verification,
            createdAt: ss.createdAt,
            projects: ss.evidence.map((e) => e.project),
        }));
        // (C) REJECTED CLAIMS (With Faculty Feedback & Reason)
        const rejectedSkills = studentSkillRecords
            .filter((ss) => ss.verification === 'REJECTED')
            .map((ss) => ({
            id: ss.id,
            skillId: ss.skill.id,
            name: ss.skill.name,
            category: ss.skill.category,
            description: ss.skill.description,
            level: ss.level,
            verification: ss.verification,
            rejectionReason: ss.rejectionReason,
            feedback: ss.feedback,
            verifiedBy: ss.verifiedBy,
            updatedAt: ss.updatedAt,
            projects: ss.evidence.map((e) => e.project),
        }));
        // Backwards-compatible submittedSkills list
        const submittedSkills = studentSkillRecords.map((ss) => ({
            id: ss.id,
            name: ss.skill.name,
            category: ss.skill.category,
            description: ss.skill.description,
            level: ss.level,
            verification: ss.verification,
            rejectionReason: ss.rejectionReason,
            feedback: ss.feedback,
            verifiedBy: ss.verifiedBy,
            verifiedAt: ss.verifiedAt,
            projects: ss.evidence.map((e) => e.project),
        }));
        return res.json({
            totalVerifiedSkills: verifiedSkills.length,
            totalPendingClaims: pendingSkills.length,
            totalRejectedClaims: rejectedSkills.length,
            totalSkills: verifiedSkills.length, // Eq 3-4: profile size is verified skills
            totalProjects: projects.length,
            // Clean taxonomy
            verifiedSkills,
            pendingSkills,
            rejectedSkills,
            exposureSkills,
            // Backwards compatibility
            skills: verifiedSkills,
            submittedSkills,
        });
    }
    catch (error) {
        console.error('Error fetching student skills profile:', error);
        return res.status(500).json({
            message: 'Failed to fetch student skills profile.',
        });
    }
});
// ─────────────────────────────────────────────────────────────────
// POST /api/student-skills/submit
// Student submits or resubmits a skill claim backed by project evidence.
// If previously REJECTED, resets to PENDING for faculty review.
// ─────────────────────────────────────────────────────────────────
router.post('/submit', authenticateUser, authorizeRoles('STUDENT'), async (req, res) => {
    try {
        const studentId = req.user?.id;
        if (!studentId) {
            return res.status(401).json({ message: 'Authentication required.' });
        }
        const { skillId, projectId, level } = req.body;
        if (!skillId || !projectId) {
            return res.status(400).json({
                message: 'skillId and projectId are required.',
            });
        }
        // Validate student is enrolled in that project or is project creator
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            select: { createdById: true },
        });
        if (!project) {
            return res.status(404).json({ message: 'Project not found.' });
        }
        let enrollment = await prisma.projectStudent.findUnique({
            where: {
                projectId_studentId: {
                    projectId,
                    studentId,
                },
            },
        });
        if (!enrollment && project.createdById === studentId) {
            enrollment = await prisma.projectStudent.upsert({
                where: {
                    projectId_studentId: {
                        projectId,
                        studentId,
                    },
                },
                create: {
                    projectId,
                    studentId,
                },
                update: {},
            });
        }
        if (!enrollment && project.createdById !== studentId) {
            return res.status(403).json({
                message: 'You are not enrolled in this project.',
            });
        }
        // Validate skill is active.
        const skill = await prisma.skill.findUnique({
            where: { id: skillId },
            select: { id: true, name: true, isActive: true },
        });
        if (!skill || !skill.isActive) {
            return res.status(400).json({
                message: 'Skill not found or not active.',
            });
        }
        const requestedLevel = level && ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'].includes(level)
            ? level
            : 'BEGINNER';
        // Atomic Database Transaction (Phase 8: Transaction Isolation & Integrity)
        // Guarantees studentSkill claim and its supporting project evidence are committed atomically.
        const studentSkill = await prisma.$transaction(async (tx) => {
            const ss = await tx.studentSkill.upsert({
                where: {
                    studentId_skillId: {
                        studentId,
                        skillId,
                    },
                },
                create: {
                    studentId,
                    skillId,
                    level: requestedLevel,
                    verification: 'PENDING',
                },
                update: {
                    level: requestedLevel,
                    verification: 'PENDING',
                    rejectionReason: null,
                    feedback: null,
                    verifiedById: null,
                    verifiedAt: null,
                },
                select: {
                    id: true,
                    studentId: true,
                    skillId: true,
                    level: true,
                    verification: true,
                    createdAt: true,
                    updatedAt: true,
                },
            });
            // Create evidence link (skip if already exists)
            await tx.studentSkillEvidence.upsert({
                where: {
                    studentSkillId_projectId: {
                        studentSkillId: ss.id,
                        projectId,
                    },
                },
                create: {
                    studentSkillId: ss.id,
                    projectId,
                },
                update: {},
            });
            return ss;
        });
        const studentUser = await prisma.user.findUnique({
            where: { id: studentId },
            select: { name: true },
        });
        await logActivity({
            projectId,
            userId: studentId,
            userName: studentUser?.name || 'Student',
            action: 'SKILL_CLAIMED',
            details: `Submitted skill claim for "${skill.name}" (${requestedLevel})`,
        });
        return res.status(201).json({
            message: 'Skill claim submitted successfully and routed to faculty guide for review.',
            studentSkill,
        });
    }
    catch (error) {
        console.error('Error submitting skill claim:', error);
        return res.status(500).json({
            message: 'Failed to submit skill claim.',
        });
    }
});
// ─────────────────────────────────────────────────────────────────
// GET /api/student-skills/pending
// FACULTY: PENDING records where evidence links to supervised projects.
// ADMIN:   ALL PENDING records across the university.
// ─────────────────────────────────────────────────────────────────
router.get('/pending', authenticateUser, authorizeRoles('FACULTY', 'ADMIN'), async (req, res) => {
    try {
        const userId = req.user?.id;
        const userRole = req.user?.role;
        if (!userId) {
            return res.status(401).json({ message: 'Authentication required.' });
        }
        let pendingSkills;
        if (userRole === 'ADMIN') {
            pendingSkills = await prisma.studentSkill.findMany({
                where: { verification: 'PENDING' },
                select: {
                    id: true,
                    level: true,
                    verification: true,
                    createdAt: true,
                    student: {
                        select: { id: true, name: true, email: true },
                    },
                    skill: {
                        select: { id: true, name: true, category: true, description: true },
                    },
                    evidence: {
                        select: {
                            project: {
                                select: { id: true, title: true, status: true },
                            },
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
            });
        }
        else {
            // FACULTY: only records where evidence links to a project they supervise or created.
            pendingSkills = await prisma.studentSkill.findMany({
                where: {
                    verification: 'PENDING',
                    evidence: {
                        some: {
                            project: {
                                OR: [
                                    { assignedFacultyId: userId },
                                    { createdById: userId },
                                ],
                            },
                        },
                    },
                },
                select: {
                    id: true,
                    level: true,
                    verification: true,
                    createdAt: true,
                    student: {
                        select: { id: true, name: true, email: true },
                    },
                    skill: {
                        select: { id: true, name: true, category: true, description: true },
                    },
                    evidence: {
                        select: {
                            project: {
                                select: { id: true, title: true, status: true },
                            },
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
            });
        }
        const result = pendingSkills.map((ss) => ({
            id: ss.id,
            level: ss.level,
            verification: ss.verification,
            createdAt: ss.createdAt,
            student: ss.student,
            skill: ss.skill,
            evidence: ss.evidence.map((e) => e.project),
        }));
        return res.json(result);
    }
    catch (error) {
        console.error('Error fetching pending skill claims:', error);
        return res.status(500).json({
            message: 'Failed to fetch pending skill claims.',
        });
    }
});
// ─────────────────────────────────────────────────────────────────
// PATCH /api/student-skills/:id/verify
// Faculty approves a skill claim.
// Updates verification=VERIFIED, records verifiedById, verifiedAt, feedback.
// ─────────────────────────────────────────────────────────────────
router.patch('/:id/verify', authenticateUser, authorizeRoles('FACULTY', 'ADMIN'), async (req, res) => {
    try {
        const userId = req.user?.id;
        const userRole = req.user?.role;
        const studentSkillId = req.params.id;
        const { level, feedback } = req.body;
        if (!userId) {
            return res.status(401).json({ message: 'Authentication required.' });
        }
        // Load the record with evidence and skill for access and audit checks.
        const existing = await prisma.studentSkill.findUnique({
            where: { id: studentSkillId },
            include: {
                skill: { select: { name: true } },
                student: { select: { id: true, name: true } },
                evidence: {
                    select: {
                        project: {
                            select: {
                                id: true,
                                title: true,
                                assignedFacultyId: true,
                                createdById: true,
                            },
                        },
                    },
                },
            },
        });
        if (!existing) {
            return res.status(404).json({ message: 'Skill claim not found.' });
        }
        // Faculty access check: Must be supervisor or creator of an evidence project.
        if (userRole === 'FACULTY') {
            const hasAccess = existing.evidence.some((e) => e.project.assignedFacultyId === userId ||
                e.project.createdById === userId);
            if (!hasAccess) {
                return res.status(403).json({
                    message: 'You can only verify skills for projects you supervise or created.',
                });
            }
        }
        const updatedLevel = level && ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'].includes(level)
            ? level
            : existing.level;
        const updated = await prisma.studentSkill.update({
            where: { id: studentSkillId },
            data: {
                verification: 'VERIFIED',
                level: updatedLevel,
                verifiedById: userId,
                verifiedAt: new Date(),
                rejectionReason: null,
                feedback: feedback ? String(feedback).trim() : null,
            },
            include: {
                skill: { select: { id: true, name: true, category: true } },
                student: { select: { id: true, name: true, email: true } },
                verifiedBy: { select: { id: true, name: true, email: true } },
            },
        });
        // Log verification activity on evidence projects
        const verifier = await prisma.user.findUnique({
            where: { id: userId },
            select: { name: true },
        });
        for (const ev of existing.evidence) {
            await logActivity({
                projectId: ev.project.id,
                userId,
                userName: verifier?.name || 'Faculty Guide',
                action: 'SKILL_VERIFIED',
                details: `Verified skill "${existing.skill.name}" for ${existing.student.name} at level ${updatedLevel}`,
            });
        }
        // Notify student of skill verification (Phase 7)
        await createNotification({
            userId: existing.student.id,
            type: 'SKILL_VERIFIED',
            title: 'Skill Claim Approved!',
            message: `Faculty verified your competency in "${existing.skill.name}" at level ${updatedLevel}.${feedback ? ` Feedback: "${feedback}"` : ''}`,
            link: '/student',
        });
        return res.json({
            message: `Competency in "${existing.skill.name}" verified and added to student profile.`,
            studentSkill: updated,
        });
    }
    catch (error) {
        console.error('Error verifying skill claim:', error);
        return res.status(500).json({
            message: 'Failed to verify skill claim.',
        });
    }
});
// ─────────────────────────────────────────────────────────────────
// PATCH /api/student-skills/:id/reject
// Faculty declines a skill claim with constructive rejection feedback.
// Sets verification=REJECTED (persisting record for tracking).
// ─────────────────────────────────────────────────────────────────
router.patch('/:id/reject', authenticateUser, authorizeRoles('FACULTY', 'ADMIN'), async (req, res) => {
    try {
        const userId = req.user?.id;
        const userRole = req.user?.role;
        const studentSkillId = req.params.id;
        const { rejectionReason, feedback } = req.body;
        if (!userId) {
            return res.status(401).json({ message: 'Authentication required.' });
        }
        // Load the record with evidence for access check.
        const existing = await prisma.studentSkill.findUnique({
            where: { id: studentSkillId },
            include: {
                skill: { select: { name: true } },
                student: { select: { id: true, name: true } },
                evidence: {
                    select: {
                        project: {
                            select: {
                                id: true,
                                title: true,
                                assignedFacultyId: true,
                                createdById: true,
                            },
                        },
                    },
                },
            },
        });
        if (!existing) {
            return res.status(404).json({ message: 'Skill claim not found.' });
        }
        // Faculty access check.
        if (userRole === 'FACULTY') {
            const hasAccess = existing.evidence.some((e) => e.project.assignedFacultyId === userId ||
                e.project.createdById === userId);
            if (!hasAccess) {
                return res.status(403).json({
                    message: 'You can only review skill claims for projects you supervise or created.',
                });
            }
        }
        const reasonText = rejectionReason
            ? String(rejectionReason).trim()
            : 'Evidence provided was insufficient for course competency verification.';
        const updated = await prisma.studentSkill.update({
            where: { id: studentSkillId },
            data: {
                verification: 'REJECTED',
                verifiedById: userId,
                verifiedAt: new Date(),
                rejectionReason: reasonText,
                feedback: feedback ? String(feedback).trim() : null,
            },
            include: {
                skill: { select: { id: true, name: true, category: true } },
                student: { select: { id: true, name: true, email: true } },
                verifiedBy: { select: { id: true, name: true, email: true } },
            },
        });
        const reviewer = await prisma.user.findUnique({
            where: { id: userId },
            select: { name: true },
        });
        for (const ev of existing.evidence) {
            await logActivity({
                projectId: ev.project.id,
                userId,
                userName: reviewer?.name || 'Faculty Guide',
                action: 'SKILL_REJECTED',
                details: `Rejected skill claim "${existing.skill.name}" for ${existing.student.name}: ${reasonText}`,
            });
        }
        // Notify student of skill rejection (Phase 7)
        await createNotification({
            userId: existing.student.id,
            type: 'SKILL_REJECTED',
            title: 'Skill Claim Requires Revision',
            message: `Your claim for "${existing.skill.name}" was not approved. Feedback: "${reasonText}".`,
            link: '/student',
        });
        return res.json({
            message: 'Skill claim rejected with feedback.',
            studentSkill: updated,
        });
    }
    catch (error) {
        console.error('Error rejecting skill claim:', error);
        return res.status(500).json({
            message: 'Failed to reject skill claim.',
        });
    }
});
// ─────────────────────────────────────────────────────────────────
// GET /api/student-skills/admin/overview
// Admin university-wide skill verification analytics.
// ─────────────────────────────────────────────────────────────────
router.get('/admin/overview', authenticateUser, authorizeRoles('ADMIN'), async (_req, res) => {
    try {
        const [totalClaims, verifiedClaims, pendingClaims, rejectedClaims] = await Promise.all([
            prisma.studentSkill.count(),
            prisma.studentSkill.count({ where: { verification: 'VERIFIED' } }),
            prisma.studentSkill.count({ where: { verification: 'PENDING' } }),
            prisma.studentSkill.count({ where: { verification: 'REJECTED' } }),
        ]);
        const recentVerifications = await prisma.studentSkill.findMany({
            where: { verification: { in: ['VERIFIED', 'REJECTED'] } },
            select: {
                id: true,
                verification: true,
                level: true,
                verifiedAt: true,
                rejectionReason: true,
                feedback: true,
                student: { select: { id: true, name: true, email: true } },
                skill: { select: { id: true, name: true, category: true } },
                verifiedBy: { select: { id: true, name: true, email: true } },
            },
            orderBy: { verifiedAt: 'desc' },
            take: 10,
        });
        const decidedClaims = verifiedClaims + rejectedClaims;
        const approvalRate = decidedClaims > 0 ? Math.round((verifiedClaims / decidedClaims) * 100) : 0;
        return res.json({
            totalClaims,
            verifiedClaims,
            pendingClaims,
            rejectedClaims,
            approvalRate,
            recentVerifications,
        });
    }
    catch (err) {
        console.error('Error fetching admin skill overview:', err);
        return res.status(500).json({ message: 'Failed to fetch admin skill overview.' });
    }
});
// ─────────────────────────────────────────────────────────────────
// GET /api/student-skills/public/:identifier
// PUBLIC Digital Skill Passport & Portfolio (No auth required)
// Open for recruiters, employers, and external review.
// Accessible via student UUID or unique shareableSlug.
// ─────────────────────────────────────────────────────────────────
router.get('/public/:identifier', async (req, res) => {
    try {
        const { identifier } = req.params;
        if (!identifier) {
            return res.status(400).json({ message: 'Student identifier or slug is required.' });
        }
        return await buildPortfolio(identifier, res);
    }
    catch (error) {
        console.error('Error fetching public portfolio:', error);
        return res.status(500).json({ message: 'Failed to fetch public portfolio.' });
    }
});
// ─────────────────────────────────────────────────────────────────
// GET /api/student-skills/portfolio
// Logged-in student's own portfolio.
// ─────────────────────────────────────────────────────────────────
router.get('/portfolio', authenticateUser, authorizeRoles('STUDENT'), async (req, res) => {
    try {
        const studentId = req.user?.id;
        if (!studentId) {
            return res.status(401).json({ message: 'Authentication required.' });
        }
        return await buildPortfolio(studentId, res);
    }
    catch (error) {
        console.error('Error fetching portfolio:', error);
        return res.status(500).json({ message: 'Failed to fetch portfolio.' });
    }
});
// ─────────────────────────────────────────────────────────────────
// GET /api/student-skills/portfolio/:studentId
// FACULTY or ADMIN views any student's portfolio.
// ─────────────────────────────────────────────────────────────────
router.get('/portfolio/:studentId', authenticateUser, authorizeRoles('FACULTY', 'ADMIN'), async (req, res) => {
    try {
        const { studentId } = req.params;
        const student = await prisma.user.findFirst({
            where: {
                OR: [{ id: studentId }, { shareableSlug: studentId }],
            },
            select: { id: true, role: true },
        });
        if (!student || student.role !== 'STUDENT') {
            return res.status(404).json({ message: 'Student not found.' });
        }
        return await buildPortfolio(student.id, res);
    }
    catch (error) {
        console.error('Error fetching portfolio:', error);
        return res.status(500).json({ message: 'Failed to fetch portfolio.' });
    }
});
// ─────────────────────────────────────────────────────────────────
// Shared portfolio builder (Equations 3-4 strictly honored)
// ─────────────────────────────────────────────────────────────────
async function buildPortfolio(identifier, res) {
    // Support lookup by UUID or custom shareableSlug
    const student = await prisma.user.findFirst({
        where: {
            OR: [{ id: identifier }, { shareableSlug: identifier }],
        },
        select: {
            id: true,
            name: true,
            email: true,
            role: true,
            headline: true,
            bio: true,
            department: true,
            studentIdNo: true,
            graduationYear: true,
            githubUrl: true,
            linkedinUrl: true,
            shareableSlug: true,
            createdAt: true,
        },
    });
    if (!student) {
        return res.status(404).json({ message: 'Student portfolio not found.' });
    }
    const studentId = student.id;
    // Projects this student is enrolled in or created
    const projects = await prisma.project.findMany({
        where: {
            OR: [
                { students: { some: { studentId } } },
                { createdById: studentId },
            ],
        },
        select: {
            id: true,
            title: true,
            description: true,
            status: true,
            createdById: true,
            assignedFaculty: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                },
            },
            projectSkills: {
                where: { skill: { isActive: true } },
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
        orderBy: { updatedAt: 'desc' },
    });
    // Build project-derived exposure skill map.
    const projectSkillMap = new Map();
    for (const project of projects) {
        for (const ps of project.projectSkills) {
            const s = ps.skill;
            if (!projectSkillMap.has(s.id)) {
                projectSkillMap.set(s.id, {
                    id: s.id,
                    name: s.name,
                    category: s.category,
                    projects: [],
                });
            }
            projectSkillMap.get(s.id).projects.push({
                id: project.id,
                title: project.title,
                status: project.status,
            });
        }
    }
    const projectSkills = Array.from(projectSkillMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    // Verified StudentSkill records (Verified only - Paper Eq. 3-4).
    const verifiedRecords = await prisma.studentSkill.findMany({
        where: { studentId, verification: 'VERIFIED' },
        select: {
            id: true,
            level: true,
            verifiedAt: true,
            feedback: true,
            verifiedBy: {
                select: { id: true, name: true, email: true },
            },
            skill: {
                select: {
                    id: true,
                    name: true,
                    category: true,
                    description: true,
                },
            },
            evidence: {
                select: {
                    project: {
                        select: { id: true, title: true, status: true },
                    },
                },
            },
        },
        orderBy: [{ verifiedAt: 'desc' }, { updatedAt: 'desc' }],
    });
    const verifiedSkills = verifiedRecords.map((vs) => ({
        id: vs.id,
        name: vs.skill.name,
        category: vs.skill.category,
        description: vs.skill.description,
        level: vs.level,
        verifiedAt: vs.verifiedAt,
        verifiedBy: vs.verifiedBy,
        feedback: vs.feedback,
        projects: vs.evidence.map((e) => e.project),
    }));
    // Projects summary with role and tech stack
    const projectsSummary = projects.map((p) => ({
        id: p.id,
        title: p.title,
        description: p.description,
        status: p.status,
        role: p.createdById === studentId ? 'Project Owner / Creator' : 'Core Team Member',
        supervisor: p.assignedFaculty ? p.assignedFaculty.name : 'Faculty Supervised',
        skills: p.projectSkills.map((ps) => ps.skill.name),
    }));
    // Generate Digital Passport Certificate verification token
    const rawHash = crypto
        .createHash('sha256')
        .update(`${student.id}:${student.email}:${verifiedSkills.length}:${projects.length}`)
        .digest('hex')
        .slice(0, 16)
        .toUpperCase();
    const verificationCode = `${rawHash.slice(0, 4)}-${rawHash.slice(4, 8)}-${rawHash.slice(8, 12)}-${rawHash.slice(12, 16)}`;
    const certificate = {
        certificateId: `STX-${student.id.slice(0, 8).toUpperCase()}-PASSPORT`,
        verificationCode,
        institution: 'MIT ADT University · StackX SkillTrack Competency Registry',
        issuedAt: new Date().toISOString(),
        status: verifiedSkills.length > 0 ? 'ACADEMICALLY_CERTIFIED' : 'ACTIVE_CANDIDATE',
    };
    return res.json({
        student,
        certificate,
        summary: {
            totalProjectSkills: projectSkills.length,
            totalVerifiedSkills: verifiedSkills.length,
            totalProjects: projects.length,
        },
        verifiedSkills,
        projectSkills,
        projects: projectsSummary,
    });
}
export default router;
//# sourceMappingURL=studentSkillsRoutes.js.map