import { Router, Response } from 'express';
import { Printer } from '../models/Printer';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';
import { z } from 'zod';

const router = Router();

router.get('/', authenticate, async (_req: AuthRequest, res: Response) => {
  const printers = await Printer.find()
    .populate('currentUser', 'firstName lastName studentId')
    .sort({ name: 1 });
  res.json(printers);
});

router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  const printer = await Printer.findById(req.params.id).populate(
    'currentUser',
    'firstName lastName studentId'
  );
  if (!printer) return res.status(404).json({ message: 'Printer not found' });
  res.json(printer);
});

const createSchema = z.object({
  name: z.string().min(1),
  modelName: z.string().min(1),
  type: z.enum(['FDM', 'Resin']),
  notes: z.string().optional(),
});

router.post(
  '/',
  authenticate,
  requireAdmin,
  async (req: AuthRequest, res: Response, next) => {
    try {
      const body = createSchema.parse(req.body);
      const printer = await Printer.create(body);
      res.status(201).json(printer);
    } catch (err) {
      next(err);
    }
  }
);

router.patch(
  '/:id',
  authenticate,
  requireAdmin,
  async (req: AuthRequest, res: Response, next) => {
    try {
      const printer = await Printer.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
      });
      if (!printer)
        return res.status(404).json({ message: 'Printer not found' });
      res.json(printer);
    } catch (err) {
      next(err);
    }
  }
);

router.delete(
  '/:id',
  authenticate,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    await Printer.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
  }
);

export default router;
