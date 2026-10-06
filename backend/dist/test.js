import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
dotenv.config();
const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 5001;
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// ✅ Root test route - BEFORE CORS
app.get('/', (req, res) => {
    res.send('✅ API is running fine');
});
const allowedOrigins = ['http://localhost:5173', undefined]; // undefined covers Postman/cURL
app.use(cors({
    origin: (origin, callback) => {
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        }
        else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
}));
// ✅ Debug route 2: basic POST test
app.post('/api/test', (req, res) => {
    console.log('POST /api/test called with body:', req.body);
    res.json({ message: 'POST /api/test successful!', received: req.body });
});
// ✅ Inline /api/projects routes
app.get('/api/projects', async (req, res) => {
    try {
        const projects = await prisma.project.findMany({
            select: {
                id: true,
                title: true,
                description: true,
                tasksCount: true,
                membersCount: true,
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
        const formattedProjects = projects.map(p => ({
            id: p.id,
            title: p.title,
            description: p.description,
            tasks: p.tasksCount,
            members: p.membersCount,
        }));
        res.json(formattedProjects);
    }
    catch (error) {
        console.error('❌ Error fetching projects:', error);
        res.status(500).json({ message: 'Failed to fetch projects', error });
    }
});
app.post('/api/projects', async (req, res) => {
    console.log('POST /api/projects called with body:', req.body);
    const { title, description } = req.body;
    if (!title || !description) {
        return res.status(400).json({ message: 'Title and description are required.' });
    }
    try {
        const newProject = await prisma.project.create({
            data: {
                title,
                description,
                tasksCount: 0,
                membersCount: 1,
            },
        });
        res.status(201).json({
            id: newProject.id,
            title: newProject.title,
            description: newProject.description,
            tasks: newProject.tasksCount,
            members: newProject.membersCount,
        });
    }
    catch (error) {
        console.error('❌ Error creating project:', error);
        res.status(500).json({ message: 'Failed to create project', error });
    }
});
// ✅ Inline /api/columns routes
app.get('/api/columns', async (req, res) => {
    try {
        const columns = await prisma.column.findMany({
            select: {
                id: true,
                title: true,
                projectId: true,
            },
            orderBy: { id: 'asc' },
        });
        res.json(columns);
    }
    catch (error) {
        console.error('❌ Error fetching columns:', error);
        res.status(500).json({ message: 'Failed to fetch columns', error });
    }
});
try {
    // await prisma.$connect(); // optional for debug
    console.log('✅ Database connection successful!');
    app.listen(PORT, () => {
        console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
}
catch (err) {
    console.error('❌ Database connection failed:', err);
    process.exit(1);
}
//# sourceMappingURL=test.js.map