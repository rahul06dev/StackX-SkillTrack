import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
const router = Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is not defined in .env');
}
;
// =============================
// REGISTER
// =============================
router.post('/register', async (req, res) => {
    try {
        const { name, email, password, role, } = req.body;
        if (!name || !email || !password) {
            return res.status(400).json({
                message: 'Name, email and password are required.',
            });
        }
        const existingUser = await prisma.user.findUnique({
            where: { email },
        });
        if (existingUser) {
            return res.status(409).json({
                message: 'User with this email already exists.',
            });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
                role: role || 'STUDENT',
            },
        });
        const token = jwt.sign({
            userId: user.id,
            role: user.role,
        }, JWT_SECRET, {
            expiresIn: '7d',
        });
        res.status(201).json({
            message: 'User registered successfully.',
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
            },
        });
    }
    catch (error) {
        console.error('❌ Registration error:', error);
        res.status(500).json({
            message: 'Registration failed.',
        });
    }
});
// =============================
// LOGIN
// =============================
router.post('/login', async (req, res) => {
    try {
        const { email, password, } = req.body;
        if (!email || !password) {
            return res.status(400).json({
                message: 'Email and password are required.',
            });
        }
        const user = await prisma.user.findUnique({
            where: { email },
        });
        if (!user) {
            return res.status(401).json({
                message: 'Invalid email or password.',
            });
        }
        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
            return res.status(401).json({
                message: 'Invalid email or password.',
            });
        }
        const token = jwt.sign({
            userId: user.id,
            role: user.role,
        }, JWT_SECRET, {
            expiresIn: '7d',
        });
        res.json({
            message: 'Login successful.',
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
            },
        });
    }
    catch (error) {
        console.error('❌ Login error:', error);
        res.status(500).json({
            message: 'Login failed.',
        });
    }
});
export default router;
//# sourceMappingURL=authRoutes.js.map