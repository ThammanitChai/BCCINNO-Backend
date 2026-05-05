import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

export type UserRole = 'student' | 'admin';
export type UserTrack =
  | 'biomedical'
  | 'engineer'
  | 'secondary'
  | 'primary'
  | 'staff';

const TRACK_QUOTA: Record<UserTrack, number> = {
  biomedical: 16,
  engineer: 8,
  secondary: 4,
  primary: 2,
  staff: 0, // approved per case
};

export interface IUser extends Document {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  studentId: string; // รหัสนักเรียน / รหัสเงินเดือน
  nationalIdLast4?: string;
  phone?: string;
  track: UserTrack;
  role: UserRole;
  hoursQuota: number;
  hoursUsed: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidate: string): Promise<boolean>;
  hoursRemaining(): number;
}

const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true, minlength: 6 },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    studentId: { type: String, required: true, trim: true, index: true },
    nationalIdLast4: { type: String, trim: true },
    phone: { type: String, trim: true },
    track: {
      type: String,
      enum: ['biomedical', 'engineer', 'secondary', 'primary', 'staff'],
      required: true,
    },
    role: {
      type: String,
      enum: ['student', 'admin'],
      default: 'student',
    },
    hoursQuota: { type: Number, default: 0 },
    hoursUsed: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Auto-set quota based on track on first save
userSchema.pre('save', async function (next) {
  if (this.isNew && this.hoursQuota === 0) {
    this.hoursQuota = TRACK_QUOTA[this.track] ?? 0;
  }
  if (this.isModified('password')) {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  }
  next();
});

userSchema.methods.comparePassword = async function (candidate: string) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.hoursRemaining = function () {
  return Math.max(0, this.hoursQuota - this.hoursUsed);
};

userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

export const User = mongoose.model<IUser>('User', userSchema);
export { TRACK_QUOTA };
