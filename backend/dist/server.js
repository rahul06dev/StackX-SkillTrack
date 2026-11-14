import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import projectRoutes from './routes/projectRoutes.js';
import columnRoutes from './routes/columnRoutes.js';
import taskRoutes from './routes/taskRoutes.js';
import commentRoutes from './routes/commentRoutes.js';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import skillRoutes from './routes/skillRoutes.js';
import projectSkillRoutes from './routes/projectSkillRoutes.js';
import studentSkillsRoutes from './routes/studentSkillsRoutes.js';
import jobRoleRoutes from './routes/jobRoleRoutes.js';
import talentSearchRoutes from './routes/talentSearchRoutes.js';
import attachmentRoutes from './routes/attachmentRoutes.js';
import activityRoutes from './routes/activityRoutes.js';
import invitationRoutes from './routes/invitationRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import { securityHeadersMiddleware } from './middleware/securityHeaders.js';
import { generalApiRateLimiter } from './middleware/rateLimiter.js';
dotenv.config();
const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 4300;
// --- Security Configurations (OWASP Top 10) ---
// Disable Express fingerprinting header (OWASP A05)
app.disable('x-powered-by');
// Security Headers (CSP, HSTS, X-Content-Type-Options, X-Frame-Options)
app.use(securityHeadersMiddleware);
// Body Parsers with strict size limits to prevent Denial of Service (OWASP A04)
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
// --- Dynamic CORS Configuration ---
// Configured from CLIENT_ORIGIN environment variable, defaulting to frontend port 5173.
const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
app.use(cors({
    origin: (origin, callback) => {
        // In development or when origin matches whitelist, allow request
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        }
        else {
            console.warn(`[SECURITY] Blocked CORS request from unauthorized origin: ${origin}`);
            callback(new Error(`Not allowed by CORS: Origin ${origin} is not authorized.`));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));
// Apply general rate limiting across API endpoints
app.use('/api', generalApiRateLimiter);
// --- Root Health Check Route ---
app.get('/', (_req, res) => {
    res.json({
        status: 'online',
        system: 'StackX SkillTrack API',
        security: 'OWASP Compliant',
        timestamp: new Date().toISOString(),
    });
});
// --- API Route Mounting ---
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/columns', columnRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/users', userRoutes);
app.use('/api/skills', skillRoutes);
app.use('/api/project-skills', projectSkillRoutes);
app.use('/api/student-skills', studentSkillsRoutes);
app.use('/api/job-roles', jobRoleRoutes);
app.use('/api/talent-search', talentSearchRoutes);
app.use('/api/attachments', attachmentRoutes);
app.use('/api/activities', activityRoutes);
app.use('/api/invitations', invitationRoutes);
app.use('/api/notifications', notificationRoutes);
// --- Global 404 Handler ---
app.use((_req, res) => {
    res.status(404).json({ message: 'Requested API endpoint not found.' });
});
// --- Global Centralized Error Handler (OWASP A05: Security Misconfiguration) ---
// Prevents internal stack trace, query structure, or server path leaks to clients.
app.use((err, _req, res, _next) => {
    console.error('[UNCAUGHT ERROR]', err);
    const statusCode = typeof err.statusCode === 'number' && err.statusCode >= 400 && err.statusCode < 600
        ? err.statusCode
        : err.status || 500;
    const safeMessage = statusCode === 500
        ? 'An unexpected internal server error occurred. Please try again later.'
        : err.message || 'An error occurred processing your request.';
    res.status(statusCode).json({
        status: 'error',
        message: safeMessage,
    });
});
// --- Server Startup with Verified Database Connection & Auto-Migration ---
async function startServer() {
    try {
        // Actually verify PostgreSQL connection on startup
        await prisma.$connect();
        console.log('✅ PostgreSQL Database connection verified successfully!');
        // Ensure ProjectFaculty table and constraints exist in database (self-healing migration)
        try {
            await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "ProjectFaculty" (
          "id" TEXT NOT NULL,
          "projectId" TEXT NOT NULL,
          "facultyId" TEXT NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "ProjectFaculty_pkey" PRIMARY KEY ("id")
        );
        CREATE UNIQUE INDEX IF NOT EXISTS "ProjectFaculty_projectId_facultyId_key" ON "ProjectFaculty"("projectId", "facultyId");
        CREATE INDEX IF NOT EXISTS "ProjectFaculty_projectId_idx" ON "ProjectFaculty"("projectId");
        CREATE INDEX IF NOT EXISTS "ProjectFaculty_facultyId_idx" ON "ProjectFaculty"("facultyId");
        DO $$ BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'ProjectFaculty_projectId_fkey'
          ) THEN
            ALTER TABLE "ProjectFaculty" ADD CONSTRAINT "ProjectFaculty_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
          END IF;
        END $$;
        DO $$ BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'ProjectFaculty_facultyId_fkey'
          ) THEN
            ALTER TABLE "ProjectFaculty" ADD CONSTRAINT "ProjectFaculty_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
          END IF;
        END $$;
      `);
            // Backfill any existing projects with assignedFacultyId into ProjectFaculty
            const existingFacultyProjects = await prisma.project.findMany({
                where: {
                    assignedFacultyId: { not: null },
                },
                select: {
                    id: true,
                    assignedFacultyId: true,
                },
            });
            for (const proj of existingFacultyProjects) {
                if (proj.assignedFacultyId) {
                    await prisma.projectFaculty.upsert({
                        where: {
                            projectId_facultyId: {
                                projectId: proj.id,
                                facultyId: proj.assignedFacultyId,
                            },
                        },
                        update: {},
                        create: {
                            projectId: proj.id,
                            facultyId: proj.assignedFacultyId,
                        },
                    });
                }
            }
            console.log('✅ ProjectFaculty schema and associations verified successfully!');
        }
        catch (dbInitErr) {
            console.warn('⚠️ Notice during ProjectFaculty schema verification:', dbInitErr);
        }
        app.listen(PORT, () => {
            console.log(`🚀 StackX SkillTrack API running on http://localhost:${PORT}`);
            console.log(`🔒 Allowed CORS origins: ${allowedOrigins.join(', ')}`);
        });
    }
    catch (err) {
        console.error('❌ Fatal: PostgreSQL database connection failed on startup:', err);
        process.exit(1);
    }
}
startServer();
export { app, prisma };
//# sourceMappingURL=server.js.map