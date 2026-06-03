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

// ── GET /api/v1/lister/copperbelt-performance — all Copperbelt TLs' performance ──
router.get('/copperbelt-performance', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Match Copperbelt by zone OR region (region casing is messy: COPPERBELT, COPPERBET, etc.)
    const tls = await prisma.teamLead.findMany({
      where: {
        OR: [
          { zone:   { contains: 'opperbel', mode: 'insensitive' } },
          { region: { contains: 'opperbe',  mode: 'insensitive' } },
        ],
      },
      include: { user: { select: { name: true, staffId: true, active: true } }, ase: { select: { name: true } } },
    });

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const yd = new Date(today); yd.setDate(yd.getDate() - 1);
    const ydStr = yd.toISOString().split('T')[0];
    const w7 = new Date(today); w7.setDate(w7.getDate() - 6);
    const w7Str = w7.toISOString().split('T')[0];
    const mtdStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;

    const rows = await Promise.all(tls.map(async (tl) => {
      const [todayA, ydA, weekA, mtdA] = await Promise.all([
        prisma.activation.aggregate({ where: { teamLeadId: tl.id, date: todayStr }, _sum: { count: true } }),
        prisma.activation.aggregate({ where: { teamLeadId: tl.id, date: ydStr },    _sum: { count: true } }),
        prisma.activation.aggregate({ where: { teamLeadId: tl.id, date: { gte: w7Str,  lte: todayStr } }, _sum: { count: true } }),
        prisma.activation.aggregate({ where: { teamLeadId: tl.id, date: { gte: mtdStr, lte: todayStr } }, _sum: { count: true } }),
      ]);
      const monthly = mtdA._sum.count ?? 0;
      const target  = tl.allocatedTarget || 50;
      return {
        id: tl.id, name: tl.user?.name || '—', staffId: tl.user?.staffId || '',
        zone: tl.zone || '', region: tl.region || '', ase: tl.ase?.name || 'Unassigned',
        active: tl.user?.active !== false,
        today: todayA._sum.count ?? 0, yesterday: ydA._sum.count ?? 0,
        weekly: weekA._sum.count ?? 0, monthly, target,
        attainment: target > 0 ? Math.min(Math.round(monthly / target * 100), 100) : 0,
      };
    }));
    rows.sort((a, b) => b.monthly - a.monthly);

    const totals = rows.reduce((acc, r) => {
      acc.today += r.today; acc.yesterday += r.yesterday; acc.weekly += r.weekly;
      acc.monthly += r.monthly; acc.target += r.target;
      return acc;
    }, { today: 0, yesterday: 0, weekly: 0, monthly: 0, target: 0 });

    res.json({
      success: true,
      data: {
        region: 'Copperbelt',
        tlCount: rows.length,
        totals: { ...totals, attainment: totals.target > 0 ? Math.min(Math.round(totals.monthly / totals.target * 100), 100) : 0 },
        teamLeads: rows,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// ── GET /api/v1/lister/export — Copperbelt activations Excel export ──────────
import ExcelJS from 'exceljs';
router.get('/export', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const tls = await prisma.teamLead.findMany({
      where: {
        OR: [
          { zone:   { contains: 'opperbel', mode: 'insensitive' } },
          { region: { contains: 'opperbe',  mode: 'insensitive' } },
        ],
      },
      include: { user: { select: { name: true, staffId: true } }, ase: { select: { name: true } } },
    });
    const today = new Date(); const todayStr = today.toISOString().split('T')[0];
    const mtdStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Zamtel TL Tracker';
    const sheet = wb.addWorksheet('Copperbelt Activations (MTD)');
    sheet.columns = [
      { header: 'Team Lead', key: 'name', width: 24 },
      { header: 'Staff ID', key: 'staffId', width: 14 },
      { header: 'Zone', key: 'zone', width: 16 },
      { header: 'Region', key: 'region', width: 18 },
      { header: 'ASE', key: 'ase', width: 22 },
      { header: 'MTD Activations', key: 'monthly', width: 16 },
      { header: 'Target', key: 'target', width: 10 },
      { header: 'Attainment %', key: 'attainment', width: 14 },
    ];
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF004F9F' } };

    for (const tl of tls) {
      const mtd = await prisma.activation.aggregate({ where: { teamLeadId: tl.id, date: { gte: mtdStr, lte: todayStr } }, _sum: { count: true } });
      const monthly = mtd._sum.count ?? 0;
      const target = tl.allocatedTarget || 50;
      sheet.addRow({
        name: tl.user?.name || '—', staffId: tl.user?.staffId || '',
        zone: tl.zone || '', region: tl.region || '', ase: tl.ase?.name || 'Unassigned',
        monthly, target, attainment: target > 0 ? Math.round(monthly / target * 100) : 0,
      });
    }

    const buf = await wb.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="copperbelt-activations-${todayStr}.xlsx"`);
    res.send(Buffer.from(buf));
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Export failed' });
  }
});

export { router as listerRouter };
