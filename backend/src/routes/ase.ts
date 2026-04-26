import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { calculateKPIs, getCurrentHourSlot, getWorkingHours } from '../services/kpi';

const router = Router();

router.use(authenticate);
router.use(requireRole('ASE', 'ADMIN'));

// GET /api/v1/ase/dashboard
router.get('/dashboard', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.user!;
    const today = new Date().toISOString().split('T')[0];

    const teamLeads = await prisma.teamLead.findMany({
      where: { aseId: userId },
      include: { user: true, dsas: { where: { status: 'ACTIVE' } } },
    });

    let totalActivations = 0;
    let totalTeams = teamLeads.length;
    let teamsWithActivity = 0;
    const currentSlot = getCurrentHourSlot();

    const tlSummaries = await Promise.all(
      teamLeads.map(async (tl) => {
        const acts = await prisma.activation.findMany({
          where: { teamLeadId: tl.id, date: today },
        });
        const tlTotal = acts.reduce((sum, a) => sum + a.count, 0);
        totalActivations += tlTotal;
        if (tlTotal > 0) teamsWithActivity++;

        const workingHours = getWorkingHours();
        const hourlyActivations = workingHours.map((wh) => {
          const whNum = parseInt(wh);
          const slot = `${wh}:00-${String(whNum + 1).padStart(2, '0')}:00`;
          const slotActs = acts.filter((a) => a.hourSlot === slot);
          return { slot, activations: slotActs.reduce((sum, a) => sum + a.count, 0) };
        });

        const thisHourActs = acts.filter((a) => a.hourSlot === currentSlot);
        const kpis = calculateKPIs({
          totalActivations: tlTotal,
          dsaCount: tl.dsas.length,
          activeDSAsToday: new Set(acts.map((a) => a.dsaId)).size,
          activationsThisHour: thisHourActs.reduce((sum, a) => sum + a.count, 0),
          activeDSAsThisHour: new Set(thisHourActs.map((a) => a.dsaId)).size,
          hourlyActivations,
          allocatedTarget: tl.allocatedTarget,
        });

        const attainmentPct = kpis.teamTargetAttainment;
        const statusBadge =
          attainmentPct >= 80 ? 'on-track' : attainmentPct >= 50 ? 'at-risk' : 'critical';

        return {
          id: tl.id,
          name: tl.user.name,
          staffId: tl.user.staffId,
          zone: tl.zone,
          region: tl.region,
          activations: tlTotal,
          target: tl.allocatedTarget,
          attainment: Math.round(attainmentPct),
          runRate: Math.round(kpis.runRateForecast * 10) / 10,
          dsaCount: tl.dsas.length,
          status: statusBadge,
        };
      })
    );

    const avgRunRate =
      tlSummaries.length > 0
        ? tlSummaries.reduce((s, t) => s + t.runRate, 0) / tlSummaries.length
        : 0;

    const exceptions = await prisma.alert.findMany({
      where: {
        teamLead: { aseId: userId },
        status: 'SENT',
        createdAt: { gte: new Date(today) },
      },
      include: { teamLead: { include: { user: true } } },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: {
        summary: {
          totalActivations,
          totalTeams,
          teamsWithActivity,
          avgRunRate: Math.round(avgRunRate * 10) / 10,
          exceptions: exceptions.length,
        },
        teamLeads: tlSummaries,
        exceptions,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// GET /api/v1/ase/teamleads
router.get('/teamleads', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.user!;
    const teamLeads = await prisma.teamLead.findMany({
      where: { aseId: userId },
      include: { user: true, dsas: true },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ success: true, data: teamLeads });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// GET /api/v1/ase/teamleads/:id
router.get('/teamleads/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.user!;
    const { id } = req.params;
    const today = new Date().toISOString().split('T')[0];

    const tl = await prisma.teamLead.findFirst({
      where: { id, aseId: userId },
      include: { user: true, dsas: true },
    });

    if (!tl) {
      res.status(404).json({ success: false, error: 'Team lead not found' });
      return;
    }

    const activations = await prisma.activation.findMany({
      where: { teamLeadId: id, date: today },
      include: { dsa: true },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: { tl, activations } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// GET /api/v1/ase/exceptions
router.get('/exceptions', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.user!;
    const today = new Date().toISOString().split('T')[0];

    const teamLeads = await prisma.teamLead.findMany({
      where: { aseId: userId },
      include: { dsas: { where: { status: 'ACTIVE' } } },
    });

    const exceptions = [];
    for (const tl of teamLeads) {
      for (const dsa of tl.dsas) {
        const acts = await prisma.activation.count({
          where: { dsaId: dsa.id, date: today },
        });
        if (acts === 0) {
          exceptions.push({ tlId: tl.id, dsaId: dsa.id, dsaName: dsa.name });
        }
      }
    }

    res.json({ success: true, data: exceptions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// GET /api/v1/ase/alerts
router.get('/alerts', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.user!;
    const alerts = await prisma.alert.findMany({
      where: { targetUserId: userId },
      include: { teamLead: { include: { user: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json({ success: true, data: alerts });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

export { router as aseRouter };
