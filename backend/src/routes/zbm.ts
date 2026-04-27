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

export { router as zbmRouter };
