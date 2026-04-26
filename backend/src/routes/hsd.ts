import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { calculateKPIs, getCurrentHourSlot, getWorkingHours } from '../services/kpi';
import ExcelJS from 'exceljs';

const router = Router();

router.use(authenticate);
router.use(requireRole('HSD', 'ADMIN'));

// GET /api/v1/hsd/dashboard
router.get('/dashboard', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const currentSlot = getCurrentHourSlot();
    const workingHours = getWorkingHours();

    const teamLeads = await prisma.teamLead.findMany({
      include: { user: true, dsas: { where: { status: 'ACTIVE' } } },
    });

    let nationalTotal = 0;
    let nationalTarget = 0;
    const zoneMap = new Map<string, { activations: number; target: number; teams: number }>();

    const tlData = await Promise.all(
      teamLeads.map(async (tl) => {
        const acts = await prisma.activation.findMany({
          where: { teamLeadId: tl.id, date: today },
        });
        const tlTotal = acts.reduce((sum, a) => sum + a.count, 0);
        nationalTotal += tlTotal;
        nationalTarget += tl.allocatedTarget;

        const zone = tl.zone || 'Unknown';
        const existing = zoneMap.get(zone) || { activations: 0, target: 0, teams: 0 };
        zoneMap.set(zone, {
          activations: existing.activations + tlTotal,
          target: existing.target + tl.allocatedTarget,
          teams: existing.teams + 1,
        });

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

        return {
          id: tl.id,
          name: tl.user.name,
          zone: tl.zone,
          activations: tlTotal,
          attainment: Math.round(kpis.teamTargetAttainment),
          runRate: kpis.runRateForecast,
        };
      })
    );

    const nationalAttainment =
      nationalTarget > 0 ? Math.round((nationalTotal / nationalTarget) * 100) : 0;

    const zoneRankings = Array.from(zoneMap.entries())
      .map(([zone, data]) => ({
        zone,
        activations: data.activations,
        target: data.target,
        teams: data.teams,
        attainment: Math.round((data.activations / data.target) * 100),
      }))
      .sort((a, b) => b.attainment - a.attainment);

    const leaderboard = [...tlData].sort((a, b) => b.activations - a.activations);
    const underperformers = tlData.filter((t) => t.attainment < 50);

    res.json({
      success: true,
      data: {
        national: {
          totalActivations: nationalTotal,
          totalTarget: nationalTarget,
          attainment: nationalAttainment,
          totalTeams: teamLeads.length,
        },
        zoneRankings,
        leaderboard,
        underperformers,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// GET /api/v1/hsd/leaderboard
router.get('/leaderboard', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const teamLeads = await prisma.teamLead.findMany({
      include: { user: true },
    });

    const ranked = await Promise.all(
      teamLeads.map(async (tl) => {
        const total = await prisma.activation.aggregate({
          where: { teamLeadId: tl.id, date: today },
          _sum: { count: true },
        });
        const activations = total._sum.count || 0;
        const attainment = Math.round((activations / tl.allocatedTarget) * 100);
        return { id: tl.id, name: tl.user.name, zone: tl.zone, activations, attainment };
      })
    );

    ranked.sort((a, b) => b.activations - a.activations);
    res.json({ success: true, data: ranked });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// GET /api/v1/hsd/export?format=xlsx
router.get('/export', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const teamLeads = await prisma.teamLead.findMany({
      include: { user: true, dsas: true },
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('TL Performance');

    sheet.columns = [
      { header: 'Team Lead', key: 'name', width: 20 },
      { header: 'Zone', key: 'zone', width: 15 },
      { header: 'Region', key: 'region', width: 15 },
      { header: 'DSAs', key: 'dsas', width: 8 },
      { header: 'Activations', key: 'activations', width: 12 },
      { header: 'Target', key: 'target', width: 8 },
      { header: 'Attainment %', key: 'attainment', width: 14 },
    ];

    for (const tl of teamLeads) {
      const total = await prisma.activation.aggregate({
        where: { teamLeadId: tl.id, date: today },
        _sum: { count: true },
      });
      const activations = total._sum.count || 0;
      sheet.addRow({
        name: tl.user.name,
        zone: tl.zone || '',
        region: tl.region || '',
        dsas: tl.dsas.length,
        activations,
        target: tl.allocatedTarget,
        attainment: Math.round((activations / tl.allocatedTarget) * 100),
      });
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=tl-performance-${today}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

export { router as hsdRouter };
