import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import {
  authenticateUser,
  type AuthenticatedRequest,
} from '../middleware/authMiddleware.js';
import { logActivity } from '../services/activityService.js';

const prisma = new PrismaClient();
const router = Router();

// Ensure uploads directory exists
const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads', 'attachments');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    // Generate safe, collision-resistant filename
    const safeExt = path.extname(file.originalname).toLowerCase().slice(0, 10);
    const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    cb(null, `${uniqueSuffix}${safeExt}`);
  },
});

// File validation (size limit: 15MB, restricted MIME types, disallowed executable extensions)
const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB

const DISALLOWED_EXTENSIONS = new Set([
  '.exe', '.sh', '.bat', '.cmd', '.com', '.vbs', '.js', '.mjs', '.cjs',
  '.php', '.phtml', '.py', '.rb', '.pl', '.cgi', '.jar', '.war', '.apk'
]);

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip',
  'application/x-zip-compressed',
  'text/plain',
  'text/markdown',
  'text/csv',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
]);

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().slice(0, 10);
    if (DISALLOWED_EXTENSIONS.has(ext)) {
      return cb(new Error(`Executable or script file extension '${ext}' is strictly prohibited.`));
    }

    if (ALLOWED_MIME_TYPES.has(file.mimetype.toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error(`File type '${file.mimetype}' is not permitted.`));
    }
  },
});

// Helper: Check Project Access for a Task
async function verifyTaskProjectAccess(taskId: string, req: AuthenticatedRequest) {
  if (!req.user) return { access: false, task: null, projectId: null };

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      column: {
        select: { projectId: true },
      },
    },
  });

  if (!task) return { access: false, task: null, projectId: null };

  const projectId = task.column.projectId;

  if (req.user.role === 'ADMIN') {
    return { access: true, task, projectId };
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      createdById: true,
      assignedFacultyId: true,
      students: {
        where: { studentId: req.user.id },
        select: { id: true },
      },
    },
  });

  if (!project) return { access: false, task: null, projectId: null };

  if (req.user.role === 'STUDENT' && project.students.length > 0) {
    return { access: true, task, projectId };
  }

  if (
    req.user.role === 'FACULTY' &&
    (project.assignedFacultyId === req.user.id || project.createdById === req.user.id)
  ) {
    return { access: true, task, projectId };
  }

  return { access: false, task, projectId };
}

// ==========================================
// 1. GET ATTACHMENTS FOR A TASK
// GET /api/attachments/task/:taskId
// ==========================================
router.get(
  '/task/:taskId',
  authenticateUser,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { taskId } = req.params;
      const { access, task } = await verifyTaskProjectAccess(taskId, req);

      if (!task) {
        return res.status(404).json({ message: 'Task not found.' });
      }
      if (!access) {
        return res.status(403).json({ message: 'Access denied to this project.' });
      }

      const attachments = await prisma.attachment.findMany({
        where: { taskId },
        orderBy: { createdAt: 'desc' },
      });

      return res.json(
        attachments.map((att) => ({
          id: att.id,
          fileName: att.fileName,
          fileSize: att.fileSize,
          mimeType: att.mimeType,
          uploadedBy: att.uploaderName || 'Unknown',
          createdAt: att.createdAt,
        }))
      );
    } catch (error) {
      console.error('Error fetching attachments:', error);
      return res.status(500).json({ message: 'Failed to fetch attachments.' });
    }
  }
);

// ==========================================
// 2. UPLOAD ATTACHMENT TO A TASK
// POST /api/attachments/task/:taskId
// ==========================================
router.post(
  '/task/:taskId',
  authenticateUser,
  (req, res, next) => {
    upload.single('file')(req, res, (err: any) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            message: `File is too large. Maximum allowed size is ${MAX_FILE_SIZE / (1024 * 1024)}MB.`,
          });
        }
        return res.status(400).json({ message: err.message });
      } else if (err) {
        return res.status(400).json({ message: err.message });
      }
      next();
    });
  },
  async (req: AuthenticatedRequest, res) => {
    try {
      const { taskId } = req.params;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ message: 'No file provided for upload.' });
      }

      const { access, task, projectId } = await verifyTaskProjectAccess(taskId, req);

      if (!task) {
        // Remove uploaded file if task not found
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        return res.status(404).json({ message: 'Task not found.' });
      }
      if (!access) {
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        return res.status(403).json({ message: 'Access denied to this project.' });
      }

      // Fetch user name
      const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
        select: { name: true },
      });

      const uploaderName = user?.name || 'User';

      const attachment = await prisma.attachment.create({
        data: {
          taskId,
          fileName: file.originalname,
          fileSize: file.size,
          mimeType: file.mimetype,
          filePath: file.filename, // Store relative filename only
          uploadedBy: req.user!.id,
          uploaderName,
        },
      });

      // Audit Activity
      if (projectId) {
        await logActivity({
          projectId,
          taskId,
          userId: req.user!.id,
          userName: uploaderName,
          action: 'ATTACHMENT_UPLOADED',
          details: `Uploaded attachment "${file.originalname}" (${(file.size / 1024).toFixed(1)} KB)`,
        });
      }

      return res.status(201).json({
        id: attachment.id,
        fileName: attachment.fileName,
        fileSize: attachment.fileSize,
        mimeType: attachment.mimeType,
        uploadedBy: uploaderName,
        createdAt: attachment.createdAt,
      });
    } catch (error) {
      console.error('Error uploading attachment:', error);
      return res.status(500).json({ message: 'Failed to upload attachment.' });
    }
  }
);

// ==========================================
// 3. DOWNLOAD ATTACHMENT
// GET /api/attachments/:id/download
// ==========================================
router.get(
  '/:id/download',
  authenticateUser,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;

      const attachment = await prisma.attachment.findUnique({
        where: { id },
        include: {
          task: {
            include: {
              column: { select: { projectId: true } },
            },
          },
        },
      });

      if (!attachment) {
        return res.status(404).json({ message: 'Attachment not found.' });
      }

      const { access } = await verifyTaskProjectAccess(attachment.taskId, req);
      if (!access) {
        return res.status(403).json({ message: 'Access denied to this attachment.' });
      }

      // Canonicalize and enforce strict directory containment (OWASP A01: Path Traversal Prevention)
      const resolvedPath = path.resolve(UPLOADS_DIR, attachment.filePath);
      const resolvedUploadsDir = path.resolve(UPLOADS_DIR);

      if (!resolvedPath.startsWith(resolvedUploadsDir + path.sep) && resolvedPath !== resolvedUploadsDir) {
        console.warn(`[SECURITY] Blocked path traversal attempt on attachment download: ${attachment.filePath}`);
        return res.status(403).json({ message: 'Illegal path traversal attempt detected.' });
      }

      if (!fs.existsSync(resolvedPath)) {
        return res.status(404).json({ message: 'Stored file was not found on server.' });
      }

      // Sanitize filename to prevent HTTP Response Splitting / Header Injection (OWASP A03)
      const sanitizedFileName = attachment.fileName.replace(/[\r\n"]/g, '_').trim();

      res.setHeader('X-Content-Type-Options', 'nosniff');
      return res.download(resolvedPath, sanitizedFileName);
    } catch (error) {
      console.error('Error downloading attachment:', error);
      return res.status(500).json({ message: 'Failed to download attachment.' });
    }
  }
);

// ==========================================
// 4. DELETE ATTACHMENT
// DELETE /api/attachments/:id
// ==========================================
router.delete(
  '/:id',
  authenticateUser,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;

      const attachment = await prisma.attachment.findUnique({
        where: { id },
        include: {
          task: {
            include: {
              column: { select: { projectId: true } },
            },
          },
        },
      });

      if (!attachment) {
        return res.status(404).json({ message: 'Attachment not found.' });
      }

      const { access, projectId } = await verifyTaskProjectAccess(attachment.taskId, req);
      if (!access) {
        return res.status(403).json({ message: 'Access denied to delete this attachment.' });
      }

      // Check if user is uploader or admin/faculty
      const isUploader = attachment.uploadedBy === req.user!.id;
      const isPrivileged = req.user!.role === 'ADMIN' || req.user!.role === 'FACULTY';

      if (!isUploader && !isPrivileged) {
        return res.status(403).json({
          message: 'Only the original uploader, project faculty, or an admin can delete this attachment.',
        });
      }

      // Canonicalize and enforce strict path containment before removal
      const resolvedPath = path.resolve(UPLOADS_DIR, attachment.filePath);
      const resolvedUploadsDir = path.resolve(UPLOADS_DIR);

      if (!resolvedPath.startsWith(resolvedUploadsDir + path.sep) && resolvedPath !== resolvedUploadsDir) {
        console.warn(`[SECURITY] Blocked path traversal attempt on attachment deletion: ${attachment.filePath}`);
        return res.status(403).json({ message: 'Illegal path traversal attempt detected.' });
      }

      // Remove from filesystem
      if (fs.existsSync(resolvedPath)) {
        try {
          fs.unlinkSync(resolvedPath);
        } catch (unlinkErr) {
          console.warn('Could not remove file from disk:', unlinkErr);
        }
      }

      // Delete from DB
      await prisma.attachment.delete({ where: { id } });

      // Audit Activity
      if (projectId) {
        const user = await prisma.user.findUnique({
          where: { id: req.user!.id },
          select: { name: true },
        });

        await logActivity({
          projectId,
          taskId: attachment.taskId,
          userId: req.user!.id,
          userName: user?.name || 'User',
          action: 'ATTACHMENT_DELETED',
          details: `Deleted attachment "${attachment.fileName}"`,
        });
      }

      return res.json({ message: 'Attachment deleted successfully.' });
    } catch (error) {
      console.error('Error deleting attachment:', error);
      return res.status(500).json({ message: 'Failed to delete attachment.' });
    }
  }
);

export default router;
