import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { calculateKPIs, getCurrentHourSlot, getWorkingHours } from '../services/kpi';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';

const router = Router();

router.use(authenticate);
router.use(requireRole('ZBM', 'HSD', 'ADMIN'));

// GET /api/v1/zbm/dashboard
router.get('/dashboard', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.user!;
    const today = new Date().toISOString().split('T')[0];

    const zbmUser = await prisma.user.findUnique({ where: { id: userId } });
    const zone = zbmUser?.zone;

    const teamLeads = await prisma.teamLead.findMany({
      where: zone ? { zone } : {},
      include: { user: true, dsas: { where: { status: 'ACTIVE' } } },
    });

    const currentSlot = getCurrentHourSlot();
    let totalActivations = 0;
    let totalTargets = 0;
    let teamsBelow = 0;
    const workingHours = getWorkingHours();

    const tlData = await Promise.all(
      teamLeads.map(async (tl) => {
        const acts = await prisma.activation.findMany({
          where: { teamLeadId: tl.id, date: today },
        });
        const tlTotal = acts.reduce((sum, a) => sum + a.count, 0);
        totalActivations += tlTotal;
        totalTargets += tl.allocatedTarget;

        const thisHourActs = acts.filter((a) => a.hourSlot === currentSlot);
        const hourlyActivations = workingHours.map((wh) => {
          const whNum = parseInt(wh);
          const slot = `${wh}:00-${String(whNum + 1).padStart(2, '0')}:00`;
          const slotActs = acts.filter((a) => a.hourSlot === slot);
          return { slot, activations: slotActs.reduce((sum, a) => sum + a.count, 0) };
        });

        const kpis = calculateKPIs({
          totalActivations: tlTotal,
          dsaCount: tl.dsas.length,
          activeDSAsToday: new Set(acts.map((a) => a.dsaId)).size,
          activationsThisHour: thisHourActs.reduce((sum, a) => sum + a.count, 0),
          activeDSAsThisHour: new Set(thisHourActs.map((a) => a.dsaId)).size,
          hourlyActivations,
          allocatedTarget: tl.allocatedTarget,
        });

        if (kpis.teamTargetAttainment < 50) teamsBelow++;

        return {
          id: tl.id,
          name: tl.user.name,
          zone: tl.zone,
          region: tl.region,
          activations: tlTotal,
          target: tl.allocatedTarget,
          attainment: Math.round(kpis.teamTargetAttainment),
          runRate: Math.round(kpis.runRateForecast * 10) / 10,
          hourlyActivations,
        };
      })
    );

    const complianceRate =
      totalTargets > 0 ? Math.round((totalActivations / totalTargets) * 100) : 0;
    const avgRunRate =
      tlData.length > 0 ? tlData.reduce((s, t) => s + t.runRate, 0) / tlData.length : 0;

    // Heatmap: hours vs team leads
    const heatmapData = tlData.map((tl) => ({
      name: tl.name,
      slots: tl.hourlyActivations,
    }));

    res.json({
      success: true,
      data: {
        zone,
        summary: {
          totalActivations,
          totalTargets,
          complianceRate,
          avgRunRate: Math.round(avgRunRate * 10) / 10,
          teamsBelow,
          totalTeams: teamLeads.length,
        },
        teamLeads: tlData,
        heatmap: heatmapData,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// GET /api/v1/zbm/runrate
router.get('/runrate', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.user!;
    const today = new Date().toISOString().split('T')[0];

    const zbmUser = await prisma.user.findUnique({ where: { id: userId } });
    const zone = zbmUser?.zone;

    const teamLeads = await prisma.teamLead.findMany({
      where: zone ? { zone } : {},
    });

    const currentSlot = getCurrentHourSlot();
    const workingHours = getWorkingHours();

    const rates = await Promise.all(
      teamLeads.map(async (tl) => {
        const acts = await prisma.activation.findMany({
          where: { teamLeadId: tl.id, date: today },
        });
        const tlTotal = acts.reduce((sum, a) => sum + a.count, 0);
        const thisHourActs = acts.filter((a) => a.hourSlot === currentSlot);
        const hourlyActivations = workingHours.map((wh) => {
          const whNum = parseInt(wh);
          const slot = `${wh}:00-${String(whNum + 1).padStart(2, '0')}:00`;
          const slotActs = acts.filter((a) => a.hourSlot === slot);
          return { slot, activations: slotActs.reduce((sum, a) => sum + a.count, 0) };
        });
        const kpis = calculateKPIs({
          totalActivations: tlTotal,
          dsaCount: 10,
          activeDSAsToday: new Set(acts.map((a) => a.dsaId)).size,
          activationsThisHour: thisHourActs.reduce((sum, a) => sum + a.count, 0),
          activeDSAsThisHour: new Set(thisHourActs.map((a) => a.dsaId)).size,
          hourlyActivations,
          allocatedTarget: tl.allocatedTarget,
        });
        return { id: tl.id, runRateForecast: kpis.runRateForecast, requiredRunRate: kpis.requiredRunRate };
      })
    );

    res.json({ success: true, data: rates });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// POST /api/v1/zbm/teamleads — create a new TL under a specified ASE (or unassigned)
router.post(
  '/teamleads',
  [
    body('staffId').notEmpty().withMessage('Staff ID required'),
    body('name').notEmpty().withMessage('Name required'),
    body('pin').isLength({ min: 4, max: 4 }).withMessage('PIN must be 4 digits'),
    body('region').notEmpty().withMessage('Region required'),
  ],
  async (req: AuthRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, error: errors.array()[0].msg });
      return;
    }
    try {
      const { userId } = req.user!;
      const zbmUser = await prisma.user.findUnique({ where: { id: userId } });
      const { staffId, name, pin, region, aseId, allocatedTarget } = req.body as {
        staffId: string; name: string; pin: string; region: string;
        aseId?: string; allocatedTarget?: number;
      };

      const existing = await prisma.user.findUnique({ where: { staffId: staffId.toUpperCase() } });
      if (existing) {
        res.status(409).json({ success: false, error: 'Staff ID already exists' });
        return;
      }

      const pinHash = await bcrypt.hash(pin, 10);
      const tlUser = await prisma.user.create({
        data: {
          staffId: staffId.toUpperCase(),
          pinHash,
          name,
          role: 'TL',
          zone: zbmUser?.zone ?? undefined,
          region,
        },
      });

      const tl = await prisma.teamLead.create({
        data: {
          userId: tlUser.id,
          aseId: aseId ?? null,
          zone: zbmUser?.zone ?? undefined,
          region,
          allocatedTarget: allocatedTarget ?? 50,
        },
      });

      res.status(201).json({ success: true, data: { user: tlUser, teamLead: tl } });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, error: 'Server error' });
    }
  }
);

// GET /api/v1/zbm/leaderboard?level=tl|ase — scoped to this ZBM's zone
router.get('/leaderboard', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.user!;
    const zbmUser = await prisma.user.findUnique({ where: { id: userId } });
    const zone = zbmUser?.zone;
    const level = (req.query.level as string) || 'tl';
    const today = new Date().toISOString().split('T')[0];

    if (level === 'tl') {
      const tls = await prisma.teamLead.findMany({
        where: zone ? { zone } : {},
        include: { user: true, dsas: { where: { status: 'ACTIVE' } }, ase: true },
      });
      const ranked = await Promise.all(tls.map(async (tl) => {
        const agg = await prisma.activation.aggregate({ where: { teamLeadId: tl.id, date: today }, _sum: { count: true } });
        const activations = agg._sum.count || 0;
        const attainment = tl.allocatedTarget > 0 ? Math.round((activations / tl.allocatedTarget) * 100) : 0;
        return { id: tl.id, name: tl.user.name, staffId: tl.user.staffId, zone: tl.zone ?? 'Unknown', region: tl.region ?? '', aseName: tl.ase?.name ?? null, dsaCount: tl.dsas.length, activations, target: tl.allocatedTarget, attainment };
      }));
      ranked.sort((a, b) => b.activations - a.activations || b.attainment - a.attainment);
      res.json({ success: true, data: { level: 'tl', entries: ranked } });
    } else if (level === 'ase') {
      const ases = await prisma.user.findMany({ where: { role: 'ASE', active: true, ...(zone ? { zone } : {}) }, include: { teamLeads: { include: { dsas: { where: { status: 'ACTIVE' } } } } } });
      const ranked = await Promise.all(ases.map(async (ase) => {
        let activations = 0, target = 0, dsaCount = 0;
        for (const tl of ase.teamLeads) {
          const agg = await prisma.activation.aggregate({ where: { teamLeadId: tl.id, date: today }, _sum: { count: true } });
          activations += agg._sum.count || 0; target += tl.allocatedTarget; dsaCount += tl.dsas.length;
        }
        const attainment = target > 0 ? Math.round((activations / target) * 100) : 0;
        return { id: ase.id, name: ase.name, staffId: ase.staffId, zone: ase.zone ?? 'Unknown', region: ase.region ?? '', tlCount: ase.teamLeads.length, dsaCount, activations, target, attainment };
      }));
      ranked.sort((a, b) => b.activations - a.activations || b.attainment - a.attainment);
      res.json({ success: true, data: { level: 'ase', entries: ranked } });
    } else {
      res.status(400).json({ success: false, error: 'Invalid level' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// GET /api/v1/zbm/teamleads — list all TLs in this ZBM's zone
router.get('/teamleads', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.user!;
    const zbmUser = await prisma.user.findUnique({ where: { id: userId } });
    const zone = zbmUser?.zone;
    const teamLeads = await prisma.teamLead.findMany({
      where: zone ? { zone } : {},
      include: { user: true, ase: true },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ success: true, data: teamLeads });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// POST /api/v1/zbm/ases — create a new ASE under this ZBM's zone
router.post(
  '/ases',
  [
    body('staffId').notEmpty().withMessage('Staff ID required'),
    body('name').notEmpty().withMessage('Name required'),
    body('pin').isLength({ min: 4, max: 4 }).withMessage('PIN must be 4 digits'),
    body('region').notEmpty().withMessage('Region required'),
  ],
  async (req: AuthRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, error: errors.array()[0].msg });
      return;
    }
    try {
      const { userId } = req.user!;
      const zbmUser = await prisma.user.findUnique({ where: { id: userId } });
      const { staffId, name, pin, region } = req.body as {
        staffId: string; name: string; pin: string; region: string;
      };

      const existing = await prisma.user.findUnique({ where: { staffId: staffId.toUpperCase() } });
      if (existing) {
        res.status(409).json({ success: false, error: 'Staff ID already exists' });
        return;
      }

      const pinHash = await bcrypt.hash(pin, 10);
      const aseUser = await prisma.user.create({
        data: {
          staffId: staffId.toUpperCase(),
          pinHash,
          name,
          role: 'ASE',
          zone: zbmUser?.zone ?? undefined,
          region,
        },
      });

      res.status(201).json({ success: true, data: aseUser });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, error: 'Server error' });
    }
  }
);

// GET /api/v1/zbm/ases — list ASEs in this ZBM's zone (for assigning TLs)
router.get('/ases', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.user!;
    const zbmUser = await prisma.user.findUnique({ where: { id: userId } });
    const zone = zbmUser?.zone;
    const ases = await prisma.user.findMany({
      where: { role: 'ASE', active: true, ...(zone ? { zone } : {}) },
      select: { id: true, staffId: true, name: true, zone: true, region: true },
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, data: ases });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Helper: count Mon-Fri working days between two date strings inclusive
function countWorkingDays(startStr: string, endStr: string): number {
  let count = 0;
  const d = new Date(startStr);
  const end = new Date(endStr);
  while (d <= end) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

// GET /api/v1/zbm/mtd
router.get('/mtd', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.user!;
    const zbmUser = await prisma.user.findUnique({ where: { id: userId } });
    const zone = zbmUser?.zone;

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const monthStart = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const today = now.toISOString().split('T')[0];
    const lastDay = new Date(year, month + 1, 0);
    const monthEnd = lastDay.toISOString().split('T')[0];
    const workingDaysTotal = countWorkingDays(monthStart, monthEnd);

    const tls = await prisma.teamLead.findMany({
      where: zone ? { zone } : {},
      select: { id: true, allocatedTarget: true },
    });
    const tlIds = tls.map((t) => t.id);
    const totalTarget = tls.reduce((s, t) => s + t.allocatedTarget, 0);
    const dailyTarget = workingDaysTotal > 0 ? totalTarget / workingDaysTotal : 0;

    const grouped = await prisma.activation.groupBy({
      by: ['date'],
      where: { teamLeadId: { in: tlIds }, date: { gte: monthStart, lte: today } },
      _sum: { count: true },
      orderBy: { date: 'asc' },
    });

    const days: { date: string; activations: number; target: number; cumActivations: number; cumTarget: number }[] = [];
    let cumAct = 0, cumTgt = 0;
    const cursor = new Date(monthStart);
    const todayD = new Date(today);
    while (cursor <= todayD) {
      const dateStr = cursor.toISOString().split('T')[0];
      const found = grouped.find((g) => g.date === dateStr);
      const acts = found?._sum.count ?? 0;
      const dow = cursor.getDay();
      const dayTarget = dow !== 0 && dow !== 6 ? Math.round(dailyTarget) : 0;
      cumAct += acts;
      cumTgt += dayTarget;
      days.push({ date: dateStr, activations: acts, target: dayTarget, cumActivations: cumAct, cumTarget: cumTgt });
      cursor.setDate(cursor.getDate() + 1);
    }

    res.json({ success: true, data: days });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

export { router as zbmRouter };

// ── PATCH /api/v1/zbm/teamleads/:id — edit TL details (ZBM/HSD) ────────────
router.patch('/teamleads/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.user!;
    const { id } = req.params;

    const zbmUser = await prisma.user.findUnique({ where: { id: userId } });
    const zone = zbmUser?.zone;

    // Verify TL is in this ZBM's zone (HSD can edit any)
    const tl = await prisma.teamLead.findFirst({
      where: { id, ...(zone && zbmUser?.role !== 'HSD' ? { zone } : {}) },
      include: { user: true },
    });
    if (!tl) { res.status(404).json({ success: false, error: 'Team lead not found' }); return; }

    const { name, zone: newZone, region, territory, allocatedTarget, pin } = req.body as {
      name?: string; zone?: string; region?: string; territory?: string;
      allocatedTarget?: number; pin?: string;
    };

    const userUpdate: Record<string, unknown> = {};
    if (name !== undefined)      userUpdate.name      = name.trim();
    if (newZone !== undefined)   userUpdate.zone      = newZone.trim() || null;
    if (region !== undefined)    userUpdate.region    = region.trim() || null;
    if (territory !== undefined) userUpdate.territory = territory.trim() || null;
    if (pin) {
      if (!/^\d{4}$/.test(pin)) { res.status(400).json({ success: false, error: 'PIN must be 4 digits' }); return; }
      userUpdate.pinHash = await bcrypt.hash(pin, 10);
    }
    if (Object.keys(userUpdate).length > 0) {
      await prisma.user.update({ where: { id: tl.userId }, data: userUpdate });
    }

    const tlUpdate: Record<string, unknown> = {};
    if (newZone !== undefined)         tlUpdate.zone            = newZone.trim() || null;
    if (region !== undefined)          tlUpdate.region          = region.trim() || null;
    if (allocatedTarget !== undefined) tlUpdate.allocatedTarget = Number(allocatedTarget);
    if (Object.keys(tlUpdate).length > 0) {
      await prisma.teamLead.update({ where: { id }, data: tlUpdate });
    }

    res.json({ success: true, data: { id, name: name ?? tl.user.name } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// ── DELETE /api/v1/zbm/teamleads/:id — unlink TL from ASE (ZBM/HSD) ────────
router.delete('/teamleads/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.user!;
    const { id } = req.params;

    const zbmUser = await prisma.user.findUnique({ where: { id: userId } });
    const zone = zbmUser?.zone;

    const tl = await prisma.teamLead.findFirst({
      where: { id, ...(zone && zbmUser?.role !== 'HSD' ? { zone } : {}) },
    });
    if (!tl) { res.status(404).json({ success: false, error: 'Team lead not found' }); return; }

    // Unlink from ASE (preserve history)
    await prisma.teamLead.update({ where: { id }, data: { aseId: null } });
    res.json({ success: true, data: { message: 'Team lead unlinked' } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// ── GET /api/v1/zbm/teamleads/:id/performance — yesterday/weekly/monthly ───
router.get('/teamleads/:id/performance', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const tl = await prisma.teamLead.findUnique({ where: { id } });
    if (!tl) { res.status(404).json({ success: false, error: 'Team lead not found' }); return; }

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const yd = new Date(today); yd.setDate(yd.getDate() - 1);
    const ydStr = yd.toISOString().split('T')[0];
    const w7 = new Date(today); w7.setDate(w7.getDate() - 6);
    const w7Str = w7.toISOString().split('T')[0];
    const mtdStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;

    const [yesterday, weekly, monthly, todayActs] = await Promise.all([
      prisma.activation.aggregate({ where: { teamLeadId: id, date: ydStr },  _sum: { count: true } }),
      prisma.activation.aggregate({ where: { teamLeadId: id, date: { gte: w7Str,  lte: todayStr } }, _sum: { count: true } }),
      prisma.activation.aggregate({ where: { teamLeadId: id, date: { gte: mtdStr, lte: todayStr } }, _sum: { count: true } }),
      prisma.activation.aggregate({ where: { teamLeadId: id, date: todayStr }, _sum: { count: true } }),
    ]);

    res.json({
      success: true,
      data: {
        today:     todayActs._sum.count ?? 0,
        yesterday: yesterday._sum.count ?? 0,
        weekly:    weekly._sum.count    ?? 0,
        monthly:   monthly._sum.count   ?? 0,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// ── GET /api/v1/zbm/export — Excel export for ZBM ────────────────────────────
import ExcelJS from 'exceljs';
router.get('/export', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const today = new Date().toISOString().split('T')[0];
    const mtdStart = today.substring(0, 7) + '-01';

    const zbmUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!zbmUser) { res.status(404).json({ success: false, error: 'ZBM not found' }); return; }
    const zone = zbmUser.zone;

    const teamLeads = await prisma.teamLead.findMany({
      where: zone ? { zone } : {},
      include: { user: true, ase: true, dsas: { where: { status: 'ACTIVE' } } },
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Zamtel TL Tracker';
    workbook.created = new Date();

    // Sheet 1: Zone TL Performance
    const sheet1 = workbook.addWorksheet('TL Performance');
    sheet1.columns = [
      { header: 'Team Lead', key: 'name', width: 22 },
      { header: 'Staff ID', key: 'staffId', width: 12 },
      { header: 'Zone', key: 'zone', width: 15 },
      { header: 'Region', key: 'region', width: 15 },
      { header: 'ASE', key: 'ase', width: 18 },
      { header: 'Active DSAs', key: 'dsas', width: 12 },
      { header: 'Today Activations', key: 'today', width: 18 },
      { header: 'MTD Activations', key: 'mtd', width: 18 },
      { header: 'MTD Target', key: 'target', width: 12 },
      { header: 'Attainment %', key: 'attainment', width: 14 },
    ];
    sheet1.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet1.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF003DA5' } };

    for (const tl of teamLeads) {
      const mtdAgg = await prisma.activation.aggregate({ where: { teamLeadId: tl.id, date: { gte: mtdStart, lte: today } }, _sum: { count: true } });
      const todayAgg = await prisma.activation.aggregate({ where: { teamLeadId: tl.id, date: today }, _sum: { count: true } });
      const mtd = mtdAgg._sum.count || 0;
      const todayActs = todayAgg._sum.count || 0;
      const target = tl.allocatedTarget * new Date().getDate();
      const attain = target > 0 ? Math.round((mtd / target) * 100) : 0;
      const row = sheet1.addRow({ name: tl.user.name, staffId: tl.user.staffId, zone: tl.zone || '', region: tl.region || '', ase: tl.ase?.name || 'UNASSIGNED', dsas: tl.dsas.length, today: todayActs, mtd, target, attainment: attain });
      if (attain < 50) row.font = { color: { argb: 'FFCC0000' } };
    }

    // Sheet 2: ASE Summary
    const sheet2 = workbook.addWorksheet('ASE Summary');
    sheet2.columns = [
      { header: 'ASE Name', key: 'name', width: 22 },
      { header: 'Staff ID', key: 'staffId', width: 12 },
      { header: 'No. of TLs', key: 'tlCount', width: 12 },
      { header: 'Total DSAs', key: 'dsaCount', width: 12 },
      { header: 'MTD Activations', key: 'mtd', width: 18 },
      { header: 'MTD Target', key: 'target', width: 12 },
      { header: 'Attainment %', key: 'attainment', width: 14 },
    ];
    sheet2.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet2.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF003DA5' } };

    const aseMap = new Map<string, { name: string; staffId: string; tlCount: number; dsaCount: number; mtd: number; target: number }>();
    for (const tl of teamLeads) {
      const key = tl.ase?.staffId || 'UNASSIGNED';
      const existing = aseMap.get(key) || { name: tl.ase?.name || 'UNASSIGNED', staffId: key, tlCount: 0, dsaCount: 0, mtd: 0, target: 0 };
      const mtdAgg = await prisma.activation.aggregate({ where: { teamLeadId: tl.id, date: { gte: mtdStart, lte: today } }, _sum: { count: true } });
      existing.tlCount++;
      existing.dsaCount += tl.dsas.length;
      existing.mtd += mtdAgg._sum.count || 0;
      existing.target += tl.allocatedTarget * new Date().getDate();
      aseMap.set(key, existing);
    }
    for (const ase of aseMap.values()) {
      const attain = ase.target > 0 ? Math.round((ase.mtd / ase.target) * 100) : 0;
      sheet2.addRow({ name: ase.name, staffId: ase.staffId, tlCount: ase.tlCount, dsaCount: ase.dsaCount, mtd: ase.mtd, target: ase.target, attainment: attain });
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=ZBM-${zone||'All'}-${today}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});
