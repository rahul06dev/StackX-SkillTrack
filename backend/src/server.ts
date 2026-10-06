import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

// 💡 Import the new routers
import projectRoutes from './routes/projectRoutes.js'
import columnRoutes from './routes/columnRoutes.js'; // New Import
import taskRoutes from './routes/taskRoutes.js'
import commentRoutes from './routes/commentRoutes.js'
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import skillRoutes from './routes/skillRoutes.js';
import projectSkillRoutes from './routes/projectSkillRoutes.js';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 4300;

// --- Middlewares ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const allowedOrigins = ['http://localhost:5173', undefined]; 
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`Not allowed by CORS: ${origin}`));
    }
  },
  credentials: true,
}));

// --- Root and Debug Routes ---
app.get('/', (req, res) => {
  res.send('✅ API is running fine');
});

// --- Router Mounting (The Clean Part) ---

// All routes inside projectRoutes will be prefixed with /api/projects
app.use('/api/projects', projectRoutes);

app.use('/api/auth', authRoutes);

// All routes inside columnRoutes will be prefixed with /api/columns
app.use('/api/columns', columnRoutes); 

app.use('/api/tasks', taskRoutes);
app.use('/api/comments', commentRoutes);

app.use('/api/users', userRoutes);

app.use('/api/skills', skillRoutes);

app.use('/api/project-skills', projectSkillRoutes);


// --- Server Startup ---
try {
  // await prisma.$connect(); 
  console.log('✅ Database connection successful!');

  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
} catch (err) {
  console.error('❌ Database connection failed:', err);
  process.exit(1);
}