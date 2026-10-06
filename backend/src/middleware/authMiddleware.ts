import type {
  Request,
  Response,
  NextFunction,
} from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: 'STUDENT' | 'FACULTY' | 'ADMIN';
  };
}

interface JwtPayload {
  userId: string;
  role: 'STUDENT' | 'FACULTY' | 'ADMIN';
}

const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is not defined in .env');
}

// ==========================================
// AUTHENTICATE USER
// ==========================================

export const authenticateUser = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (
      !authHeader ||
      !authHeader.startsWith('Bearer ')
    ) {
      return res.status(401).json({
        message: 'Authentication required.',
      });
    }

    const token = authHeader.split(' ')[1];

    const decoded = jwt.verify(
      token,
      JWT_SECRET
    ) as JwtPayload;

    req.user = {
      id: decoded.userId,
      role: decoded.role,
    };

    next();
  } catch (error) {
    return res.status(401).json({
      message: 'Invalid or expired authentication token.',
    });
  }
};

// ==========================================
// ROLE AUTHORIZATION
// ==========================================

export const authorizeRoles = (
  ...allowedRoles: Array<
    'STUDENT' | 'FACULTY' | 'ADMIN'
  >
) => {
  return (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    if (!req.user) {
      return res.status(401).json({
        message: 'Authentication required.',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        message:
          'Access denied. You do not have permission to perform this action.',
      });
    }

    next();
  };
};

// ==========================================
// PROJECT ACCESS AUTHORIZATION
// ==========================================
//
// Use this middleware when req.params.id is a
// PROJECT ID.
//
// Access rules:
//
// ADMIN
// → Can access every project.
//
// STUDENT
// → Must be explicitly assigned to the project.
//
// FACULTY
// → Must be assigned to the project OR be its creator.
//

export const authorizeProjectAccess = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: 'Authentication required.',
      });
    }

    const projectId = req.params.id;

    if (!projectId) {
      return res.status(400).json({
        message: 'Project ID is required.',
      });
    }

    // Admins have access to every project.
    if (req.user.role === 'ADMIN') {
      return next();
    }

    const project = await prisma.project.findUnique({
      where: {
        id: projectId,
      },
      select: {
        id: true,
        createdById: true,
        assignedFacultyId: true,

        students: {
          where: {
            studentId: req.user.id,
          },
          select: {
            id: true,
          },
        },
      },
    });

    if (!project) {
      return res.status(404).json({
        message: 'Project not found.',
      });
    }

    const isStudent =
      req.user.role === 'STUDENT';

    const isAssignedStudent =
      project.students.length > 0;

    const isAssignedFaculty =
      req.user.role === 'FACULTY' &&
      project.assignedFacultyId === req.user.id;

    const isCreator =
      project.createdById === req.user.id;

    if (
      (isStudent && isAssignedStudent) ||
      isAssignedFaculty ||
      isCreator
    ) {
      return next();
    }

    return res.status(403).json({
      message:
        'You do not have access to this project.',
    });
  } catch (error) {
    console.error(
      '❌ Error checking project access:',
      error
    );

    return res.status(500).json({
      message: 'Failed to verify project access.',
    });
  }
};