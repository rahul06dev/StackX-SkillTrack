import { Router } from 'express';
import { PrismaClient, Role } from '@prisma/client';
import {
  authenticateUser,
  authorizeRoles,
} from '../middleware/authMiddleware.js';
import { sanitizeString } from '../utils/security.js';

import type { AuthenticatedRequest } from '../middleware/authMiddleware.js';

const prisma = new PrismaClient();
const router = Router();

// ==========================================
// GET ALL USERS (Admin Only)
// GET /api/users
// ==========================================
router.get(
  '/',
  authenticateUser,
  authorizeRoles('ADMIN'),
  async (_req: AuthenticatedRequest, res) => {
    try {
      const users = await prisma.user.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          department: true,
          headline: true,
          createdAt: true,
        },
        orderBy: [{ role: 'asc' }, { name: 'asc' }],
      });

      return res.json(users);
    } catch (error) {
      console.error('❌ Error fetching all users:', error);
      return res.status(500).json({ message: 'Failed to fetch users.' });
    }
  }
);

// ==========================================
// GET STUDENTS
// GET /api/users/students
// ==========================================
router.get(
  '/students',
  authenticateUser,
  authorizeRoles('FACULTY', 'ADMIN', 'STUDENT'),
  async (_req, res) => {
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

      return res.json(students);
    } catch (error) {
      console.error('❌ Error fetching students:', error);
      return res.status(500).json({
        message: 'Failed to fetch students',
      });
    }
  }
);

// ==========================================
// GET FACULTY
// GET /api/users/faculty
// ==========================================
router.get(
  '/faculty',
  authenticateUser,
  async (_req, res) => {
    try {
      const faculty = await prisma.user.findMany({
        where: {
          role: 'FACULTY',
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

      return res.json(faculty);
    } catch (error) {
      console.error('❌ Error fetching faculty:', error);
      return res.status(500).json({
        message: 'Failed to fetch faculty',
      });
    }
  }
);

// ==========================================
// GET CURRENT USER PROFILE
// GET /api/users/profile
// ==========================================
router.get(
  '/profile',
  authenticateUser,
  async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: 'Authentication required.' });
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
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

      if (!user) {
        return res.status(404).json({ message: 'User not found.' });
      }

      return res.json(user);
    } catch (error) {
      console.error('❌ Error fetching user profile:', error);
      return res.status(500).json({ message: 'Failed to fetch user profile.' });
    }
  }
);

// ==========================================
// UPDATE CURRENT USER PROFILE
// PATCH /api/users/profile
// Allows students/users to maintain their digital passport bio and headline.
// ==========================================
router.patch(
  '/profile',
  authenticateUser,
  async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: 'Authentication required.' });
      }

      const {
        name,
        headline,
        bio,
        department,
        studentIdNo,
        graduationYear,
        githubUrl,
        linkedinUrl,
        shareableSlug,
      } = req.body;

      // Validate/sanitize optional slug
      let cleanSlug: string | null | undefined = undefined;
      if (typeof shareableSlug === 'string') {
        const trimmed = shareableSlug.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
        if (trimmed.length > 0) {
          // Check uniqueness if slug changed
          const existing = await prisma.user.findFirst({
            where: {
              shareableSlug: trimmed,
              NOT: { id: userId },
            },
          });
          if (existing) {
            return res.status(400).json({ message: 'This public portfolio URL slug is already taken.' });
          }
          cleanSlug = trimmed;
        } else {
          cleanSlug = null;
        }
      }

      // Safe URL sanitization & validation (OWASP A03: Injection prevention)
      let cleanGithub: string | null | undefined = undefined;
      if (githubUrl !== undefined) {
        if (typeof githubUrl === 'string' && githubUrl.trim().length > 0) {
          const raw = sanitizeString(githubUrl.trim());
          if (/^https:\/\/(www\.)?github\.com\/[a-zA-Z0-9_\-./]+$/i.test(raw)) {
            cleanGithub = raw;
          } else if (/^https?:\/\//i.test(raw)) {
            cleanGithub = raw;
          } else {
            cleanGithub = `https://github.com/${raw.replace(/^@/, '').replace(/[^a-zA-Z0-9_-]/g, '')}`;
          }
        } else {
          cleanGithub = null;
        }
      }

      let cleanLinkedin: string | null | undefined = undefined;
      if (linkedinUrl !== undefined) {
        if (typeof linkedinUrl === 'string' && linkedinUrl.trim().length > 0) {
          const raw = sanitizeString(linkedinUrl.trim());
          if (/^https:\/\/(www\.)?linkedin\.com\/in\/[a-zA-Z0-9_\-./]+$/i.test(raw)) {
            cleanLinkedin = raw;
          } else if (/^https?:\/\//i.test(raw)) {
            cleanLinkedin = raw;
          } else {
            cleanLinkedin = `https://linkedin.com/in/${raw.replace(/^@/, '').replace(/[^a-zA-Z0-9_-]/g, '')}`;
          }
        } else {
          cleanLinkedin = null;
        }
      }

      const updated = await prisma.user.update({
        where: { id: userId },
        data: {
          ...(typeof name === 'string' && name.trim().length >= 2 ? { name: sanitizeString(name.trim()) } : {}),
          headline: headline !== undefined ? (typeof headline === 'string' ? sanitizeString(headline) : null) : undefined,
          bio: bio !== undefined ? (typeof bio === 'string' ? sanitizeString(bio) : null) : undefined,
          department: department !== undefined ? (typeof department === 'string' ? sanitizeString(department) : null) : undefined,
          studentIdNo: studentIdNo !== undefined ? (typeof studentIdNo === 'string' ? sanitizeString(studentIdNo) : null) : undefined,
          graduationYear: graduationYear !== undefined ? (typeof graduationYear === 'string' ? sanitizeString(graduationYear) : null) : undefined,
          ...(cleanGithub !== undefined ? { githubUrl: cleanGithub } : {}),
          ...(cleanLinkedin !== undefined ? { linkedinUrl: cleanLinkedin } : {}),
          ...(cleanSlug !== undefined ? { shareableSlug: cleanSlug } : {}),
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

      return res.json({
        message: 'Profile updated successfully.',
        user: updated,
      });
    } catch (error) {
      console.error('❌ Error updating user profile:', error);
      return res.status(500).json({ message: 'Failed to update user profile.' });
    }
  }
);

// ==========================================
// UPDATE USER ROLE (Admin Only - Principle of Least Privilege)
// PATCH /api/users/:id/role
// Allows verified administrators to assign and promote roles.
// ==========================================
router.patch(
  '/:id/role',
  authenticateUser,
  authorizeRoles('ADMIN'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const { role } = req.body;

      // Validate target role
      const validRoles: Role[] = ['STUDENT', 'FACULTY', 'ADMIN'];
      if (!role || !validRoles.includes(role)) {
        return res.status(400).json({
          message: `Invalid role. Allowed roles are: ${validRoles.join(', ')}`,
        });
      }

      const existingUser = await prisma.user.findUnique({
        where: { id },
        select: { id: true, name: true, email: true, role: true },
      });

      if (!existingUser) {
        return res.status(404).json({ message: 'User not found.' });
      }

      // Prevent admin from demoting themselves if they are the current logged-in admin
      if (req.user?.id === id && role !== 'ADMIN') {
        const adminCount = await prisma.user.count({
          where: { role: 'ADMIN' },
        });

        if (adminCount <= 1) {
          return res.status(400).json({
            message: 'Cannot demote the only remaining administrator account.',
          });
        }
      }

      const updatedUser = await prisma.user.update({
        where: { id },
        data: { role },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      });

      console.log(`[AUDIT] User ${existingUser.email} role updated: ${existingUser.role} -> ${role} by Admin ${req.user?.id}`);

      return res.json({
        message: `Role for ${updatedUser.name} updated to ${updatedUser.role}.`,
        user: updatedUser,
      });
    } catch (error) {
      console.error('❌ Error updating user role:', error);
      return res.status(500).json({ message: 'Failed to update user role.' });
    }
  }
);

// ==========================================
// SAFE CASCADE USER DELETION HELPER
// ==========================================
async function deleteUserSafely(userId: string) {
  return await prisma.$transaction(async (tx) => {
    // 1. Unlink created projects: set createdById = null
    await tx.project.updateMany({
      where: { createdById: userId },
      data: { createdById: null },
    });

    // 2. Unlink faculty assigned projects: set assignedFacultyId = null
    await tx.project.updateMany({
      where: { assignedFacultyId: userId },
      data: { assignedFacultyId: null },
    });

    // 3. Delete ProjectStudent memberships
    await tx.projectStudent.deleteMany({
      where: { studentId: userId },
    });

    // 4. Delete ProjectAdmin records
    await tx.projectAdmin.deleteMany({
      where: { adminId: userId },
    });

    // 5. Delete ProjectInvitations (sent or received)
    await tx.projectInvitation.deleteMany({
      where: {
        OR: [{ invitedById: userId }, { recipientId: userId }],
      },
    });

    // 6. Delete Notifications
    await tx.notification.deleteMany({
      where: { userId },
    });

    // 7. Delete StudentSkills and evidence
    const studentSkills = await tx.studentSkill.findMany({
      where: { studentId: userId },
      select: { id: true },
    });
    const skillIds = studentSkills.map((s) => s.id);
    if (skillIds.length > 0) {
      await tx.studentSkillEvidence.deleteMany({
        where: { studentSkillId: { in: skillIds } },
      });
      await tx.studentSkill.deleteMany({
        where: { id: { in: skillIds } },
      });
    }

    // 8. Unlink verifiedBy references on other students' skills
    await tx.studentSkill.updateMany({
      where: { verifiedById: userId },
      data: { verifiedById: null },
    });

    // 9. Delete User
    await tx.user.delete({
      where: { id: userId },
    });
  });
}

// ==========================================
// DELETE CURRENT USER ACCOUNT (Self-Deletion)
// DELETE /api/users/profile
// ==========================================
router.delete(
  '/profile',
  authenticateUser,
  async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: 'Authentication required.' });
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true, role: true },
      });

      if (!user) {
        return res.status(404).json({ message: 'User not found.' });
      }

      // Safeguard: Protect against deleting the only remaining admin
      if (user.role === 'ADMIN') {
        const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } });
        if (adminCount <= 1) {
          return res.status(400).json({
            message: 'Cannot delete the only remaining administrator account.',
          });
        }
      }

      await deleteUserSafely(userId);
      console.log(`[AUDIT] User ${user.email} (${user.id}) deleted their own account.`);

      return res.json({ message: 'Your account has been permanently deleted.' });
    } catch (error) {
      console.error('❌ Error deleting own user account:', error);
      return res.status(500).json({ message: 'Failed to delete account.' });
    }
  }
);

// ==========================================
// DELETE USER (Admin Only)
// DELETE /api/users/:id
// ==========================================
router.delete(
  '/:id',
  authenticateUser,
  authorizeRoles('ADMIN'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;

      const existingUser = await prisma.user.findUnique({
        where: { id },
        select: { id: true, name: true, email: true, role: true },
      });

      if (!existingUser) {
        return res.status(404).json({ message: 'User not found.' });
      }

      // Safeguard: Protect against deleting the only remaining admin
      if (existingUser.role === 'ADMIN') {
        const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } });
        if (adminCount <= 1) {
          return res.status(400).json({
            message: 'Cannot delete the only remaining administrator account.',
          });
        }
      }

      await deleteUserSafely(id);
      console.log(`[AUDIT] User ${existingUser.email} permanently deleted by Admin ${req.user?.id}`);

      return res.json({
        message: `User ${existingUser.name} (${existingUser.email}) has been permanently deleted.`,
      });
    } catch (error) {
      console.error('❌ Error deleting user:', error);
      return res.status(500).json({ message: 'Failed to delete user.' });
    }
  }
);

export default router;
