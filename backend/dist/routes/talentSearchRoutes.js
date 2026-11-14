import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateUser, authorizeRoles, } from '../middleware/authMiddleware.js';
const prisma = new PrismaClient();
const router = Router();
// ─────────────────────────────────────────────────────────────────
// GET /api/talent-search
// Multi-criteria student talent matching:
// - Matches against a selected Job Role OR an ad-hoc set of Skill IDs
// - Distinguishes Faculty-Verified Competencies from Project Exposure
// - Filters by Match Mode ('VERIFIED_ONLY' vs 'ALL_DEMONSTRATED')
// - Filters by minimum match percentage, department, and graduation year
// ─────────────────────────────────────────────────────────────────
router.get('/', authenticateUser, authorizeRoles('ADMIN'), async (req, res) => {
    try {
        const jobRoleId = typeof req.query.jobRoleId === 'string' ? req.query.jobRoleId.trim() : '';
        const skillIdsQuery = typeof req.query.skillIds === 'string' ? req.query.skillIds.trim() : '';
        const matchMode = req.query.matchMode === 'VERIFIED_ONLY' ? 'VERIFIED_ONLY' : 'ALL_DEMONSTRATED';
        const minMatch = parseInt(typeof req.query.minMatch === 'string' ? req.query.minMatch : '0', 10) || 0;
        const searchQuery = typeof req.query.searchQuery === 'string' ? req.query.searchQuery.trim().toLowerCase() : '';
        const departmentFilter = typeof req.query.department === 'string' ? req.query.department.trim() : '';
        const gradYearFilter = typeof req.query.graduationYear === 'string' ? req.query.graduationYear.trim() : '';
        let targetTitle = 'Custom Skill Query';
        let targetDescription = null;
        let requiredSkills = [];
        // 1. Determine target competencies (S_req)
        if (jobRoleId) {
            const jobRole = await prisma.jobRole.findFirst({
                where: { id: jobRoleId, isActive: true },
                select: {
                    id: true,
                    title: true,
                    description: true,
                    requiredSkills: {
                        select: {
                            skill: {
                                select: { id: true, name: true, category: true, isActive: true },
                            },
                        },
                    },
                },
            });
            if (!jobRole) {
                return res.status(404).json({ message: 'Active job role not found.' });
            }
            targetTitle = jobRole.title;
            targetDescription = jobRole.description;
            requiredSkills = jobRole.requiredSkills
                .map((item) => item.skill)
                .filter((s) => s.isActive);
        }
        else if (skillIdsQuery) {
            const ids = skillIdsQuery.split(',').map((id) => id.trim()).filter(Boolean);
            requiredSkills = await prisma.skill.findMany({
                where: { id: { in: ids }, isActive: true },
                select: { id: true, name: true, category: true },
            });
            targetTitle = `${requiredSkills.length} Selected Competencies`;
        }
        else {
            return res.status(400).json({
                message: 'Please provide either a jobRoleId or skillIds parameter.',
            });
        }
        const totalRequiredSkills = requiredSkills.length;
        const requiredSkillIds = new Set(requiredSkills.map((s) => s.id));
        // 2. Fetch students with optional department/grad year filters
        const studentWhere = { role: 'STUDENT' };
        if (departmentFilter) {
            studentWhere.department = { contains: departmentFilter, mode: 'insensitive' };
        }
        if (gradYearFilter) {
            studentWhere.graduationYear = gradYearFilter;
        }
        const students = await prisma.user.findMany({
            where: studentWhere,
            select: {
                id: true,
                name: true,
                email: true,
                headline: true,
                department: true,
                studentIdNo: true,
                graduationYear: true,
                shareableSlug: true,
            },
        });
        // 3. Match each student against required competencies
        const candidateList = await Promise.all(students.map(async (student) => {
            // A. Fetch verified skills for this student (Paper Eq. 3-4)
            const verifiedRecords = await prisma.studentSkill.findMany({
                where: {
                    studentId: student.id,
                    verification: 'VERIFIED',
                },
                select: {
                    skillId: true,
                    level: true,
                    verifiedAt: true,
                    feedback: true,
                    verifiedBy: {
                        select: { id: true, name: true, email: true },
                    },
                },
            });
            const verifiedMap = new Map();
            for (const vr of verifiedRecords) {
                verifiedMap.set(vr.skillId, vr);
            }
            // B. Fetch project exposure for this student
            const projects = await prisma.project.findMany({
                where: {
                    OR: [
                        { students: { some: { studentId: student.id } } },
                        { createdById: student.id },
                    ],
                },
                select: {
                    id: true,
                    title: true,
                    status: true,
                    projectSkills: {
                        where: { skill: { isActive: true } },
                        select: {
                            skill: { select: { id: true, name: true } },
                        },
                    },
                },
                orderBy: { updatedAt: 'desc' },
            });
            const exposureEvidenceMap = new Map();
            for (const project of projects) {
                for (const ps of project.projectSkills) {
                    if (!requiredSkillIds.has(ps.skill.id))
                        continue;
                    if (!exposureEvidenceMap.has(ps.skill.id)) {
                        exposureEvidenceMap.set(ps.skill.id, []);
                    }
                    exposureEvidenceMap.get(ps.skill.id).push({
                        id: project.id,
                        title: project.title,
                        status: project.status,
                    });
                }
            }
            // C. Match calculation
            const matchedSkills = [];
            const missingSkills = [];
            let verifiedMatchCount = 0;
            for (const reqSkill of requiredSkills) {
                const isVerified = verifiedMap.has(reqSkill.id);
                const projects = exposureEvidenceMap.get(reqSkill.id) || [];
                const hasExposure = projects.length > 0;
                if (isVerified) {
                    verifiedMatchCount++;
                }
                const isMatched = matchMode === 'VERIFIED_ONLY' ? isVerified : (isVerified || hasExposure);
                if (isMatched) {
                    const vInfo = verifiedMap.get(reqSkill.id);
                    matchedSkills.push({
                        id: reqSkill.id,
                        name: reqSkill.name,
                        category: reqSkill.category,
                        isVerified,
                        level: vInfo?.level || 'INTERMEDIATE',
                        verifiedBy: vInfo?.verifiedBy || null,
                        feedback: vInfo?.feedback || null,
                        verifiedAt: vInfo?.verifiedAt || null,
                        projects,
                    });
                }
                else {
                    missingSkills.push({
                        id: reqSkill.id,
                        name: reqSkill.name,
                        category: reqSkill.category,
                    });
                }
            }
            const matchPercentage = totalRequiredSkills > 0
                ? Math.round((matchedSkills.length / totalRequiredSkills) * 100)
                : 0;
            const verifiedMatchPercentage = totalRequiredSkills > 0
                ? Math.round((verifiedMatchCount / totalRequiredSkills) * 100)
                : 0;
            return {
                id: student.id,
                name: student.name,
                email: student.email,
                headline: student.headline,
                department: student.department,
                studentIdNo: student.studentIdNo,
                graduationYear: student.graduationYear,
                shareableSlug: student.shareableSlug,
                totalProjects: projects.length,
                matchPercentage,
                verifiedMatchPercentage,
                matchedSkillCount: matchedSkills.length,
                verifiedMatchCount,
                totalRequiredSkills,
                matchedSkills,
                missingSkills,
            };
        }));
        // 4. Apply search query and minMatch filters
        let filtered = candidateList.filter((c) => {
            if (c.matchPercentage < minMatch)
                return false;
            if (searchQuery) {
                const nameMatch = (c.name || '').toLowerCase().includes(searchQuery);
                const emailMatch = c.email.toLowerCase().includes(searchQuery);
                const headlineMatch = (c.headline || '').toLowerCase().includes(searchQuery);
                if (!nameMatch && !emailMatch && !headlineMatch)
                    return false;
            }
            return true;
        });
        // 5. Candidate Ranking:
        // Primary: matchPercentage descending
        // Secondary: verifiedMatchPercentage descending (prioritizes certified skills)
        // Tertiary: totalProjects descending
        // Quaternary: name alphabetical
        filtered.sort((a, b) => b.matchPercentage - a.matchPercentage ||
            b.verifiedMatchPercentage - a.verifiedMatchPercentage ||
            b.totalProjects - a.totalProjects ||
            (a.name ?? '').localeCompare(b.name ?? ''));
        return res.json({
            targetTitle,
            targetDescription,
            matchMode,
            totalRequiredSkills,
            totalCandidatesMatched: filtered.length,
            totalStudentsEvaluated: students.length,
            verificationNote: matchMode === 'VERIFIED_ONLY'
                ? 'Strict Mode: Matches strictly against faculty-verified competencies (Eq. 3-4).'
                : 'Comprehensive Mode: Distinguishes faculty-verified competencies from project exposure tools.',
            students: filtered,
        });
    }
    catch (error) {
        console.error('Error performing talent search:', error);
        return res.status(500).json({ message: 'Failed to perform talent search.' });
    }
});
// ─────────────────────────────────────────────────────────────────
// GET /api/talent-search/analytics
// Institutional Skill Gap & University-Wide Readiness Analytics:
// - Evaluates demand from active Job Roles vs student verified supply
// - Identifies top institutional skill shortages
// - Provides student placement readiness tiers (>=80%, 50-79%, <50%)
// ─────────────────────────────────────────────────────────────────
router.get('/analytics', authenticateUser, authorizeRoles('ADMIN'), async (_req, res) => {
    try {
        // 1. Fetch all active skills, job roles, and students
        const [skills, jobRoles, totalStudents, studentSkills, projects] = await Promise.all([
            prisma.skill.findMany({
                where: { isActive: true },
                select: { id: true, name: true, category: true },
            }),
            prisma.jobRole.findMany({
                where: { isActive: true },
                select: {
                    id: true,
                    title: true,
                    requiredSkills: {
                        select: { skillId: true },
                    },
                },
            }),
            prisma.user.count({ where: { role: 'STUDENT' } }),
            prisma.studentSkill.findMany({
                select: {
                    skillId: true,
                    studentId: true,
                    verification: true,
                },
            }),
            prisma.projectSkill.findMany({
                select: {
                    skillId: true,
                    project: {
                        select: {
                            students: { select: { studentId: true } },
                            createdById: true,
                        },
                    },
                },
            }),
        ]);
        // Count verified students per skill
        const verifiedStudentMap = new Map();
        for (const ss of studentSkills) {
            if (ss.verification === 'VERIFIED') {
                if (!verifiedStudentMap.has(ss.skillId)) {
                    verifiedStudentMap.set(ss.skillId, new Set());
                }
                verifiedStudentMap.get(ss.skillId).add(ss.studentId);
            }
        }
        // Count exposure students per skill
        const exposureStudentMap = new Map();
        for (const ps of projects) {
            if (!exposureStudentMap.has(ps.skillId)) {
                exposureStudentMap.set(ps.skillId, new Set());
            }
            for (const st of ps.project.students) {
                exposureStudentMap.get(ps.skillId).add(st.studentId);
            }
            if (ps.project.createdById) {
                exposureStudentMap.get(ps.skillId).add(ps.project.createdById);
            }
        }
        // Count role demand per skill
        const roleDemandMap = new Map();
        for (const role of jobRoles) {
            for (const rs of role.requiredSkills) {
                roleDemandMap.set(rs.skillId, (roleDemandMap.get(rs.skillId) || 0) + 1);
            }
        }
        // 2. Build Skill Gap Insights
        const skillGapTable = skills.map((skill) => {
            const requiredInRoles = roleDemandMap.get(skill.id) || 0;
            const verifiedStudents = verifiedStudentMap.get(skill.id)?.size || 0;
            const exposureStudents = exposureStudentMap.get(skill.id)?.size || 0;
            // Gap calculation: If required in roles, shortfall between target student pool and verified students
            const targetStudentPool = requiredInRoles > 0 ? Math.max(1, Math.round(totalStudents * 0.4)) : 0;
            const shortage = Math.max(0, targetStudentPool - verifiedStudents);
            const gapPercentage = targetStudentPool > 0
                ? Math.round((shortage / targetStudentPool) * 100)
                : 0;
            return {
                id: skill.id,
                name: skill.name,
                category: skill.category || 'General',
                requiredInRoles,
                verifiedStudents,
                exposureStudents,
                shortage,
                gapPercentage,
            };
        });
        // Top shortage skills (High demand in roles, low verification)
        const topShortages = [...skillGapTable]
            .filter((s) => s.requiredInRoles > 0)
            .sort((a, b) => b.shortage - a.shortage || b.gapPercentage - a.gapPercentage)
            .slice(0, 6);
        // Top verified competencies
        const topVerified = [...skillGapTable]
            .sort((a, b) => b.verifiedStudents - a.verifiedStudents)
            .slice(0, 6);
        // 3. Role Readiness Tier Breakdown
        // For each job role, evaluate how many students are Ready (>=80%), Progressing (50-79%), Developing (<50%)
        const roleReadiness = jobRoles.map((role) => {
            const reqSkillIds = role.requiredSkills.map((r) => r.skillId);
            const totalReq = reqSkillIds.length;
            let readyCount = 0;
            let progressingCount = 0;
            let developingCount = 0;
            if (totalReq > 0) {
                // Check for each student
                // Gather student verified + exposure sets
                const allStudentIds = new Set();
                for (const s of studentSkills)
                    allStudentIds.add(s.studentId);
                for (const sId of allStudentIds) {
                    let matched = 0;
                    for (const rId of reqSkillIds) {
                        const isV = verifiedStudentMap.get(rId)?.has(sId);
                        const isE = exposureStudentMap.get(rId)?.has(sId);
                        if (isV || isE)
                            matched++;
                    }
                    const pct = Math.round((matched / totalReq) * 100);
                    if (pct >= 80)
                        readyCount++;
                    else if (pct >= 50)
                        progressingCount++;
                    else
                        developingCount++;
                }
            }
            return {
                id: role.id,
                title: role.title,
                totalRequiredSkills: totalReq,
                readyCount,
                progressingCount,
                developingCount,
            };
        });
        return res.json({
            totalStudents,
            totalJobRoles: jobRoles.length,
            totalActiveSkills: skills.length,
            topShortages,
            topVerified,
            roleReadiness,
            skillGapTable,
        });
    }
    catch (error) {
        console.error('Error fetching talent analytics:', error);
        return res.status(500).json({ message: 'Failed to fetch talent analytics.' });
    }
});
export default router;
//# sourceMappingURL=talentSearchRoutes.js.map