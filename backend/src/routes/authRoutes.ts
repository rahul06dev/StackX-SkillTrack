import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { validatePasswordStrength, validateEmail, sanitizeString } from '../utils/security.js';
import { loginRateLimiter, registerRateLimiter } from '../middleware/rateLimiter.js';
import { authenticateUser, type AuthenticatedRequest } from '../middleware/authMiddleware.js';

const router = Router();
const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is not defined in .env');
}

// =============================
// REGISTER
// =============================
// OWASP A01: Broken Access Control Prevention
// Public registration strictly assigns role = 'STUDENT'. Role parameter from client is ignored.
// OWASP A07: Identification and Authentication - Rate limiting and password complexity.

router.post('/register', registerRateLimiter, async (req, res) => {
  try {
    const { name, email, password, department } = req.body;

    // 1. Mandatory fields check
    if (!name || !email || !password) {
      return res.status(400).json({
        message: 'Name, email and password are required.',
      });
    }

    const cleanName = sanitizeString(name);
    if (!cleanName || cleanName.length < 2) {
      return res.status(400).json({
        message: 'Name must be at least 2 characters long.',
      });
    }

    const cleanDept =
      typeof department === 'string' && department.trim().length > 0
        ? sanitizeString(department.trim())
        : null;

    // 2. Email format validation
    const normalizedEmail = String(email).trim().toLowerCase();
    if (!validateEmail(normalizedEmail)) {
      return res.status(400).json({
        message: 'Please provide a valid email address.',
      });
    }

    // 3. OWASP Password strength check
    const passwordCheck = validatePasswordStrength(password);
    if (!passwordCheck.isValid) {
      return res.status(400).json({
        message: passwordCheck.message,
        errors: passwordCheck.errors,
      });
    }

    // 4. Duplicate user check
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      return res.status(409).json({
        message: 'An account with this email already exists.',
      });
    }

    // 5. Password hashing with bcrypt (12 salt rounds for strong cryptographic security)
    const hashedPassword = await bcrypt.hash(password, 12);

    // 6. Enforce STUDENT role strictly (prevents privilege escalation)
    const user = await prisma.user.create({
      data: {
        name: cleanName,
        email: normalizedEmail,
        password: hashedPassword,
        role: 'STUDENT',
        department: cleanDept,
      },
    });

    // 7. Generate JWT session token
    const token = jwt.sign(
      {
        userId: user.id,
        role: user.role,
      },
      JWT_SECRET,
      {
        expiresIn: '7d',
      }
    );

    return res.status(201).json({
      message: 'Account registered successfully.',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
      },
    });
  } catch (error) {
    console.error('❌ Registration error:', error);
    return res.status(500).json({
      message: 'Registration failed. Please try again later.',
    });
  }
});

// =============================
// LOGIN
// =============================
// Rate limited to 5 attempts per 15 minutes per IP address.

router.post('/login', loginRateLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: 'Email and password are required.',
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    // Generic error message prevents user enumeration (OWASP A07)
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

    const token = jwt.sign(
      {
        userId: user.id,
        role: user.role,
      },
      JWT_SECRET,
      {
        expiresIn: '7d',
      }
    );

    return res.json({
      message: 'Login successful.',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('❌ Login error:', error);
    return res.status(500).json({
      message: 'Login failed. Please try again later.',
    });
  }
});

// =============================
// CHANGE PASSWORD
// =============================
router.post('/change-password', authenticateUser, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required.' });
    }

    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Both current password and new password are required.' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const passwordMatch = await bcrypt.compare(currentPassword, user.password);
    if (!passwordMatch) {
      return res.status(400).json({ message: 'Incorrect current password.' });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({ message: 'New password cannot be identical to current password.' });
    }

    const passwordCheck = validatePasswordStrength(newPassword);
    if (!passwordCheck.isValid) {
      return res.status(400).json({
        message: passwordCheck.message,
        errors: passwordCheck.errors,
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    return res.json({ message: 'Password updated successfully.' });
  } catch (error) {
    console.error('❌ Change password error:', error);
    return res.status(500).json({ message: 'Failed to update password.' });
  }
});

export default router;
