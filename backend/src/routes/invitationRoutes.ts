import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import {
  authenticateUser,
  type AuthenticatedRequest,
} from '../middleware/authMiddleware.js';
import { logActivity } from '../services/activityService.js';
import { createNotification } from '../services/notificationService.js';

const prisma = new PrismaClient();
const router = Router();

// ==========================================
// 1. GET MY RECEIVED INVITATIONS
// GET /api/invitations/me
// ==========================================
router.get(
  '/me',
  authenticateUser,
  async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const status = req.query.status as string | undefined;

      const invitations = await prisma.projectInvitation.findMany({
        where: {
          recipientId: userId,
          ...(status ? { status: status as any } : {}),
        },
        include: {
          project: {
            select: {
              id: true,
              title: true,
              description: true,
              status: true,
              createdAt: true,
              createdBy: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
          invitedBy: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      return res.json(invitations);
    } catch (error) {
      console.error('Error fetching received invitations:', error);
      return res.status(500).json({ message: 'Failed to fetch invitations.' });
    }
  }
);

// ==========================================
// 2. GET INVITATIONS FOR A PROJECT
// GET /api/invitations/project/:projectId
// ==========================================
router.get(
  '/project/:projectId',
  authenticateUser,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { projectId } = req.params;
      const userId = req.user!.id;
      const userRole = req.user!.role;

      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: {
          createdById: true,
          assignedFacultyId: true,
          students: {
            where: { studentId: userId },
            select: { id: true },
          },
          faculty: {
            where: { facultyId: userId },
            select: { id: true },
          },
        },
      });

      if (!project) {
        return res.status(404).json({ message: 'Project not found.' });
      }

      const isOwner = project.createdById === userId;
      const isMember = project.students.length > 0;
      const isFaculty = project.assignedFacultyId === userId || project.faculty.length > 0;
      const isAdmin = userRole === 'ADMIN';

      if (!isOwner && !isMember && !isFaculty && !isAdmin) {
        return res.status(403).json({ message: 'Access denied to this project.' });
      }

      const invitations = await prisma.projectInvitation.findMany({
        where: { projectId },
        include: {
          recipient: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
          invitedBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      return res.json(invitations);
    } catch (error) {
      console.error('Error fetching project invitations:', error);
      return res.status(500).json({ message: 'Failed to fetch project invitations.' });
    }
  }
);

// ==========================================
// 3. SEARCH STUDENTS TO INVITE
// GET /api/invitations/search/students?projectId=...&q=...
// ==========================================
router.get(
  '/search/students',
  authenticateUser,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { projectId, q } = req.query;
      const searchTerm = typeof q === 'string' ? q.trim() : '';

      if (!projectId || typeof projectId !== 'string') {
        return res.status(400).json({ message: 'projectId is required.' });
      }

      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { createdById: true },
      });

      if (!project) {
        return res.status(404).json({ message: 'Project not found.' });
      }

      if (project.createdById !== req.user!.id && req.user!.role !== 'ADMIN') {
        return res.status(403).json({
          message: 'Only the project creator or an administrator can search students to invite.',
        });
      }

      // Fetch already assigned student IDs
      const assigned = await prisma.projectStudent.findMany({
        where: { projectId },
        select: { studentId: true },
      });
      const assignedIds = new Set(assigned.map((a) => a.studentId));

      // Fetch pending invited student IDs
      const pendingInvites = await prisma.projectInvitation.findMany({
        where: {
          projectId,
          status: 'PENDING',
          type: 'TEAM_MEMBER',
        },
        select: { recipientId: true },
      });
      const pendingIds = new Set(pendingInvites.map((p) => p.recipientId));

      const students = await prisma.user.findMany({
        where: {
          role: 'STUDENT',
          id: {
            notIn: [req.user!.id, ...Array.from(assignedIds), ...Array.from(pendingIds)],
          },
          ...(searchTerm
            ? {
                OR: [
                  { name: { contains: searchTerm, mode: 'insensitive' } },
                  { email: { contains: searchTerm, mode: 'insensitive' } },
                ],
              }
            : {}),
        },
        select: {
          id: true,
          name: true,
          email: true,
        },
        take: 10,
        orderBy: { name: 'asc' },
      });

      return res.json(students);
    } catch (error) {
      console.error('Error searching students to invite:', error);
      return res.status(500).json({ message: 'Failed to search students.' });
    }
  }
);

// ==========================================
// 4. INVITE TEAM MEMBER (STUDENT)
// POST /api/invitations/project/:projectId/team
// ==========================================
router.post(
  '/project/:projectId/team',
  authenticateUser,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { projectId } = req.params;
      const { recipientId, message } = req.body;
      const userId = req.user!.id;
      const userRole = req.user!.role;

      if (!recipientId) {
        return res.status(400).json({ message: 'recipientId is required.' });
      }

      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { id: true, title: true, createdById: true },
      });

      if (!project) {
        return res.status(404).json({ message: 'Project not found.' });
      }

      // Only Project Creator or Admin can invite team members
      if (project.createdById !== userId && userRole !== 'ADMIN') {
        return res.status(403).json({
          message: 'Only the project creator or an administrator can invite team members.',
        });
      }

      if (recipientId === userId) {
        return res.status(400).json({ message: 'You cannot invite yourself.' });
      }

      const recipient = await prisma.user.findUnique({
        where: { id: recipientId },
        select: { id: true, name: true, email: true, role: true },
      });

      if (!recipient || recipient.role !== 'STUDENT') {
        return res.status(400).json({ message: 'Invited recipient must be a valid student.' });
      }

      // Check if already assigned
      const alreadyAssigned = await prisma.projectStudent.findUnique({
        where: {
          projectId_studentId: {
            projectId,
            studentId: recipientId,
          },
        },
      });

      if (alreadyAssigned) {
        return res.status(400).json({ message: 'Student is already a member of this project.' });
      }

      // Check if already pending invitation exists
      const existingPending = await prisma.projectInvitation.findFirst({
        where: {
          projectId,
          recipientId,
          type: 'TEAM_MEMBER',
          status: 'PENDING',
        },
      });

      if (existingPending) {
        return res.status(400).json({
          message: 'A pending invitation has already been sent to this student.',
        });
      }

      const inviter = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true },
      });

      const invitation = await prisma.projectInvitation.create({
        data: {
          projectId,
          invitedById: userId,
          recipientId,
          type: 'TEAM_MEMBER',
          status: 'PENDING',
          message: message ? String(message).trim() : null,
        },
        include: {
          recipient: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      await logActivity({
        projectId,
        userId,
        userName: inviter?.name || 'Project Lead',
        action: 'INVITATION_SENT',
        details: `Invited student ${recipient.name} to join the project team`,
      });

      // Role-specific Notification (Phase 7)
      await createNotification({
        userId: recipientId,
        type: 'PROJECT_INVITATION',
        title: 'Project Team Invitation',
        message: `${inviter?.name || 'A team member'} invited you to join the team for "${project.title}".`,
        link: `/projects/${projectId}`,
      });

      return res.status(201).json({
        message: `Invitation successfully sent to ${recipient.name}.`,
        invitation,
      });
    } catch (error) {
      console.error('Error inviting team member:', error);
      return res.status(500).json({ message: 'Failed to invite team member.' });
    }
  }
);

// ==========================================
// 5. INVITE FACULTY GUIDE / SUPERVISOR
// POST /api/invitations/project/:projectId/faculty
// ==========================================
router.post(
  '/project/:projectId/faculty',
  authenticateUser,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { projectId } = req.params;
      const { recipientId, message } = req.body;
      const userId = req.user!.id;
      const userRole = req.user!.role;

      if (!recipientId) {
        return res.status(400).json({ message: 'recipientId is required.' });
      }

      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: {
          id: true,
          title: true,
          createdById: true,
          assignedFacultyId: true,
        },
      });

      if (!project) {
        return res.status(404).json({ message: 'Project not found.' });
      }

      if (project.createdById !== userId && userRole !== 'ADMIN') {
        return res.status(403).json({
          message: 'Only the project creator or an administrator can invite a faculty supervisor.',
        });
      }

      // Check if this specific faculty is already assigned
      const alreadyAssigned =
        project.assignedFacultyId === recipientId ||
        (await prisma.projectFaculty.findUnique({
          where: {
            projectId_facultyId: {
              projectId,
              facultyId: recipientId,
            },
          },
        }));

      if (alreadyAssigned) {
        return res.status(400).json({
          message: 'This faculty member is already an assigned supervisor for this project.',
        });
      }

      const recipient = await prisma.user.findUnique({
        where: { id: recipientId },
        select: { id: true, name: true, email: true, role: true },
      });

      if (!recipient || recipient.role !== 'FACULTY') {
        return res.status(400).json({ message: 'Invited recipient must be a valid faculty member.' });
      }

      const existingPending = await prisma.projectInvitation.findFirst({
        where: {
          projectId,
          recipientId,
          type: 'FACULTY_GUIDE',
          status: 'PENDING',
        },
      });

      if (existingPending) {
        return res.status(400).json({
          message: 'A pending supervision invitation has already been sent to this faculty member.',
        });
      }

      const inviter = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true },
      });

      const invitation = await prisma.projectInvitation.create({
        data: {
          projectId,
          invitedById: userId,
          recipientId,
          type: 'FACULTY_GUIDE',
          status: 'PENDING',
          message: message ? String(message).trim() : null,
        },
        include: {
          recipient: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      await logActivity({
        projectId,
        userId,
        userName: inviter?.name || 'Project Lead',
        action: 'INVITATION_SENT',
        details: `Invited faculty ${recipient.name} to supervise the project`,
      });

      // Role-specific Notification (Phase 7)
      await createNotification({
        userId: recipientId,
        type: 'FACULTY_SUPERVISION_REQUEST',
        title: 'Project Supervision Request',
        message: `${inviter?.name || 'A student'} requested your academic supervision for "${project.title}".`,
        link: `/faculty`,
      });

      return res.status(201).json({
        message: `Supervision invitation successfully sent to ${recipient.name}.`,
        invitation,
      });
    } catch (error) {
      console.error('Error inviting faculty supervisor:', error);
      return res.status(500).json({ message: 'Failed to invite faculty supervisor.' });
    }
  }
);

// ==========================================
// 6. ACCEPT INVITATION
// PATCH /api/invitations/:id/accept
// ==========================================
router.patch(
  '/:id/accept',
  authenticateUser,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      const invitation = await prisma.projectInvitation.findUnique({
        where: { id },
        include: {
          project: {
            select: {
              id: true,
              title: true,
              assignedFacultyId: true,
            },
          },
        },
      });

      if (!invitation) {
        return res.status(404).json({ message: 'Invitation not found.' });
      }

      if (invitation.recipientId !== userId) {
        return res.status(403).json({ message: 'You are not authorized to respond to this invitation.' });
      }

      if (invitation.status !== 'PENDING') {
        return res.status(400).json({
          message: `This invitation is already ${invitation.status.toLowerCase()}.`,
        });
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, role: true },
      });

      await prisma.$transaction(async (tx) => {
        // 1. Mark invitation as accepted
        await tx.projectInvitation.update({
          where: { id },
          data: { status: 'ACCEPTED' },
        });

        if (invitation.type === 'TEAM_MEMBER') {
          // Add student to project team
          await tx.projectStudent.upsert({
            where: {
              projectId_studentId: {
                projectId: invitation.projectId,
                studentId: userId,
              },
            },
            create: {
              projectId: invitation.projectId,
              studentId: userId,
            },
            update: {},
          });

          // Update member count
          const totalMembers = await tx.projectStudent.count({
            where: { projectId: invitation.projectId },
          });

          await tx.project.update({
            where: { id: invitation.projectId },
            data: { membersCount: totalMembers },
          });
        } else if (invitation.type === 'FACULTY_GUIDE') {
          // Add to ProjectFaculty table
          await tx.projectFaculty.upsert({
            where: {
              projectId_facultyId: {
                projectId: invitation.projectId,
                facultyId: userId,
              },
            },
            create: {
              projectId: invitation.projectId,
              facultyId: userId,
            },
            update: {},
          });

          // Set primary assignedFacultyId if not already set
          const currentProj = await tx.project.findUnique({
            where: { id: invitation.projectId },
            select: { assignedFacultyId: true },
          });

          if (!currentProj?.assignedFacultyId) {
            await tx.project.update({
              where: { id: invitation.projectId },
              data: { assignedFacultyId: userId },
            });
          }
        }
      });

      // Audit Activity
      const actionDetail =
        invitation.type === 'TEAM_MEMBER'
          ? `Student ${user?.name || 'Member'} accepted the invitation and joined the project team`
          : `Faculty ${user?.name || 'Supervisor'} accepted the project supervision invitation`;

      await logActivity({
        projectId: invitation.projectId,
        userId,
        userName: user?.name || 'User',
        action: 'INVITATION_ACCEPTED',
        details: actionDetail,
      });

      // Role-specific Notification (Phase 7)
      await createNotification({
        userId: invitation.invitedById,
        type: 'INVITATION_ACCEPTED',
        title: invitation.type === 'FACULTY_GUIDE' ? 'Faculty Guide Accepted' : 'Team Member Joined',
        message: `${user?.name || 'Recipient'} accepted your invitation to "${invitation.project.title}".`,
        link: `/projects/${invitation.projectId}`,
      });

      return res.json({
        message:
          invitation.type === 'TEAM_MEMBER'
            ? 'You have successfully joined the project team!'
            : 'You have accepted the project supervision request!',
      });
    } catch (error) {
      console.error('Error accepting invitation:', error);
      return res.status(500).json({ message: 'Failed to accept invitation.' });
    }
  }
);

// ==========================================
// 7. DECLINE INVITATION
// PATCH /api/invitations/:id/decline
// ==========================================
router.patch(
  '/:id/decline',
  authenticateUser,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      const invitation = await prisma.projectInvitation.findUnique({
        where: { id },
        include: {
          project: { select: { id: true, title: true } },
        },
      });

      if (!invitation) {
        return res.status(404).json({ message: 'Invitation not found.' });
      }

      if (invitation.recipientId !== userId) {
        return res.status(403).json({ message: 'You are not authorized to respond to this invitation.' });
      }

      if (invitation.status !== 'PENDING') {
        return res.status(400).json({
          message: `This invitation is already ${invitation.status.toLowerCase()}.`,
        });
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true },
      });

      await prisma.projectInvitation.update({
        where: { id },
        data: { status: 'DECLINED' },
      });

      const detail =
        invitation.type === 'TEAM_MEMBER'
          ? `Student ${user?.name || 'User'} declined the team invitation`
          : `Faculty ${user?.name || 'Faculty'} declined the supervision request`;

      await logActivity({
        projectId: invitation.projectId,
        userId,
        userName: user?.name || 'User',
        action: 'INVITATION_DECLINED',
        details: detail,
      });

      // Role-specific Notification (Phase 7)
      await createNotification({
        userId: invitation.invitedById,
        type: 'INVITATION_DECLINED',
        title: invitation.type === 'FACULTY_GUIDE' ? 'Supervision Request Declined' : 'Team Invitation Declined',
        message: `${user?.name || 'Recipient'} declined your invitation for "${invitation.project.title}".`,
        link: `/projects/${invitation.projectId}`,
      });

      return res.json({ message: 'Invitation declined.' });
    } catch (error) {
      console.error('Error declining invitation:', error);
      return res.status(500).json({ message: 'Failed to decline invitation.' });
    }
  }
);

// ==========================================
// 8. CANCEL INVITATION (BY PROJECT OWNER / ADMIN)
// PATCH /api/invitations/:id/cancel
// ==========================================
router.patch(
  '/:id/cancel',
  authenticateUser,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const userRole = req.user!.role;

      const invitation = await prisma.projectInvitation.findUnique({
        where: { id },
      });

      if (!invitation) {
        return res.status(404).json({ message: 'Invitation not found.' });
      }

      if (invitation.invitedById !== userId && userRole !== 'ADMIN') {
        return res.status(403).json({
          message: 'Only the user who sent this invitation or an administrator can cancel it.',
        });
      }

      if (invitation.status !== 'PENDING') {
        return res.status(400).json({
          message: `Cannot cancel an invitation that is already ${invitation.status.toLowerCase()}.`,
        });
      }

      await prisma.projectInvitation.update({
        where: { id },
        data: { status: 'CANCELLED' },
      });

      return res.json({ message: 'Invitation cancelled successfully.' });
    } catch (error) {
      console.error('Error cancelling invitation:', error);
      return res.status(500).json({ message: 'Failed to cancel invitation.' });
    }
  }
);

export default router;

