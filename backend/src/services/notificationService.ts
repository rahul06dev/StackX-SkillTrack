import { PrismaClient, NotificationType } from '@prisma/client';

const prisma = new PrismaClient();

export interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string | null;
}

/**
 * Safely create a notification. Errors are captured and logged to prevent interrupting business flows.
 */
export const createNotification = async (params: CreateNotificationParams) => {
  try {
    const notification = await prisma.notification.create({
      data: {
        userId: params.userId,
        type: params.type,
        title: params.title,
        message: params.message,
        link: params.link ?? null,
      },
    });
    return notification;
  } catch (error) {
    console.error('Failed to create notification:', error);
    return null;
  }
};

/**
 * Proactively check and generate deadline reminder notifications for a user's active projects.
 * Avoids duplicate notifications within a 24-hour window per task.
 */
export const syncDeadlineReminders = async (userId: string) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user) return;

    const now = new Date();
    const deadlineThreshold = new Date(now.getTime() + 48 * 60 * 60 * 1000); // within 48 hours
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Find project IDs where the user is enrolled or faculty guide
    let projectIds: string[] = [];

    if (user.role === 'STUDENT') {
      const studentProjects = await prisma.projectStudent.findMany({
        where: { studentId: userId },
        select: { projectId: true },
      });
      const createdProjects = await prisma.project.findMany({
        where: { createdById: userId },
        select: { id: true },
      });
      projectIds = Array.from(
        new Set([
          ...studentProjects.map((p) => p.projectId),
          ...createdProjects.map((p) => p.id),
        ])
      );
    } else if (user.role === 'FACULTY') {
      const facultyProjects = await prisma.project.findMany({
        where: {
          OR: [{ assignedFacultyId: userId }, { createdById: userId }],
        },
        select: { id: true },
      });
      projectIds = facultyProjects.map((p) => p.id);
    } else {
      // ADMIN: no personal project deadlines needed to spam
      return;
    }

    if (projectIds.length === 0) return;

    // Find columns not named 'Done' or 'Completed'
    const pendingTasks = await prisma.task.findMany({
      where: {
        column: {
          projectId: { in: projectIds },
          title: {
            notIn: ['Done', 'Completed', 'done', 'completed'],
          },
        },
        dueDate: {
          not: null,
          lte: deadlineThreshold,
        },
      },
      include: {
        column: {
          include: {
            project: {
              select: { id: true, title: true },
            },
          },
        },
      },
      take: 10,
    });

    for (const task of pendingTasks) {
      if (!task.dueDate) continue;

      // Check if user already received a notification for this task within 24 hours
      const existing = await prisma.notification.findFirst({
        where: {
          userId,
          type: 'DEADLINE_REMINDER',
          link: `/projects/${task.column.project.id}`,
          message: { contains: task.title },
          createdAt: { gte: oneDayAgo },
        },
      });

      if (!existing) {
        const isPastDue = new Date(task.dueDate) < now;
        const dueText = isPastDue
          ? `was due on ${new Date(task.dueDate).toLocaleDateString()}`
          : `is due on ${new Date(task.dueDate).toLocaleDateString()}`;

        await createNotification({
          userId,
          type: 'DEADLINE_REMINDER',
          title: isPastDue ? 'Overdue Task Alert' : 'Upcoming Task Deadline',
          message: `Task "${task.title}" in project "${task.column.project.title}" ${dueText}.`,
          link: `/projects/${task.column.project.id}`,
        });
      }
    }
  } catch (error) {
    console.error('Error synchronizing deadline reminders:', error);
  }
};

