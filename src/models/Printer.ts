import mongoose, { Document, Schema } from 'mongoose';

export type PrinterStatus = 'available' | 'in_use' | 'maintenance';
export type PrinterType = 'FDM_open' | 'FDM_closed' | 'Resin';

export interface IPrinter extends Document {
  name: string;
  modelName: string;
  type: PrinterType;
  status: PrinterStatus;
  currentUser?: mongoose.Types.ObjectId;
  currentSessionStart?: Date;
  totalHoursUsed: number;
  notes?: string;
  bambuSerial?: string;
  bambuIp?: string;
  bambuAccessCode?: string;
}

const printerSchema = new Schema<IPrinter>(
  {
    name: { type: String, required: true, unique: true },
    modelName: { type: String, required: true },
    type: { type: String, enum: ['FDM_open', 'FDM_closed', 'Resin'], required: true },
    status: {
      type: String,
      enum: ['available', 'in_use', 'maintenance'],
      default: 'available',
    },
    currentUser: { type: Schema.Types.ObjectId, ref: 'User' },
    currentSessionStart: { type: Date },
    totalHoursUsed: { type: Number, default: 0 },
    notes: { type: String },
    bambuSerial: { type: String },
    bambuIp: { type: String },
    bambuAccessCode: { type: String },
  },
  { timestamps: true }
);

export const Printer = mongoose.model<IPrinter>('Printer', printerSchema);
