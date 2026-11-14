import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface LogActivityParams {
  projectId: string;
  taskId?: string | null;
  userId?: string | null;
  userName: string;
  action: string;
  details?: string | null;
}

/**
 * Persists an audit / activity log entry for a project or task event.
 */
export async function logActivity(params: LogActivityParams) {
  try {
    return await prisma.activity.create({
      data: {
        projectId: params.projectId,
        taskId: params.taskId || null,
        userId: params.userId || null,
        userName: params.userName,
        action: params.action,
        details: params.details || null,
      },
    });
  } catch (err) {
    console.error('Failed to log activity:', err);
    return null;
  }
}

