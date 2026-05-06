import { Router, Response } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { Reservation } from '../models/Reservation';
import { Printer } from '../models/Printer';
import { User } from '../models/User';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

const fileSchema = z.object({ url: z.string().url(), originalName: z.string() });

// ─── List ────────────────────────────────────────────────────────────────────
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  const filter: Record<string, unknown> = {};
  if (req.user!.role !== 'admin') filter.user = req.user!._id;
  else if (req.query.userId) filter.user = req.query.userId;
  if (req.query.status) filter.status = req.query.status;
  if (req.query.printerId) filter.printer = req.query.printerId;

  const reservations = await Reservation.find(filter)
    .populate('user', 'firstName lastName studentId email track')
    .populate('printer', 'name modelName type')
    .sort({ createdAt: -1 })
    .limit(200);
  res.json(reservations);
});

// ─── Get single ──────────────────────────────────────────────────────────────
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  const r = await Reservation.findById(req.params.id)
    .populate('user', 'firstName lastName studentId email track')
    .populate('printer', 'name modelName type bambuSerial bambuIp bambuAccessCode');
  if (!r) return res.status(404).json({ message: 'Not found' });
  if (r.user._id.toString() !== req.user!.id && req.user!.role !== 'admin') {
    return res.status(403).json({ message: 'Forbidden' });
  }
  res.json(r);
});

// ─── Create (student) ────────────────────────────────────────────────────────
router.post('/', authenticate, async (req: AuthRequest, res: Response, next) => {
  try {
    const body = z.object({
      printerType: z.enum(['FDM_open', 'FDM_closed', 'Resin']),
      jobName: z.string().min(1),
      filamentType: z.string().optional(),
      infillPercent: z.number().min(0).max(100).optional(),
      scheduledStart: z.string().datetime(),
      files: z.array(fileSchema).optional(),
      notes: z.string().optional(),
    }).parse(req.body);

    const r = await Reservation.create({
      user: req.user!._id,
      printerType: body.printerType,
      jobName: body.jobName,
      filamentType: body.filamentType,
      infillPercent: body.infillPercent,
      scheduledStart: new Date(body.scheduledStart),
      files: body.files ?? [],
      notes: body.notes,
      status: 'pending_review',
    });
    const populated = await r.populate([
      { path: 'user', select: 'firstName lastName studentId email' },
    ]);
    res.status(201).json(populated);
  } catch (err) { next(err); }
});

// ─── Admin: update notes / pickupTime / estimatedHours etc ───────────────────
router.patch('/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response, next) => {
  try {
    const body = z.object({
      notes: z.string().optional(),
      pickupTime: z.string().datetime().optional().nullable(),
      estimatedHours: z.number().min(0).optional(),
      estimatedWeight: z.number().min(0).optional(),
    }).parse(req.body);
    const update: Record<string, unknown> = {};
    if (body.notes !== undefined) update.notes = body.notes;
    if (body.pickupTime !== undefined) update.pickupTime = body.pickupTime ? new Date(body.pickupTime) : null;
    if (body.estimatedHours !== undefined) update.estimatedHours = body.estimatedHours;
    if (body.estimatedWeight !== undefined) update.estimatedWeight = body.estimatedWeight;
    const r = await Reservation.findByIdAndUpdate(req.params.id, update, { new: true })
      .populate('user', 'firstName lastName studentId email track')
      .populate('printer', 'name modelName type bambuSerial bambuIp bambuAccessCode');
    if (!r) return res.status(404).json({ message: 'Not found' });
    res.json(r);
  } catch (err) { next(err); }
});

// ─── Admin: slice + set estimates → pending_confirmation ─────────────────────
router.post('/:id/slice', authenticate, requireAdmin, async (req: AuthRequest, res: Response, next) => {
  try {
    const body = z.object({
      sliceImages: z.array(fileSchema).min(1),
      estimatedHours: z.number().min(0),
      estimatedWeight: z.number().min(0).optional(),
    }).parse(req.body);
    const r = await Reservation.findById(req.params.id);
    if (!r) return res.status(404).json({ message: 'Not found' });
    if (!['pending_review', 'pending_confirmation'].includes(r.status)) {
      return res.status(400).json({ message: 'Cannot slice at this stage' });
    }
    r.sliceImages.push(...body.sliceImages);
    r.estimatedHours = body.estimatedHours;
    if (body.estimatedWeight !== undefined) r.estimatedWeight = body.estimatedWeight;
    r.status = 'pending_confirmation';
    await r.save();
    await r.populate([
      { path: 'user', select: 'firstName lastName studentId email' },
      { path: 'printer', select: 'name modelName type' },
    ]);
    res.json(r);
  } catch (err) { next(err); }
});

// ─── Student: confirm + select printer → confirmed ───────────────────────────
router.post('/:id/confirm', authenticate, async (req: AuthRequest, res: Response, next) => {
  try {
    const body = z.object({ printerId: z.string() }).parse(req.body);
    const r = await Reservation.findById(req.params.id);
    if (!r) return res.status(404).json({ message: 'Not found' });
    if (r.user.toString() !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden' });
    }
    if (r.status !== 'pending_confirmation') {
      return res.status(400).json({ message: 'Nothing to confirm' });
    }
    const printer = await Printer.findById(body.printerId);
    if (!printer) return res.status(404).json({ message: 'Printer not found' });
    if (printer.status === 'maintenance') {
      return res.status(400).json({ message: 'Printer under maintenance' });
    }
    r.printer = printer._id as mongoose.Types.ObjectId;
    r.status = 'confirmed';
    await r.save();
    await r.populate([
      { path: 'user', select: 'firstName lastName studentId email' },
      { path: 'printer', select: 'name modelName type' },
    ]);
    res.json(r);
  } catch (err) { next(err); }
});

// ─── Admin: start printing → in_progress ─────────────────────────────────────
router.post('/:id/start-print', authenticate, requireAdmin, async (req: AuthRequest, res: Response, next) => {
  try {
    const r = await Reservation.findById(req.params.id);
    if (!r) return res.status(404).json({ message: 'Not found' });
    if (r.status !== 'confirmed') {
      return res.status(400).json({ message: 'Not confirmed by student yet' });
    }
    r.status = 'in_progress';
    r.actualStart = new Date();
    await r.save();
    if (r.printer) {
      await Printer.findByIdAndUpdate(r.printer, {
        status: 'in_use',
        currentUser: r.user,
        currentSessionStart: r.actualStart,
      });
    }
    await r.populate([
      { path: 'user', select: 'firstName lastName studentId email' },
      { path: 'printer', select: 'name modelName type bambuSerial bambuIp bambuAccessCode' },
    ]);
    res.json(r);
  } catch (err) { next(err); }
});

// ─── Admin: complete → deduct hours ──────────────────────────────────────────
router.post('/:id/complete', authenticate, requireAdmin, async (req: AuthRequest, res: Response, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const body = z.object({
      hoursConsumed: z.number().min(0),
      resultPhotos: z.array(fileSchema).optional(),
      pickupTime: z.string().datetime().optional(),
    }).parse(req.body);

    const r = await Reservation.findById(req.params.id).session(session);
    if (!r) { await session.abortTransaction(); return res.status(404).json({ message: 'Not found' }); }
    if (!['in_progress', 'confirmed'].includes(r.status)) {
      await session.abortTransaction();
      return res.status(400).json({ message: 'Cannot complete at this stage' });
    }
    const end = new Date();
    r.status = 'completed';
    r.actualEnd = end;
    r.hoursConsumed = body.hoursConsumed;
    if (body.resultPhotos?.length) r.resultPhotos.push(...body.resultPhotos);
    if (body.pickupTime) r.pickupTime = new Date(body.pickupTime);
    await r.save({ session });

    // Deduct hours from student quota
    await User.findByIdAndUpdate(r.user, { $inc: { hoursUsed: body.hoursConsumed } }, { session });

    // Free printer if assigned
    if (r.printer) {
      await Printer.findByIdAndUpdate(r.printer, {
        status: 'available',
        $unset: { currentUser: '', currentSessionStart: '' },
        $inc: { totalHoursUsed: body.hoursConsumed },
      }, { session });
    }
    await session.commitTransaction();
    await r.populate([
      { path: 'user', select: 'firstName lastName studentId email' },
      { path: 'printer', select: 'name modelName type' },
    ]);
    res.json(r);
  } catch (err) {
    await session.abortTransaction();
    next(err);
  } finally {
    session.endSession();
  }
});

// ─── Add result photo (admin, after completion) ───────────────────────────────
router.post('/:id/result-photos', authenticate, requireAdmin, async (req: AuthRequest, res: Response, next) => {
  try {
    const body = z.object({ photos: z.array(fileSchema).min(1) }).parse(req.body);
    const r = await Reservation.findByIdAndUpdate(
      req.params.id,
      { $push: { resultPhotos: { $each: body.photos } } },
      { new: true }
    ).populate('user', 'firstName lastName studentId email');
    if (!r) return res.status(404).json({ message: 'Not found' });
    res.json(r);
  } catch (err) { next(err); }
});

// ─── Add comment (student or admin) ──────────────────────────────────────────
router.post('/:id/comment', authenticate, async (req: AuthRequest, res: Response, next) => {
  try {
    const body = z.object({ message: z.string().min(1) }).parse(req.body);
    const r = await Reservation.findById(req.params.id);
    if (!r) return res.status(404).json({ message: 'Not found' });
    if (r.user.toString() !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden' });
    }
    r.comments.push({
      from: req.user!.role === 'admin' ? 'admin' : 'student',
      message: body.message,
      createdAt: new Date(),
    });
    await r.save();
    res.json(r);
  } catch (err) { next(err); }
});

// ─── Cancel ──────────────────────────────────────────────────────────────────
router.post('/:id/cancel', authenticate, async (req: AuthRequest, res: Response, next) => {
  try {
    const r = await Reservation.findById(req.params.id);
    if (!r) return res.status(404).json({ message: 'Not found' });
    if (r.user.toString() !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden' });
    }
    const cancellable: string[] = req.user!.role === 'admin'
      ? ['pending_review', 'pending_confirmation', 'confirmed', 'in_progress']
      : ['pending_review', 'pending_confirmation'];
    if (!cancellable.includes(r.status)) {
      return res.status(400).json({ message: 'Cannot cancel at this stage' });
    }
    if (r.status === 'in_progress' && r.printer) {
      await Printer.findByIdAndUpdate(r.printer, {
        status: 'available',
        $unset: { currentUser: '', currentSessionStart: '' },
      });
    }
    r.status = 'cancelled';
    await r.save();
    res.json(r);
  } catch (err) { next(err); }
});

// ─── Today's schedule ─────────────────────────────────────────────────────────
router.get('/schedule/today', authenticate, async (_req: AuthRequest, res: Response) => {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end = new Date(); end.setHours(23, 59, 59, 999);
  const reservations = await Reservation.find({
    scheduledStart: { $gte: start, $lte: end },
    status: { $in: ['confirmed', 'in_progress'] },
  })
    .populate('user', 'firstName lastName studentId')
    .populate('printer', 'name')
    .sort({ scheduledStart: 1 });
  res.json(reservations);
});

// ─── Stats ────────────────────────────────────────────────────────────────────
router.get('/stats/overview', authenticate, requireAdmin, async (_req: AuthRequest, res: Response) => {
  const [totalUsers, activeUsers, totalReservations, completedToday] = await Promise.all([
    User.countDocuments({ role: 'student' }),
    User.countDocuments({ role: 'student', isActive: true }),
    Reservation.countDocuments(),
    Reservation.countDocuments({
      status: 'completed',
      actualEnd: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
    }),
  ]);

  const printerUsage = await Reservation.aggregate([
    { $match: { status: 'completed' } },
    { $group: { _id: '$printer', totalHours: { $sum: '$hoursConsumed' }, jobs: { $sum: 1 } } },
    { $lookup: { from: 'printers', localField: '_id', foreignField: '_id', as: 'printer' } },
    { $unwind: '$printer' },
    { $sort: { totalHours: -1 } },
  ]);

  const trackUsage = await User.aggregate([
    { $match: { role: 'student' } },
    { $group: { _id: '$track', users: { $sum: 1 }, totalHoursUsed: { $sum: '$hoursUsed' } } },
  ]);

  res.json({ totalUsers, activeUsers, totalReservations, completedToday, printerUsage, trackUsage });
});

export default router;
