import mongoose, { Document, Schema } from 'mongoose';

export type ReservationStatus =
  | 'reserved'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export interface IReservation extends Document {
  user: mongoose.Types.ObjectId;
  printer: mongoose.Types.ObjectId;
  jobName: string;
  filamentType?: string;
  filamentColor?: string;
  filamentWeight?: number; // grams
  scheduledStart: Date;
  scheduledHours: number;
  actualStart?: Date;
  actualEnd?: Date;
  hoursConsumed?: number;
  status: ReservationStatus;
  fileUrl?: string;
  modelFileName?: string;
  infillPercent?: number;
  cost?: number;
  notes?: string;
}

const reservationSchema = new Schema<IReservation>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    printer: { type: Schema.Types.ObjectId, ref: 'Printer', required: true },
    jobName: { type: String, required: true, trim: true },
    filamentType: { type: String, trim: true },
    filamentColor: { type: String, trim: true },
    filamentWeight: { type: Number, min: 0 },
    scheduledStart: { type: Date, required: true },
    scheduledHours: { type: Number, required: true, min: 0.5 },
    actualStart: { type: Date },
    actualEnd: { type: Date },
    hoursConsumed: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['reserved', 'in_progress', 'completed', 'cancelled'],
      default: 'reserved',
    },
    fileUrl: { type: String },
    modelFileName: { type: String },
    infillPercent: { type: Number, min: 0, max: 100 },
    cost: { type: Number, default: 0 },
    notes: { type: String },
  },
  { timestamps: true }
);

reservationSchema.index({ user: 1, scheduledStart: -1 });
reservationSchema.index({ printer: 1, scheduledStart: 1 });

export const Reservation = mongoose.model<IReservation>(
  'Reservation',
  reservationSchema
);
