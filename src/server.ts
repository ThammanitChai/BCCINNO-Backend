import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import { connectDB } from './config/db';
import { errorHandler } from './middleware/errorHandler';

import authRoutes from './routes/auth';
import printerRoutes from './routes/printers';
import reservationRoutes from './routes/reservations';
import filamentRoutes from './routes/filaments';
import userRoutes from './routes/users';

const app = express();
const PORT = parseInt(process.env.PORT || '4000', 10);
const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://localhost:27017/iems-lab';

const corsOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000')
  .split(',')
  .map((s) => s.trim());

app.use(helmet());
app.use(
  cors({
    origin: corsOrigins,
    credentials: true,
  })
);
app.use(express.json({ limit: '5mb' }));
app.use(morgan('tiny'));

// Rate limit only the auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'iems-lab-api', time: new Date().toISOString() });
});

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/printers', printerRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/filaments', filamentRoutes);
app.use('/api/users', userRoutes);

app.use((_req, res) => res.status(404).json({ message: 'Not found' }));
app.use(errorHandler);

(async () => {
  await connectDB(MONGODB_URI);
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`✓ IEMS API listening on port ${PORT}`);
  });
})();
