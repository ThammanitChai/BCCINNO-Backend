import { Router, Response } from 'express';
import { Printer } from '../models/Printer';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';
import { z } from 'zod';
import mqtt from 'mqtt';

const router = Router();

router.get('/', authenticate, async (_req: AuthRequest, res: Response) => {
  const printers = await Printer.find()
    .populate('currentUser', 'firstName lastName studentId')
    .sort({ name: 1 });
  res.json(printers);
});

router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  const printer = await Printer.findById(req.params.id).populate(
    'currentUser',
    'firstName lastName studentId'
  );
  if (!printer) return res.status(404).json({ message: 'Printer not found' });
  res.json(printer);
});

const createSchema = z.object({
  name: z.string().min(1),
  modelName: z.string().min(1),
  type: z.enum(['FDM_open', 'FDM_closed', 'Resin']),
  notes: z.string().optional(),
});

router.post(
  '/',
  authenticate,
  requireAdmin,
  async (req: AuthRequest, res: Response, next) => {
    try {
      const body = createSchema.parse(req.body);
      const printer = await Printer.create(body);
      res.status(201).json(printer);
    } catch (err) {
      next(err);
    }
  }
);

router.patch(
  '/:id',
  authenticate,
  requireAdmin,
  async (req: AuthRequest, res: Response, next) => {
    try {
      const printer = await Printer.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
      });
      if (!printer)
        return res.status(404).json({ message: 'Printer not found' });
      res.json(printer);
    } catch (err) {
      next(err);
    }
  }
);

router.delete(
  '/:id',
  authenticate,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    await Printer.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
  }
);

router.post(
  '/:id/print',
  authenticate,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    const printer = await Printer.findById(req.params.id);
    if (!printer) return res.status(404).json({ message: 'Printer not found' });
    if (!printer.bambuIp || !printer.bambuSerial || !printer.bambuAccessCode) {
      return res.status(400).json({ message: 'Printer has no Bambu Lab credentials configured' });
    }

    const { jobName = 'IEMS Job', fileUrl = '' } = req.body;

    const client = mqtt.connect(`mqtts://${printer.bambuIp}`, {
      port: 8883,
      username: 'bblp',
      password: printer.bambuAccessCode,
      rejectUnauthorized: false,
      clientId: `iems_${Date.now()}`,
      connectTimeout: 8000,
    });

    const done = (err?: Error) => {
      try { client.end(true); } catch {}
      if (err) res.status(500).json({ message: err.message });
      else res.json({ ok: true, message: 'Print command sent to printer' });
    };

    client.once('connect', () => {
      const topic = `device/${printer.bambuSerial}/request`;
      const payload = JSON.stringify({
        print: {
          sequence_id: Date.now().toString(),
          command: 'project_file',
          param: 'Metadata/plate_1.gcode',
          subtask_name: jobName,
          url: fileUrl,
          timelapse: false,
          bed_leveling: true,
          flow_cali: false,
          vibration_cali: true,
          layer_inspect: false,
          use_ams: false,
          profile_id: '0',
        },
      });
      client.publish(topic, payload, { qos: 1 }, (err) => done(err ?? undefined));
    });

    client.once('error', (err) => done(err));
    setTimeout(() => done(new Error('MQTT connection timeout')), 10000);
  }
);

export default router;
