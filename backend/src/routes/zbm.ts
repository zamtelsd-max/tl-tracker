import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { calculateKPIs, getCurrentHourSlot, getWorkingHours } from '../services/kpi';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';

const router = Router();

router.use(authenticate);
router.use(requireRole('ZBM', 'ADMIN'));

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
