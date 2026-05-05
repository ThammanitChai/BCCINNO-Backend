import { Router, Response } from 'express';
import { z } from 'zod';
import { Filament } from '../models/Filament';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, async (_req: AuthRequest, res: Response) => {
  const filaments = await Filament.find().sort({ type: 1, brand: 1, color: 1 });
  res.json(filaments);
});

const upsertSchema = z.object({
  type: z.string().min(1),
  brand: z.string().min(1),
  subBrand: z.string().optional(),
  color: z.string().min(1),
  recommendedStock: z.number().min(0).optional(),
  minimumStock: z.number().min(0).optional(),
  currentAmount: z.number().min(0).optional(),
  pricePerGram: z.number().min(0).optional(),
  isDiscontinued: z.boolean().optional(),
  notes: z.string().optional(),
});

router.post(
  '/',
  authenticate,
  requireAdmin,
  async (req: AuthRequest, res: Response, next) => {
    try {
      const body = upsertSchema.parse(req.body);
      const filament = await Filament.create(body);
      res.status(201).json(filament);
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
      const filament = await Filament.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true }
      );
      if (!filament)
        return res.status(404).json({ message: 'Filament not found' });
      res.json(filament);
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
    await Filament.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
  }
);

router.get(
  '/low-stock/list',
  authenticate,
  async (_req: AuthRequest, res: Response) => {
    const filaments = await Filament.find({
      isDiscontinued: false,
      $expr: { $lte: ['$currentAmount', '$minimumStock'] },
    }).sort({ currentAmount: 1 });
    res.json(filaments);
  }
);

export default router;
