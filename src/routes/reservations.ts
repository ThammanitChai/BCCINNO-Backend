import { Router, Response } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { Reservation } from '../models/Reservation';
import { Printer } from '../models/Printer';
import { User } from '../models/User';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

const createSchema = z.object({
  printerId: z.string(),
  jobName: z.string().min(1),
  filamentType: z.string().optional(),
  filamentColor: z.string().optional(),
  filamentWeight: z.number().min(0).optional(),
  scheduledStart: z.string().datetime(),
  scheduledHours: z.number().min(0.5).max(48),
  fileUrl: z.string().url().optional(),
  notes: z.string().optional(),
});

// List own reservations (or all for admin)
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  const filter: Record<string, unknown> = {};
  if (req.user!.role !== 'admin') {
    filter.user = req.user!._id;
  } else if (req.query.userId) {
    filter.user = req.query.userId;
  }
  if (req.query.status) filter.status = req.query.status;
  if (req.query.printerId) filter.printer = req.query.printerId;

  const reservations = await Reservation.find(filter)
    .populate('user', 'firstName lastName studentId email track')
    .populate('printer', 'name modelName type')
    .sort({ scheduledStart: -1 })
    .limit(200);
  res.json(reservations);
});

// Today's schedule for grid view
router.get(
  '/schedule/today',
  authenticate,
  async (_req: AuthRequest, res: Response) => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const reservations = await Reservation.find({
      scheduledStart: { $gte: start, $lte: end },
      status: { $in: ['reserved', 'in_progress'] },
    })
      .populate('user', 'firstName lastName studentId')
      .populate('printer', 'name')
      .sort({ scheduledStart: 1 });
    res.json(reservations);
  }
);

// Create reservation
router.post('/', authenticate, async (req: AuthRequest, res: Response, next) => {
  try {
    const body = createSchema.parse(req.body);
    const printer = await Printer.findById(body.printerId);
    if (!printer) return res.status(404).json({ message: 'Printer not found' });
    if (printer.status === 'maintenance') {
      return res.status(400).json({ message: 'Printer under maintenance' });
    }

    const scheduledStart = new Date(body.scheduledStart);
    const scheduledEnd = new Date(
      scheduledStart.getTime() + body.scheduledHours * 3600 * 1000
    );

    // Conflict detection — same printer, overlapping time
    const conflict = await Reservation.findOne({
      printer: printer._id,
      status: { $in: ['reserved', 'in_progress'] },
      $or: [
        {
          scheduledStart: { $lt: scheduledEnd },
          $expr: {
            $gt: [
              {
                $add: [
                  '$scheduledStart',
                  { $multiply: ['$scheduledHours', 3600000] },
                ],
              },
              scheduledStart.getTime(),
            ],
          },
        },
      ],
    });
    if (conflict) {
      return res.status(409).json({ message: 'Time slot conflicts with existing reservation' });
    }

    if (req.user!.hoursRemaining() < body.scheduledHours) {
      return res.status(400).json({
        message: `Insufficient hours. You have ${req.user!.hoursRemaining()}h remaining`,
      });
    }

    const reservation = await Reservation.create({
      user: req.user!._id,
      printer: printer._id,
      jobName: body.jobName,
      filamentType: body.filamentType,
      filamentColor: body.filamentColor,
      filamentWeight: body.filamentWeight,
      scheduledStart,
      scheduledHours: body.scheduledHours,
      fileUrl: body.fileUrl,
      notes: body.notes,
    });
    const populated = await reservation.populate([
      { path: 'user', select: 'firstName lastName studentId email' },
      { path: 'printer', select: 'name modelName type' },
    ]);
    res.status(201).json(populated);
  } catch (err) {
    next(err);
  }
});

// Check-in
router.post(
  '/:id/check-in',
  authenticate,
  async (req: AuthRequest, res: Response, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const reservation = await Reservation.findById(req.params.id).session(
        session
      );
      if (!reservation) {
        await session.abortTransaction();
        return res.status(404).json({ message: 'Reservation not found' });
      }
      if (
        reservation.user.toString() !== req.user!.id &&
        req.user!.role !== 'admin'
      ) {
        await session.abortTransaction();
        return res.status(403).json({ message: 'Not your reservation' });
      }
      if (reservation.status !== 'reserved') {
        await session.abortTransaction();
        return res.status(400).json({ message: 'Cannot check in this reservation' });
      }
      reservation.status = 'in_progress';
      reservation.actualStart = new Date();
      await reservation.save({ session });

      await Printer.findByIdAndUpdate(
        reservation.printer,
        {
          status: 'in_use',
          currentUser: reservation.user,
          currentSessionStart: reservation.actualStart,
        },
        { session }
      );
      await session.commitTransaction();
      res.json(reservation);
    } catch (err) {
      await session.abortTransaction();
      next(err);
    } finally {
      session.endSession();
    }
  }
);

// Check-out
router.post(
  '/:id/check-out',
  authenticate,
  async (req: AuthRequest, res: Response, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const reservation = await Reservation.findById(req.params.id).session(
        session
      );
      if (!reservation) {
        await session.abortTransaction();
        return res.status(404).json({ message: 'Reservation not found' });
      }
      if (
        reservation.user.toString() !== req.user!.id &&
        req.user!.role !== 'admin'
      ) {
        await session.abortTransaction();
        return res.status(403).json({ message: 'Not your reservation' });
      }
      if (reservation.status !== 'in_progress') {
        await session.abortTransaction();
        return res.status(400).json({ message: 'Not currently in progress' });
      }

      const end = new Date();
      const start = reservation.actualStart || end;
      const hoursConsumed =
        Math.round(((end.getTime() - start.getTime()) / 3600000) * 100) / 100;

      reservation.status = 'completed';
      reservation.actualEnd = end;
      reservation.hoursConsumed = hoursConsumed;
      await reservation.save({ session });

      await User.findByIdAndUpdate(
        reservation.user,
        { $inc: { hoursUsed: hoursConsumed } },
        { session }
      );

      await Printer.findByIdAndUpdate(
        reservation.printer,
        {
          status: 'available',
          $unset: { currentUser: '', currentSessionStart: '' },
          $inc: { totalHoursUsed: hoursConsumed },
        },
        { session }
      );
      await session.commitTransaction();
      res.json(reservation);
    } catch (err) {
      await session.abortTransaction();
      next(err);
    } finally {
      session.endSession();
    }
  }
);

// Cancel
router.post(
  '/:id/cancel',
  authenticate,
  async (req: AuthRequest, res: Response, next) => {
    try {
      const reservation = await Reservation.findById(req.params.id);
      if (!reservation)
        return res.status(404).json({ message: 'Reservation not found' });
      if (
        reservation.user.toString() !== req.user!.id &&
        req.user!.role !== 'admin'
      ) {
        return res.status(403).json({ message: 'Not your reservation' });
      }
      if (reservation.status !== 'reserved') {
        return res.status(400).json({ message: 'Can only cancel reserved jobs' });
      }
      reservation.status = 'cancelled';
      await reservation.save();
      res.json(reservation);
    } catch (err) {
      next(err);
    }
  }
);

// Admin: stats
router.get(
  '/stats/overview',
  authenticate,
  requireAdmin,
  async (_req: AuthRequest, res: Response) => {
    const [totalUsers, activeUsers, totalReservations, completedToday] =
      await Promise.all([
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
      {
        $group: {
          _id: '$printer',
          totalHours: { $sum: '$hoursConsumed' },
          jobs: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: 'printers',
          localField: '_id',
          foreignField: '_id',
          as: 'printer',
        },
      },
      { $unwind: '$printer' },
      { $sort: { totalHours: -1 } },
    ]);

    const trackUsage = await User.aggregate([
      { $match: { role: 'student' } },
      {
        $group: {
          _id: '$track',
          users: { $sum: 1 },
          totalHoursUsed: { $sum: '$hoursUsed' },
        },
      },
    ]);

    res.json({
      totalUsers,
      activeUsers,
      totalReservations,
      completedToday,
      printerUsage,
      trackUsage,
    });
  }
);

export default router;
