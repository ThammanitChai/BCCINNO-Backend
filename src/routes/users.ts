import { Router, Response } from 'express';
import { z } from 'zod';
import { User, TRACK_QUOTA } from '../models/User';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

router.patch(
  '/me',
  authenticate,
  async (req: AuthRequest, res: Response, next) => {
    try {
      const { phone } = z.object({
        phone: z.string().max(20).optional(),
      }).parse(req.body);
      const user = await User.findByIdAndUpdate(
        req.user!.id,
        { phone },
        { new: true, select: '-password' }
      );
      if (!user) return res.status(404).json({ message: 'User not found' });
      res.json(user);
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/',
  authenticate,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    const filter: Record<string, unknown> = {};
    if (req.query.track) filter.track = req.query.track;
    if (req.query.role) filter.role = req.query.role;
    if (req.query.q) {
      const q = String(req.query.q);
      filter.$or = [
        { firstName: { $regex: q, $options: 'i' } },
        { lastName: { $regex: q, $options: 'i' } },
        { studentId: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
      ];
    }
    const users = await User.find(filter)
      .sort({ createdAt: -1 })
      .limit(500);
    res.json(users);
  }
);

const updateSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phone: z.string().optional(),
  track: z
    .enum(['biomedical', 'engineer', 'secondary', 'primary', 'staff'])
    .optional(),
  role: z.enum(['student', 'admin']).optional(),
  hoursQuota: z.number().min(0).optional(),
  hoursUsed: z.number().min(0).optional(),
  isActive: z.boolean().optional(),
});

router.patch(
  '/:id',
  authenticate,
  requireAdmin,
  async (req: AuthRequest, res: Response, next) => {
    try {
      const body = updateSchema.parse(req.body);
      const user = await User.findByIdAndUpdate(req.params.id, body, {
        new: true,
      });
      if (!user) return res.status(404).json({ message: 'User not found' });
      res.json(user);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/:id/grant-hours',
  authenticate,
  requireAdmin,
  async (req: AuthRequest, res: Response, next) => {
    try {
      const { hours } = z.object({ hours: z.number() }).parse(req.body);
      const user = await User.findByIdAndUpdate(
        req.params.id,
        { $inc: { hoursQuota: hours } },
        { new: true }
      );
      if (!user) return res.status(404).json({ message: 'User not found' });
      res.json(user);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/:id/reset-term',
  authenticate,
  requireAdmin,
  async (req: AuthRequest, res: Response, next) => {
    try {
      const user = await User.findById(req.params.id);
      if (!user) return res.status(404).json({ message: 'User not found' });
      user.hoursUsed = 0;
      user.hoursQuota = TRACK_QUOTA[user.track] ?? user.hoursQuota;
      await user.save();
      res.json(user);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
