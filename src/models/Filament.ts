import mongoose, { Document, Schema } from 'mongoose';

export interface IFilament extends Document {
  type: string; // PLA, PLA Pro, ABS, PETG, TPU, PC-ABS
  brand: string;
  subBrand?: string;
  color: string;
  recommendedStock: number;
  minimumStock: number;
  currentAmount: number;
  pricePerGram: number;
  isDiscontinued: boolean;
  notes?: string;
}

const filamentSchema = new Schema<IFilament>(
  {
    type: { type: String, required: true },
    brand: { type: String, required: true },
    subBrand: { type: String },
    color: { type: String, required: true },
    recommendedStock: { type: Number, default: 5 },
    minimumStock: { type: Number, default: 2 },
    currentAmount: { type: Number, default: 0 },
    pricePerGram: { type: Number, default: 2 }, // baht/gram
    isDiscontinued: { type: Boolean, default: false },
    notes: { type: String },
  },
  { timestamps: true }
);

filamentSchema.index({ type: 1, brand: 1, color: 1 });

export const Filament = mongoose.model<IFilament>('Filament', filamentSchema);
