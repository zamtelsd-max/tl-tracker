import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import bcrypt from 'bcryptjs';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { body, validationResult } from 'express-validator';

const router = Router();

router.use(authenticate);
router.use(requireRole('ADMIN'));

// GET /api/v1/admin/users
router.get('/users', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        staffId: true,
        name: true,
        role: true,
        zone: true,
        region: true,
        territory: true,
        active: true,
        createdAt: true,
        asTeamLead: { select: { id: true, aseId: true, allocatedTarget: true } },
      },
    });
    res.json({ success: true, data: users });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// POST /api/v1/admin/users
router.post(
  '/users',
  [
    body('staffId').notEmpty(),
    body('pin').isLength({ min: 4, max: 4 }),
    body('name').notEmpty(),
    body('role').isIn(['HSD', 'ZBM', 'ASE', 'TL', 'ADMIN']),
  ],
  async (req: AuthRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, error: errors.array()[0].msg });
      return;
    }

    try {
      const { staffId, pin, name, role, zone, region, territory, aseId } = req.body as {
        staffId: string;
        pin: string;
        name: string;
        role: string;
        zone?: string;
        region?: string;
        territory?: string;
        aseId?: string;
      };

      const existing = await prisma.user.findUnique({ where: { staffId } });
      if (existing) {
        res.status(409).json({ success: false, error: 'Staff ID already exists' });
        return;
      }

      const pinHash = await bcrypt.hash(pin, 10);
      const user = await prisma.user.create({
        data: {
          staffId,
          pinHash,
          name,
          role: role as 'HSD' | 'ZBM' | 'ASE' | 'TL' | 'ADMIN',
          zone: zone || null,
          region: region || null,
          territory: territory || null,
        },
      });

      // Create TeamLead record if role is TL
      if (role === 'TL') {
        await prisma.teamLead.create({
          data: {
            userId: user.id,
            aseId: aseId || null,
            zone: zone || null,
            region: region || null,
          },
        });
      }

      res.status(201).json({
        success: true,
        data: { id: user.id, staffId: user.staffId, name: user.name, role: user.role },
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, error: 'Server error' });
    }
  }
);

// PATCH /api/v1/admin/users/:id
router.patch('/users/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, zone, region, territory, active, pin } = req.body as {
      name?: string;
      zone?: string;
      region?: string;
      territory?: string;
      active?: boolean;
      pin?: string;
    };

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    const updateData: {
      name?: string;
      zone?: string;
      region?: string;
      territory?: string;
      active?: boolean;
      pinHash?: string;
    } = {};
    if (name !== undefined) updateData.name = name;
    if (zone !== undefined) updateData.zone = zone;
    if (region !== undefined) updateData.region = region;
    if (territory !== undefined) updateData.territory = territory;
    if (active !== undefined) updateData.active = active;
    if (pin) updateData.pinHash = await bcrypt.hash(pin, 10);

    const updated = await prisma.user.update({ where: { id }, data: updateData });
    res.json({
      success: true,
      data: { id: updated.id, staffId: updated.staffId, name: updated.name, active: updated.active },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// DELETE /api/v1/admin/users/:id
router.delete('/users/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await prisma.user.update({ where: { id }, data: { active: false } });
    res.json({ success: true, data: { message: 'User deactivated' } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

export { router as adminRouter };
