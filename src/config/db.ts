import mongoose from 'mongoose';

export async function connectDB(uri: string): Promise<void> {
  try {
    mongoose.set('strictQuery', true);
    await mongoose.connect(uri);
    console.log('✓ MongoDB connected');
  } catch (err) {
    console.error('✗ MongoDB connection error:', err);
    process.exit(1);
  }
}

mongoose.connection.on('disconnected', () => {
  console.warn('⚠ MongoDB disconnected');
});
