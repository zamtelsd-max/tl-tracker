import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import bcrypt from 'bcryptjs';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);
router.use(requireRole('LISTER', 'ADMIN'));

// ── GET /api/v1/lister/pool  — full TL pool with assignment status ──────────
router.get('/pool', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const tls = await prisma.user.findMany({
      where: { role: 'TL' },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        staffId: true,
        name: true,
        zone: true,
        region: true,
        territory: true,
        active: true,
        createdAt: true,
        asTeamLead: {
          select: {
            id: true,
            aseId: true,
            allocatedTarget: true,
            ase: { select: { staffId: true, name: true } },
          },
        },
      },
    });
    res.json({ success: true, data: tls });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// ── POST /api/v1/lister/pool  — add new TL to pool ─────────────────────────
router.post('/pool', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { staffId, name, pin, zone, region, territory } = req.body as {
      staffId: string; name: string; pin?: string;
      zone?: string; region?: string; territory?: string;
    };

    if (!staffId?.trim() || !name?.trim()) {
      res.status(400).json({ success: false, error: 'staffId and name are required' });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { staffId: staffId.trim() } });
    if (existing) {
      res.status(409).json({ success: false, error: `Staff ID "${staffId}" already exists` });
      return;
    }

    const rawPin = pin?.trim() || '1234';
    if (rawPin.length !== 4 || !/^\d{4}$/.test(rawPin)) {
      res.status(400).json({ success: false, error: 'PIN must be exactly 4 digits' });
      return;
    }

    const pinHash = await bcrypt.hash(rawPin, 10);

    const user = await prisma.user.create({
      data: {
        staffId: staffId.trim(),
        pinHash,
        name: name.trim(),
        role: 'TL',
        zone: zone?.trim() || null,
        region: region?.trim() || null,
        territory: territory?.trim() || null,
      },
    });

    // Always create the TeamLead record (aseId null = in pool, unassigned)
    const tl = await prisma.teamLead.create({
      data: { userId: user.id, aseId: null, zone: zone?.trim() || null, region: region?.trim() || null },
    });

    res.status(201).json({
      success: true,
      data: { userId: user.id, teamLeadId: tl.id, staffId: user.staffId, name: user.name },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// ── PATCH /api/v1/lister/pool/:userId  — edit TL details ───────────────────
router.patch('/pool/:userId', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const { name, zone, region, territory, pin, active, allocatedTarget } = req.body as {
      name?: string; zone?: string; region?: string; territory?: string;
      pin?: string; active?: boolean; allocatedTarget?: number;
    };

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== 'TL') {
      res.status(404).json({ success: false, error: 'TL not found' });
      return;
    }

    // Update User record
    const userUpdate: Record<string, unknown> = {};
    if (name !== undefined) userUpdate.name = name.trim();
    if (zone !== undefined) userUpdate.zone = zone.trim() || null;
    if (region !== undefined) userUpdate.region = region.trim() || null;
    if (territory !== undefined) userUpdate.territory = territory.trim() || null;
    if (active !== undefined) userUpdate.active = active;
    if (pin) {
      if (!/^\d{4}$/.test(pin)) {
        res.status(400).json({ success: false, error: 'PIN must be 4 digits' });
        return;
      }
      userUpdate.pinHash = await bcrypt.hash(pin, 10);
    }

    const updated = await prisma.user.update({ where: { id: userId }, data: userUpdate });

    // Update TeamLead record fields if provided
    if (zone !== undefined || region !== undefined || allocatedTarget !== undefined) {
      const tlUpdate: Record<string, unknown> = {};
      if (zone !== undefined) tlUpdate.zone = zone.trim() || null;
      if (region !== undefined) tlUpdate.region = region.trim() || null;
      if (allocatedTarget !== undefined) tlUpdate.allocatedTarget = Number(allocatedTarget);
      await prisma.teamLead.updateMany({ where: { userId }, data: tlUpdate });
    }

    res.json({ success: true, data: { id: updated.id, staffId: updated.staffId, name: updated.name } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// ── DELETE /api/v1/lister/pool/:userId  — remove TL (only if unassigned) ───
router.delete('/pool/:userId', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { asTeamLead: { select: { aseId: true } } },
    });

    if (!user || user.role !== 'TL') {
      res.status(404).json({ success: false, error: 'TL not found' });
      return;
    }

    if (user.asTeamLead?.aseId) {
      res.status(409).json({
        success: false,
        error: `Cannot delete — this TL is currently assigned to an ASE. Unassign them first.`,
      });
      return;
    }

    // Soft-delete: deactivate user (preserves history)
    await prisma.user.update({ where: { id: userId }, data: { active: false } });

    res.json({ success: true, data: { message: `${user.name} removed from pool` } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

export { router as listerRouter };
