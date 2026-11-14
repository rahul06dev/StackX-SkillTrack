import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateUser, authorizeRoles, authorizeProjectAccess, } from '../middleware/authMiddleware.js';
import { executeRuleEngine } from '../services/ruleEngine.js';
import { logActivity } from '../services/activityService.js';
import { createNotification } from '../services/notificationService.js';
const prisma = new PrismaClient();
const router = Router();
router.get('/admin/overview', authenticateUser, authorizeRoles('ADMIN'), async (req, res) => {
    try {
        const now = new Date();
        const [totalUsers, totalStudents, totalFaculty, totalProjects, activeProjects, completedProjects, overdueProjects, unassignedGuideProjects, pendingInvitationsCount, totalTasksCount,] = await Promise.all([
            prisma.user.count(),
            prisma.user.count({
                where: {
                    role: 'STUDENT',
                },
            }),
            prisma.user.count({
                where: {
                    role: 'FACULTY',
                },
            }),
            prisma.project.count(),
            prisma.project.count({
                where: {
                    status: 'ACTIVE',
                },
            }),
            prisma.project.count({
                where: {
                    status: 'COMPLETED',
                },
            }),
            prisma.project.count({
                where: {
                    status: 'ACTIVE',
                    columns: {
                        some: {
                            title: { notIn: ['Completed', 'Done'] },
                            tasks: {
                                some: {
                                    dueDate: {
                                        lt: now,
                                    },
                                },
                            },
                        },
                    },
                },
            }),
            prisma.project.count({
                where: {
                    assignedFacultyId: null,
                },
            }),
            prisma.projectInvitation.count({
                where: {
                    status: 'PENDING',
                },
            }),
            prisma.task.count(),
        ]);
        res.json({
            totalUsers,
            totalStudents,
            totalFaculty,
            totalProjects,
            activeProjects,
            completedProjects,
            overdueProjects,
            unassignedGuideProjects,
            pendingInvitationsCount,
            totalTasksCount,
        });
    }
    catch (error) {
        console.error('❌ Error fetching admin dashboard overview:', error);
        res.status(500).json({
            message: 'Failed to fetch admin dashboard overview.',
        });
    }
});
router.get('/admin/recent', authenticateUser, authorizeRoles('ADMIN'), async (req, res) => {
    try {
        const projects = await prisma.project.findMany({
            select: {
                id: true,
                title: true,
                description: true,
                status: true,
                tasksCount: true,
                membersCount: true,
                createdAt: true,
                updatedAt: true,
            },
            orderBy: {
                updatedAt: 'desc',
            },
            take: 5,
        });
        const formatted = projects.map(p => ({
            ...p,
            peopleCount: p.membersCount,
        }));
        res.json(formatted);
    }
    catch (error) {
        console.error('❌ Error fetching recent admin projects:', error);
        res.status(500).json({
            message: 'Failed to fetch recent projects.',
        });
    }
});
router.get('/admin/projects', authenticateUser, authorizeRoles('ADMIN'), async (req, res) => {
    try {
        const projects = await prisma.project.findMany({
            include: {
                students: {
                    include: {
                        student: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                                role: true,
                            },
                        },
                    },
                },
                assignedFaculty: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        role: true,
                    },
                },
                admins: {
                    include: {
                        admin: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                                role: true,
                            },
                        },
                    },
                },
                columns: {
                    include: {
                        tasks: true,
                    },
                },
            },
            orderBy: {
                updatedAt: 'desc',
            },
        });
        const formattedProjects = projects.map((project) => {
            const students = project.students.map((assignment) => assignment.student);
            const faculty = project.assignedFaculty
                ? [project.assignedFaculty]
                : [];
            const admins = project.admins.map((assignment) => assignment.admin);
            const tasksCount = project.columns.reduce((total, column) => total + column.tasks.length, 0);
            const peopleCount = students.length +
                faculty.length +
                admins.length;
            return {
                id: project.id,
                title: project.title,
                description: project.description,
                status: project.status,
                tasksCount,
                peopleCount,
                students,
                faculty,
                admins,
                createdAt: project.createdAt,
                updatedAt: project.updatedAt,
                createdById: project.createdById,
                assignedFaculty: project.assignedFaculty
                    ? {
                        id: project.assignedFaculty.id,
                        name: project.assignedFaculty.name,
                        email: project.assignedFaculty.email,
                    }
                    : null,
            };
        });
        res.json(formattedProjects);
    }
    catch (error) {
        console.error('❌ Error fetching admin projects:', error);
        res.status(500).json({
            message: 'Failed to fetch admin projects.',
        });
    }
});
// --- Project GET Route ---
router.get('/', authenticateUser, authorizeRoles('STUDENT', 'FACULTY', 'ADMIN'), async (req, res) => {
    try {
        const userWhereClause = req.user?.role === 'STUDENT'
            ? {
                students: {
                    some: {
                        studentId: req.user.id,
                    },
                },
            }
            : req.user?.role === 'FACULTY'
                ? {
                    OR: [
                        { assignedFacultyId: req.user.id },
                        { createdById: req.user.id },
                    ],
                }
                : {};
        const projects = await prisma.project.findMany({
            where: userWhereClause,
            include: {
                students: {
                    include: {
                        student: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                                role: true,
                            },
                        },
                    },
                },
                assignedFaculty: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        role: true,
                    },
                },
                admins: {
                    include: {
                        admin: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                                role: true,
                            },
                        },
                    },
                },
                columns: {
                    include: {
                        tasks: {
                            select: {
                                id: true,
                                dueDate: true,
                            },
                        },
                    },
                },
            },
            orderBy: {
                updatedAt: 'desc',
            },
        });
        const formattedProjects = projects.map((project) => {
            const students = project.students.map((assignment) => assignment.student);
            const faculty = project.assignedFaculty ? [project.assignedFaculty] : [];
            const admins = project.admins.map((assignment) => assignment.admin);
            const tasksCount = project.columns.reduce((acc, column) => acc + column.tasks.length, 0);
            const peopleCount = students.length + faculty.length + admins.length;
            return {
                id: project.id,
                title: project.title,
                description: project.description,
                status: project.status,
                tasksCount,
                tasks: tasksCount, // Alias for backward compatibility
                membersCount: peopleCount,
                peopleCount, // Alias
                members: peopleCount, // Alias
                students,
                faculty,
                admins,
                createdAt: project.createdAt,
                updatedAt: project.updatedAt,
                createdById: project.createdById,
                assignedFaculty: project.assignedFaculty
                    ? {
                        id: project.assignedFaculty.id,
                        name: project.assignedFaculty.name,
                        email: project.assignedFaculty.email,
                    }
                    : null,
            };
        });
        res.json(formattedProjects);
    }
    catch (error) {
        console.error('❌ Error fetching projects:', error);
        res.status(500).json({
            message: 'Failed to fetch projects',
            error,
        });
    }
});
// --- Faculty Upcoming Deadlines ---
// GET /api/projects/faculty/deadlines
router.get('/faculty/deadlines', authenticateUser, authorizeRoles('FACULTY'), async (req, res) => {
    try {
        const facultyId = req.user?.id;
        if (!facultyId) {
            return res.status(401).json({
                message: 'Authentication required.',
            });
        }
        const deadlines = await prisma.task.findMany({
            where: {
                dueDate: {
                    gte: new Date(),
                },
                column: {
                    project: {
                        OR: [
                            { assignedFacultyId: facultyId },
                            { createdById: facultyId },
                        ],
                    },
                },
            },
            select: {
                id: true,
                title: true,
                priority: true,
                dueDate: true,
                column: {
                    select: {
                        project: {
                            select: {
                                id: true,
                                title: true,
                            },
                        },
                    },
                },
            },
            orderBy: {
                dueDate: 'asc',
            },
            take: 5,
        });
        const formattedDeadlines = deadlines.map((task) => ({
            id: task.id,
            title: task.title,
            priority: task.priority,
            dueDate: task.dueDate,
            projectId: task.column.project.id,
            projectTitle: task.column.project.title,
        }));
        res.json(formattedDeadlines);
    }
    catch (error) {
        console.error('❌ Error fetching faculty deadlines:', error);
        res.status(500).json({
            message: 'Failed to fetch faculty deadlines',
            error,
        });
    }
});
router.get('/team-options', authenticateUser, authorizeRoles('ADMIN'), async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            where: {
                role: {
                    in: ['STUDENT', 'FACULTY', 'ADMIN'],
                },
            },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
            },
            orderBy: {
                name: 'asc',
            },
        });
        const students = users.filter((user) => user.role === 'STUDENT');
        const faculty = users.filter((user) => user.role === 'FACULTY');
        const admins = users.filter((user) => user.role === 'ADMIN');
        res.json({
            students,
            faculty,
            admins,
        });
    }
    catch (error) {
        console.error('❌ Error fetching project team options:', error);
        res.status(500).json({
            message: 'Failed to fetch project team options.',
        });
    }
});
// --- Faculty List Route (for Project Guide Assignment / Invitations) ---
// Must be registered BEFORE /:id to prevent /faculty-list being captured as :id
router.get('/faculty-list', authenticateUser, async (req, res) => {
    try {
        const faculty = await prisma.user.findMany({
            where: { role: 'FACULTY' },
            select: { id: true, name: true, email: true },
            orderBy: { name: 'asc' },
        });
        return res.json(faculty);
    }
    catch (error) {
        console.error('Error fetching faculty list:', error);
        return res.status(500).json({ message: 'Failed to fetch faculty list.' });
    }
});
router.get('/:id', authenticateUser, authorizeRoles('STUDENT', 'FACULTY', 'ADMIN'), async (req, res) => {
    try {
        const projectId = req.params.id;
        if (!projectId) {
            return res.status(400).json({
                message: 'Project ID is required.',
            });
        }
        const project = await prisma.project.findUnique({
            where: {
                id: projectId,
            },
            include: {
                students: {
                    include: {
                        student: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                                role: true,
                            },
                        },
                    },
                },
                assignedFaculty: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        role: true,
                    },
                },
                admins: {
                    include: {
                        admin: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                                role: true,
                            },
                        },
                    },
                },
            },
        });
        if (!project) {
            return res.status(404).json({
                message: 'Project not found.',
            });
        }
        // -----------------------------------------
        // Check whether the current user can access
        // this project.
        // -----------------------------------------
        const userId = req.user?.id;
        const userRole = req.user?.role;
        const isAdmin = userRole === 'ADMIN';
        const isAssignedStudent = project.students.some((assignment) => assignment.studentId === userId);
        const isAssignedFaculty = project.assignedFacultyId === userId;
        const isCreator = project.createdById === userId;
        if (!isAdmin &&
            !isAssignedStudent &&
            !isAssignedFaculty &&
            !isCreator) {
            return res.status(403).json({
                message: 'You do not have access to this project.',
            });
        }
        const students = project.students.map((assignment) => assignment.student);
        const faculty = project.assignedFaculty
            ? [project.assignedFaculty]
            : [];
        const admins = project.admins.map((assignment) => assignment.admin);
        res.json({
            id: project.id,
            title: project.title,
            description: project.description,
            createdById: project.createdById,
            assignedFacultyId: project.assignedFacultyId,
            status: project.status,
            students,
            faculty,
            admins,
        });
    }
    catch (error) {
        console.error('❌ Error fetching project details:', error);
        res.status(500).json({
            message: 'Failed to fetch project details.',
        });
    }
});
router.put('/:id/team', authenticateUser, authorizeRoles('ADMIN', 'FACULTY'), async (req, res) => {
    try {
        const projectId = req.params.id;
        const { studentIds = [], facultyId = null, adminIds = [], } = req.body;
        if (!projectId) {
            return res.status(400).json({
                message: 'Project ID is required.',
            });
        }
        if (!Array.isArray(studentIds)) {
            return res.status(400).json({
                message: 'studentIds must be an array.',
            });
        }
        if (!Array.isArray(adminIds)) {
            return res.status(400).json({
                message: 'adminIds must be an array.',
            });
        }
        // Check that the project exists
        const project = await prisma.project.findUnique({
            where: {
                id: projectId,
            },
        });
        if (!project) {
            return res.status(404).json({
                message: 'Project not found.',
            });
        }
        // Faculty permission check: only allowed for supervised or created projects
        if (req.user?.role === 'FACULTY') {
            const isSupervisedOrCreated = project.assignedFacultyId === req.user.id ||
                project.createdById === req.user.id;
            if (!isSupervisedOrCreated) {
                return res.status(403).json({
                    message: 'You can only update team assignments for projects you supervise or created.',
                });
            }
        }
        // Validate Faculty
        if (facultyId) {
            const faculty = await prisma.user.findUnique({
                where: {
                    id: facultyId,
                },
            });
            if (!faculty || faculty.role !== 'FACULTY') {
                return res.status(400).json({
                    message: 'Invalid faculty user.',
                });
            }
        }
        // Validate Students
        if (studentIds.length > 0) {
            const students = await prisma.user.findMany({
                where: {
                    id: {
                        in: studentIds,
                    },
                    role: 'STUDENT',
                },
            });
            if (students.length !== studentIds.length) {
                return res.status(400).json({
                    message: 'One or more student IDs are invalid.',
                });
            }
        }
        // Validate Admins
        if (adminIds.length > 0) {
            const admins = await prisma.user.findMany({
                where: {
                    id: {
                        in: adminIds,
                    },
                    role: 'ADMIN',
                },
            });
            if (admins.length !== adminIds.length) {
                return res.status(400).json({
                    message: 'One or more admin IDs are invalid.',
                });
            }
        }
        // Replace student assignments
        await prisma.projectStudent.deleteMany({
            where: {
                projectId,
            },
        });
        if (studentIds.length > 0) {
            await prisma.projectStudent.createMany({
                data: studentIds.map((studentId) => ({
                    projectId,
                    studentId,
                })),
            });
        }
        // Replace admin assignments
        await prisma.projectAdmin.deleteMany({
            where: {
                projectId,
            },
        });
        if (adminIds.length > 0) {
            await prisma.projectAdmin.createMany({
                data: adminIds.map((adminId) => ({
                    projectId,
                    adminId,
                })),
            });
        }
        // Update assigned faculty
        await prisma.project.update({
            where: {
                id: projectId,
            },
            data: {
                assignedFacultyId: facultyId,
            },
        });
        res.json({
            message: 'Project team updated successfully.',
        });
    }
    catch (error) {
        console.error('❌ Error updating project team:', error);
        res.status(500).json({
            message: 'Failed to update project team.',
        });
    }
});
// --- Project POST Route (Create New Project) ---
// Applies rule-based mapping engine (R ⊆ T × S) from submitted technologies
// and project context to catalogue skills.
// Supports STUDENT, FACULTY, and ADMIN creation.
router.post('/', authenticateUser, authorizeRoles('FACULTY', 'ADMIN', 'STUDENT'), async (req, res) => {
    const { title, description, studentIds, technologies, assignedFacultyId } = req.body;
    if (typeof title !== 'string' ||
        !title.trim() ||
        typeof description !== 'string' ||
        !description.trim()) {
        return res.status(400).json({
            message: 'Title and description are required.',
        });
    }
    try {
        const userRole = req.user?.role;
        const userId = req.user.id;
        const projectText = `${title} ${description}`;
        // Parse technologies if provided as array or comma-separated string
        let techList = [];
        if (Array.isArray(technologies)) {
            techList = technologies.map(t => String(t).trim()).filter(Boolean);
        }
        else if (typeof technologies === 'string' && technologies.trim()) {
            techList = technologies.split(',').map(t => t.trim()).filter(Boolean);
        }
        // Fetch active skills from the Admin-managed catalogue.
        const activeSkills = await prisma.skill.findMany({
            where: { isActive: true },
            select: { id: true, name: true, category: true },
        });
        // Execute Formal Rule-Based Mapping Engine (R ⊆ T × S)
        const mappedResults = executeRuleEngine(techList, projectText, activeSkills);
        const matchedSkillIds = Array.from(new Set(mappedResults.map(m => m.skillId)));
        const isStudent = userRole === 'STUDENT';
        // Build student enrollment list
        // For student creators: only creator is enrolled immediately; teammates will be invited
        let studentCreateList = [];
        if (isStudent) {
            studentCreateList = [{ student: { connect: { id: userId } } }];
        }
        else if (Array.isArray(studentIds)) {
            studentCreateList = studentIds.map((studentId) => ({
                student: { connect: { id: studentId } },
            }));
        }
        // For students: assignedFacultyId is null initially until faculty accepts supervision invitation.
        // For Admin/Faculty: assignedFacultyId is assigned directly.
        const directFacultyId = isStudent ? null : (assignedFacultyId || null);
        const newProject = await prisma.project.create({
            data: {
                title: title.trim(),
                description: description.trim(),
                createdById: userId,
                assignedFacultyId: directFacultyId,
                students: {
                    create: studentCreateList,
                },
                admins: userRole === 'ADMIN' ? {
                    create: [{ admin: { connect: { id: userId } } }],
                } : undefined,
                // Attach matched skills
                projectSkills: {
                    create: matchedSkillIds.map((skillId) => ({
                        skill: { connect: { id: skillId } },
                    })),
                },
                // Default Kanban columns
                columns: {
                    create: [
                        { title: 'To Do', colorClass: 'todo', order: 0 },
                        { title: 'In Progress', colorClass: 'in-progress', order: 1 },
                        { title: 'In Review', colorClass: 'in-review', order: 2 },
                        { title: 'Completed', colorClass: 'completed', order: 3 },
                    ],
                },
            },
            include: {
                students: true,
                columns: {
                    orderBy: { order: 'asc' },
                },
                projectSkills: {
                    include: {
                        skill: {
                            select: { id: true, name: true, category: true },
                        },
                    },
                },
            },
        });
        // For student-created projects, dispatch pending invitations to teammates & faculty guide
        if (isStudent) {
            const creatorUser = await prisma.user.findUnique({
                where: { id: userId },
                select: { name: true },
            });
            // 1. Dispatch Faculty Guide invitation if requested
            if (assignedFacultyId) {
                const facultyUser = await prisma.user.findFirst({
                    where: { id: assignedFacultyId, role: 'FACULTY' },
                });
                if (facultyUser) {
                    await prisma.projectInvitation.create({
                        data: {
                            projectId: newProject.id,
                            recipientId: assignedFacultyId,
                            invitedById: userId,
                            type: 'FACULTY_GUIDE',
                            status: 'PENDING',
                            message: `Invited to supervise "${newProject.title}" as academic faculty guide.`,
                        },
                    });
                    // Role-specific notification to faculty
                    await createNotification({
                        userId: assignedFacultyId,
                        type: 'FACULTY_SUPERVISION_REQUEST',
                        title: 'Project Supervision Request',
                        message: `${creatorUser?.name || 'A student'} requested your academic guidance for "${newProject.title}".`,
                        link: '/faculty',
                    });
                }
            }
            // 2. Dispatch Team Member invitations if requested
            if (Array.isArray(studentIds) && studentIds.length > 0) {
                const otherStudentIds = studentIds.filter((sId) => sId !== userId);
                for (const sId of otherStudentIds) {
                    const studentUser = await prisma.user.findFirst({
                        where: { id: sId, role: 'STUDENT' },
                    });
                    if (studentUser) {
                        await prisma.projectInvitation.create({
                            data: {
                                projectId: newProject.id,
                                recipientId: sId,
                                invitedById: userId,
                                type: 'TEAM_MEMBER',
                                status: 'PENDING',
                                message: `Invited to join project team for "${newProject.title}".`,
                            },
                        });
                        // Role-specific notification to invited student
                        await createNotification({
                            userId: sId,
                            type: 'PROJECT_INVITATION',
                            title: 'Project Team Invitation',
                            message: `${creatorUser?.name || 'A classmate'} invited you to join the team for "${newProject.title}".`,
                            link: `/projects/${newProject.id}`,
                        });
                    }
                }
            }
        }
        // If created by a student, automatically generate PENDING StudentSkill claims
        // backed by this new project evidence (paper Eq. 1-2) using an atomic transaction (Phase 8)
        if (isStudent && matchedSkillIds.length > 0) {
            for (const skillId of matchedSkillIds) {
                try {
                    await prisma.$transaction(async (tx) => {
                        const studentSkill = await tx.studentSkill.upsert({
                            where: {
                                studentId_skillId: {
                                    studentId: userId,
                                    skillId,
                                },
                            },
                            create: {
                                studentId: userId,
                                skillId,
                                level: 'BEGINNER',
                                verification: 'PENDING',
                            },
                            update: {},
                        });
                        await tx.studentSkillEvidence.upsert({
                            where: {
                                studentSkillId_projectId: {
                                    studentSkillId: studentSkill.id,
                                    projectId: newProject.id,
                                },
                            },
                            create: {
                                studentSkillId: studentSkill.id,
                                projectId: newProject.id,
                            },
                            update: {},
                        });
                    });
                }
                catch (skillErr) {
                    console.error('Error auto-creating student skill claim:', skillErr);
                }
            }
        }
        // Log project creation activity
        const creator = await prisma.user.findUnique({
            where: { id: userId },
            select: { name: true },
        });
        await logActivity({
            projectId: newProject.id,
            userId,
            userName: creator?.name || 'User',
            action: 'PROJECT_CREATED',
            details: `Project "${newProject.title}" created (${userRole})`,
        });
        return res.status(201).json({
            id: newProject.id,
            title: newProject.title,
            description: newProject.description,
            createdById: newProject.createdById,
            assignedFacultyId: newProject.assignedFacultyId,
            tasks: newProject.tasksCount,
            members: newProject.membersCount,
            columns: newProject.columns,
            mappedSkills: newProject.projectSkills.map(ps => ps.skill),
            ruleMatches: mappedResults,
        });
    }
    catch (error) {
        console.error('Error creating project:', error);
        return res.status(500).json({
            message: 'Failed to create project.',
        });
    }
});
// --- Submit Technologies for a Project ---
// Enables students and faculty to log tools, frameworks, and technologies.
// Runs the rule mapping engine to detect skills and generates PENDING claims.
router.post('/:id/technologies', authenticateUser, authorizeProjectAccess, async (req, res) => {
    try {
        const projectId = req.params.id;
        const { technologies } = req.body;
        const userId = req.user.id;
        const userRole = req.user.role;
        let techList = [];
        if (Array.isArray(technologies)) {
            techList = technologies.map(t => String(t).trim()).filter(Boolean);
        }
        else if (typeof technologies === 'string' && technologies.trim()) {
            techList = technologies.split(',').map(t => t.trim()).filter(Boolean);
        }
        if (techList.length === 0) {
            return res.status(400).json({ message: 'Please provide at least one technology or tool.' });
        }
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            select: { id: true, title: true, description: true },
        });
        if (!project) {
            return res.status(404).json({ message: 'Project not found.' });
        }
        const activeSkills = await prisma.skill.findMany({
            where: { isActive: true },
            select: { id: true, name: true, category: true },
        });
        const projectText = `${project.title} ${project.description}`;
        const mappedResults = executeRuleEngine(techList, projectText, activeSkills);
        const skillIds = Array.from(new Set(mappedResults.map(m => m.skillId)));
        const newlyAddedSkills = [];
        for (const skillId of skillIds) {
            const existing = await prisma.projectSkill.findUnique({
                where: {
                    projectId_skillId: {
                        projectId,
                        skillId,
                    },
                },
            });
            if (!existing) {
                const created = await prisma.projectSkill.create({
                    data: {
                        projectId,
                        skillId,
                    },
                    include: {
                        skill: {
                            select: { id: true, name: true, category: true },
                        },
                    },
                });
                newlyAddedSkills.push(created.skill);
            }
            // If caller is student, generate student skill claim in PENDING state
            if (userRole === 'STUDENT') {
                const studentSkill = await prisma.studentSkill.upsert({
                    where: {
                        studentId_skillId: {
                            studentId: userId,
                            skillId,
                        },
                    },
                    create: {
                        studentId: userId,
                        skillId,
                        level: 'BEGINNER',
                        verification: 'PENDING',
                    },
                    update: {},
                });
                await prisma.studentSkillEvidence.upsert({
                    where: {
                        studentSkillId_projectId: {
                            studentSkillId: studentSkill.id,
                            projectId,
                        },
                    },
                    create: {
                        studentSkillId: studentSkill.id,
                        projectId,
                    },
                    update: {},
                });
            }
        }
        return res.json({
            message: `Technologies processed. ${newlyAddedSkills.length} new skill(s) mapped.`,
            newlyAddedSkills,
            mappedSkills: mappedResults,
        });
    }
    catch (error) {
        console.error('Error logging technologies:', error);
        return res.status(500).json({ message: 'Failed to log technologies.' });
    }
});
export default router;
//# sourceMappingURL=projectRoutes.js.map