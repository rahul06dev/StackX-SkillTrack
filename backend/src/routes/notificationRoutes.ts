import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import {
  authenticateUser,
  type AuthenticatedRequest,
} from '../middleware/authMiddleware.js';
import { syncDeadlineReminders } from '../services/notificationService.js';

const prisma = new PrismaClient();
const router = Router();

// ==========================================
// 1. GET ALL NOTIFICATIONS FOR CURRENT USER
// GET /api/notifications
// ==========================================
router.get(
  '/',
  authenticateUser,
  async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;

      // Proactively check for approaching deadlines
      await syncDeadlineReminders(userId);

      const notifications = await prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });

      const unreadCount = await prisma.notification.count({
        where: {
          userId,
          isRead: false,
        },
      });

      return res.json({
        notifications,
        unreadCount,
      });
    } catch (error) {
      console.error('Error fetching notifications:', error);
      return res.status(500).json({ message: 'Failed to fetch notifications.' });
    }
  }
);

// ==========================================
// 2. MARK ALL NOTIFICATIONS AS READ
// PATCH /api/notifications/read-all
// ==========================================
router.patch(
  '/read-all',
  authenticateUser,
  async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;

      const result = await prisma.notification.updateMany({
        where: {
          userId,
          isRead: false,
        },
        data: {
          isRead: true,
        },
      });

      return res.json({
        message: 'All notifications marked as read.',
        count: result.count,
      });
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      return res.status(500).json({ message: 'Failed to mark notifications as read.' });
    }
  }
);

// ==========================================
// 3. MARK SINGLE NOTIFICATION AS READ
// PATCH /api/notifications/:id/read
// ==========================================
router.patch(
  '/:id/read',
  authenticateUser,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      const notification = await prisma.notification.findUnique({
        where: { id },
      });

      if (!notification) {
        return res.status(404).json({ message: 'Notification not found.' });
      }

      if (notification.userId !== userId) {
        return res.status(403).json({
          message: 'You are not authorized to update this notification.',
        });
      }

      const updated = await prisma.notification.update({
        where: { id },
        data: { isRead: true },
      });

      return res.json({
        message: 'Notification marked as read.',
        notification: updated,
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
      return res.status(500).json({ message: 'Failed to update notification.' });
    }
  }
);

// ==========================================
// 4. DISMISS / DELETE NOTIFICATION
// DELETE /api/notifications/:id
// ==========================================
router.delete(
  '/:id',
  authenticateUser,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      const notification = await prisma.notification.findUnique({
        where: { id },
      });

      if (!notification) {
        return res.status(404).json({ message: 'Notification not found.' });
      }

      if (notification.userId !== userId) {
        return res.status(403).json({
          message: 'You are not authorized to dismiss this notification.',
        });
      }

      await prisma.notification.delete({
        where: { id },
      });

      return res.json({
        message: 'Notification dismissed successfully.',
      });
    } catch (error) {
      console.error('Error dismissing notification:', error);
      return res.status(500).json({ message: 'Failed to dismiss notification.' });
    }
  }
);

export default router;

