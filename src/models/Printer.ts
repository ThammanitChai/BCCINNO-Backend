import mongoose, { Document, Schema } from 'mongoose';

export type PrinterStatus = 'available' | 'in_use' | 'maintenance';

export interface IPrinter extends Document {
  name: string; // e.g. "Bambu Lab P1P #1"
  modelName: string;
  type: 'FDM' | 'Resin';
  status: PrinterStatus;
  currentUser?: mongoose.Types.ObjectId;
  currentSessionStart?: Date;
  totalHoursUsed: number;
  notes?: string;
}

const printerSchema = new Schema<IPrinter>(
  {
    name: { type: String, required: true, unique: true },
    modelName: { type: String, required: true },
    type: { type: String, enum: ['FDM', 'Resin'], required: true },
    status: {
      type: String,
      enum: ['available', 'in_use', 'maintenance'],
      default: 'available',
    },
    currentUser: { type: Schema.Types.ObjectId, ref: 'User' },
    currentSessionStart: { type: Date },
    totalHoursUsed: { type: Number, default: 0 },
    notes: { type: String },
  },
  { timestamps: true }
);

export const Printer = mongoose.model<IPrinter>('Printer', printerSchema);
