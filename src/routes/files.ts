import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

const UPLOAD_DIR = process.env.UPLOAD_DIR || '/tmp/iems-uploads';
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['.stl', '.obj', '.3mf', '.amf', '.step', '.stp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error(`Unsupported format: ${ext}. Allowed: ${allowed.join(', ')}`));
  },
});

router.post(
  '/upload',
  authenticate,
  upload.single('model'),
  (req: AuthRequest, res: Response) => {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    const base = process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 4000}`;
    const fileUrl = `${base}/uploads/${req.file.filename}`;

    res.json({
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      url: fileUrl,
    });
  }
);

export default router;
