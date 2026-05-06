import mongoose, { Document, Schema } from 'mongoose';

export type ReservationStatus =
  | 'pending_review'      // student submitted, waiting for admin to slice
  | 'pending_confirmation' // admin sliced, waiting for student to confirm
  | 'confirmed'           // student confirmed, waiting for admin to print
  | 'in_progress'         // printing
  | 'completed'           // done, hours deducted
  | 'cancelled';

export type PrinterType = 'FDM_open' | 'FDM_closed' | 'Resin';

interface IFileAttachment {
  url: string;
  originalName: string;
}

interface IComment {
  from: 'admin' | 'student';
  message: string;
  createdAt: Date;
}

export interface IReservation extends Document {
  user: mongoose.Types.ObjectId;
  printer?: mongoose.Types.ObjectId;   // assigned at confirmation
  printerType: PrinterType;
  jobName: string;
  filamentType?: string;
  infillPercent?: number;
  scheduledStart: Date;
  // Admin fills:
  estimatedHours?: number;
  estimatedWeight?: number;
  // Completion:
  hoursConsumed?: number;
  actualStart?: Date;
  actualEnd?: Date;
  status: ReservationStatus;
  // File attachments:
  files: IFileAttachment[];        // student uploads
  sliceImages: IFileAttachment[];  // admin uploads after slicing
  resultPhotos: IFileAttachment[]; // admin uploads on completion
  // Communication:
  comments: IComment[];
  notes?: string;
  pickupTime?: Date;
}

const fileSchema = new Schema<IFileAttachment>(
  { url: { type: String, required: true }, originalName: { type: String, required: true } },
  { _id: false }
);

const commentSchema = new Schema<IComment>(
  {
    from: { type: String, enum: ['admin', 'student'], required: true },
    message: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const reservationSchema = new Schema<IReservation>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    printer: { type: Schema.Types.ObjectId, ref: 'Printer' },
    printerType: { type: String, enum: ['FDM_open', 'FDM_closed', 'Resin'], required: true },
    jobName: { type: String, required: true, trim: true },
    filamentType: { type: String, trim: true },
    infillPercent: { type: Number, min: 0, max: 100 },
    scheduledStart: { type: Date, required: true },
    estimatedHours: { type: Number, min: 0 },
    estimatedWeight: { type: Number, min: 0 },
    hoursConsumed: { type: Number, default: 0 },
    actualStart: { type: Date },
    actualEnd: { type: Date },
    status: {
      type: String,
      enum: ['pending_review', 'pending_confirmation', 'confirmed', 'in_progress', 'completed', 'cancelled'],
      default: 'pending_review',
    },
    files: [fileSchema],
    sliceImages: [fileSchema],
    resultPhotos: [fileSchema],
    comments: [commentSchema],
    notes: { type: String },
    pickupTime: { type: Date },
  },
  { timestamps: true }
);

reservationSchema.index({ user: 1, createdAt: -1 });
reservationSchema.index({ status: 1, scheduledStart: 1 });

export const Reservation = mongoose.model<IReservation>('Reservation', reservationSchema);
