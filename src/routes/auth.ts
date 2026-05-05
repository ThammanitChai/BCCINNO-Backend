import { Router, Response } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { User } from '../models/User';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  studentId: z.string().min(1),
  nationalIdLast4: z.string().length(4).optional(),
  phone: z.string().optional(),
  track: z.enum(['training', 'inno_smart', 'quota_bme', 'quota_engineer', 'olympic', 'staff', 'customer']),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function signToken(id: string, role: string): string {
  return jwt.sign({ id, role }, process.env.JWT_SECRET as string, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  } as jwt.SignOptions);
}

router.post('/register', async (req, res, next) => {
  try {
    const body = registerSchema.parse(req.body);
    const exists = await User.findOne({ email: body.email });
    if (exists) {
      return res.status(409).json({ message: 'Email already registered' });
    }
    const user = await User.create(body);
    const token = signToken(user.id, user.role);
    res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        studentId: user.studentId,
        track: user.track,
        role: user.role,
        hoursQuota: user.hoursQuota,
        hoursUsed: user.hoursUsed,
        hoursRemaining: user.hoursRemaining(),
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    if (!user.isActive) {
      return res.status(403).json({ message: 'Account disabled' });
    }
    const token = signToken(user.id, user.role);
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        studentId: user.studentId,
        track: user.track,
        role: user.role,
        hoursQuota: user.hoursQuota,
        hoursUsed: user.hoursUsed,
        hoursRemaining: user.hoursRemaining(),
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  const user = req.user!;
  res.json({
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    studentId: user.studentId,
    track: user.track,
    role: user.role,
    phone: user.phone,
    hoursQuota: user.hoursQuota,
    hoursUsed: user.hoursUsed,
    hoursRemaining: user.hoursRemaining(),
  });
});

export default router;
