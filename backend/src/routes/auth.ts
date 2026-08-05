import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';
import { body, validationResult } from 'express-validator';

const router = Router();

router.post(
  '/login',
  [
    body('staffId').notEmpty().withMessage('Staff ID required'),
    body('pin').isLength({ min: 4, max: 4 }).withMessage('PIN must be 4 digits'),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, error: errors.array()[0].msg });
      return;
    }

    const { staffId, pin } = req.body as { staffId: string; pin: string };

    try {
      const user = await prisma.user.findUnique({ where: { staffId } });

      // ── DSA login path (DSAs live in the DSA table, not User) ──
      if (!user) {
        const dsa = await prisma.dSA.findUnique({ where: { staffId }, include: { teamLead: true } });
        if (dsa && dsa.pinHash && dsa.status === 'ACTIVE' && (await bcrypt.compare(pin, dsa.pinHash))) {
          const secret = process.env.JWT_SECRET || 'tl-tracker-jwt-secret-2024';
          const token = jwt.sign(
            { userId: dsa.id, staffId: dsa.staffId, role: 'DSA', dsaId: dsa.id, teamLeadId: dsa.teamLeadId },
            secret, { expiresIn: '24h' }
          );
          prisma.loginLog.create({ data: { userId: dsa.id, userName: dsa.name, role: 'DSA', zone: dsa.teamLead?.zone } }).catch(() => {});
          res.json({ success: true, data: { token, user: { id: dsa.id, staffId: dsa.staffId, name: dsa.name, role: 'DSA', teamLeadId: dsa.teamLeadId, dsaId: dsa.id, mustChangePin: dsa.mustChangePin } } });
          return;
        }
        res.status(401).json({ success: false, error: 'Invalid credentials' });
        return;
      }

      if (!user.active) {
        res.status(401).json({ success: false, error: 'Invalid credentials' });
        return;
      }

      const pinMatch = await bcrypt.compare(pin, user.pinHash);
      if (!pinMatch) {
        res.status(401).json({ success: false, error: 'Invalid credentials' });
        return;
      }

      // Get teamLeadId if TL
      let teamLeadId: string | undefined;
      if (user.role === 'TL') {
        const tl = await prisma.teamLead.findUnique({ where: { userId: user.id } });
        teamLeadId = tl?.id;
      }

      const secret = process.env.JWT_SECRET || 'tl-tracker-jwt-secret-2024';
      const token = jwt.sign(
        { userId: user.id, staffId: user.staffId, role: user.role, teamLeadId },
        secret,
        { expiresIn: '24h' }
      );

      // Record login event (fire-and-forget)
      prisma.loginLog.create({
        data: { userId: user.id, userName: user.name, role: user.role, zone: user.zone },
      }).catch(() => {});

      res.json({
        success: true,
        data: {
          token,
          user: {
            id: user.id,
            staffId: user.staffId,
            name: user.name,
            role: user.role,
            zone: user.zone,
            region: user.region,
            teamLeadId,
          },
        },
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, error: 'Server error' });
    }
  }
);

export { router as authRouter };
