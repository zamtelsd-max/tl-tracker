import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { calculateKPIs, getCurrentHourSlot, getWorkingHours } from '../services/kpi';
import ExcelJS from 'exceljs';
import bcrypt from 'bcryptjs';

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

// GET /api/v1/hsd/leaderboard?scope=national|zone&zone=Lusaka&level=tl|ase|zbm
router.get('/leaderboard', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const level = (req.query.level as string) || 'tl';   // tl | ase | zbm
    const scope = (req.query.scope as string) || 'national';
    const filterZone = req.query.zone as string | undefined;

    if (level === 'tl') {
      const where = filterZone ? { zone: filterZone } : {};
      const teamLeads = await prisma.teamLead.findMany({
        where,
        include: { user: true, dsas: { where: { status: 'ACTIVE' } }, ase: true },
      });

      const ranked = await Promise.all(
        teamLeads.map(async (tl) => {
          const agg = await prisma.activation.aggregate({
            where: { teamLeadId: tl.id, date: today },
            _sum: { count: true },
          });
          const activations = agg._sum.count || 0;
          const attainment = tl.allocatedTarget > 0
            ? Math.round((activations / tl.allocatedTarget) * 100) : 0;
          return {
            id: tl.id,
            name: tl.user.name,
            staffId: tl.user.staffId,
            zone: tl.zone ?? 'Unknown',
            region: tl.region ?? '',
            aseName: tl.ase?.name ?? null,
            dsaCount: tl.dsas.length,
            activations,
            target: tl.allocatedTarget,
            attainment,
          };
        })
      );
      ranked.sort((a, b) => b.activations - a.activations || b.attainment - a.attainment);
      res.json({ success: true, data: { level: 'tl', scope, entries: ranked } });

    } else if (level === 'ase') {
      // Aggregate by ASE user
      const ases = await prisma.user.findMany({
        where: { role: 'ASE', active: true, ...(filterZone ? { zone: filterZone } : {}) },
        include: { teamLeads: { include: { dsas: { where: { status: 'ACTIVE' } } } } },
      });

      const ranked = await Promise.all(
        ases.map(async (ase) => {
          let activations = 0;
          let target = 0;
          let dsaCount = 0;
          for (const tl of ase.teamLeads) {
            const agg = await prisma.activation.aggregate({
              where: { teamLeadId: tl.id, date: today },
              _sum: { count: true },
            });
            activations += agg._sum.count || 0;
            target += tl.allocatedTarget;
            dsaCount += tl.dsas.length;
          }
          const attainment = target > 0 ? Math.round((activations / target) * 100) : 0;
          return {
            id: ase.id,
            name: ase.name,
            staffId: ase.staffId,
            zone: ase.zone ?? 'Unknown',
            region: ase.region ?? '',
            tlCount: ase.teamLeads.length,
            dsaCount,
            activations,
            target,
            attainment,
          };
        })
      );
      ranked.sort((a, b) => b.activations - a.activations || b.attainment - a.attainment);
      res.json({ success: true, data: { level: 'ase', scope, entries: ranked } });

    } else if (level === 'zbm') {
      // Aggregate by zone
      const zbms = await prisma.user.findMany({
        where: { role: 'ZBM', active: true },
      });

      const ranked = await Promise.all(
        zbms.map(async (zbm) => {
          const zone = zbm.zone;
          const tls = await prisma.teamLead.findMany({
            where: zone ? { zone } : {},
            include: { dsas: { where: { status: 'ACTIVE' } } },
          });
          let activations = 0;
          let target = 0;
          let dsaCount = 0;
          for (const tl of tls) {
            const agg = await prisma.activation.aggregate({
              where: { teamLeadId: tl.id, date: today },
              _sum: { count: true },
            });
            activations += agg._sum.count || 0;
            target += tl.allocatedTarget;
            dsaCount += tl.dsas.length;
          }
          const attainment = target > 0 ? Math.round((activations / target) * 100) : 0;
          return {
            id: zbm.id,
            name: zbm.name,
            staffId: zbm.staffId,
            zone: zone ?? 'Unknown',
            tlCount: tls.length,
            dsaCount,
            activations,
            target,
            attainment,
          };
        })
      );
      ranked.sort((a, b) => b.activations - a.activations || b.attainment - a.attainment);
      res.json({ success: true, data: { level: 'zbm', scope, entries: ranked } });

    } else {
      res.status(400).json({ success: false, error: 'Invalid level. Use tl, ase, or zbm' });
    }
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

// GET /api/v1/hsd/mtd
router.get('/mtd', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const monthStart = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const today = now.toISOString().split('T')[0];
    const lastDay = new Date(year, month + 1, 0);
    const monthEnd = lastDay.toISOString().split('T')[0];
    const workingDaysTotal = countWorkingDays(monthStart, monthEnd);

    const tls = await prisma.teamLead.findMany({
      where: {},
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

// ── GET /api/v1/hsd/escalation-summary ─────────────────────────────────────
// Returns per-zone summary of non-compliant ASEs and TLs for the current MTD
router.get('/escalation-summary', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const today = now.toISOString().split('T')[0];

    // Get all TLs with their ASE info and MTD activations
    const teamLeads = await prisma.teamLead.findMany({
      include: {
        user: true,
        ase: true,
      },
    });

    const tlIds = teamLeads.map((tl) => tl.id);
    const activationRows = await prisma.activation.groupBy({
      by: ['teamLeadId'],
      _sum: { count: true },
      where: { teamLeadId: { in: tlIds }, date: { gte: monthStart, lte: today } },
    });
    const actMap = new Map(activationRows.map((r) => [r.teamLeadId, r._sum.count ?? 0]));

    // Yesterday activations
    const yday = new Date(now);
    yday.setDate(yday.getDate() - 1);
    const ydayStr = yday.toISOString().split('T')[0];
    const ydayRows = await prisma.activation.groupBy({
      by: ['teamLeadId'],
      _sum: { count: true },
      where: { teamLeadId: { in: tlIds }, date: ydayStr },
    });
    const ydayMap = new Map(ydayRows.map((r) => [r.teamLeadId, r._sum.count ?? 0]));

    interface TLSummary {
      tlName: string; tlStaffId: string; mtd: number; target: number;
      attain: number; noYday: boolean; aseName: string; aseStaffId: string;
    }
    interface ZoneSummary {
      zone: string; failingTLs: number; zeroTLs: number; failingASEs: Set<string>;
      tls: TLSummary[]; aseSet: Map<string, { name: string; staffId: string; attain: number; tlCount: number; failingTlCount: number }>;
    }

    const zoneMap = new Map<string, ZoneSummary>();

    for (const tl of teamLeads) {
      const zone = tl.zone || 'Unknown';
      const mtd = actMap.get(tl.id) ?? 0;
      const ydayActs = ydayMap.get(tl.id) ?? 0;
      const target = tl.allocatedTarget * (now.getDate()); // rough MTD target
      const attain = target > 0 ? Math.round((mtd / target) * 100) : 0;
      const failing = attain < 50;
      const zero = mtd === 0;
      const noYday = ydayActs === 0;

      if (!zoneMap.has(zone)) {
        zoneMap.set(zone, { zone, failingTLs: 0, zeroTLs: 0, failingASEs: new Set(), tls: [], aseSet: new Map() });
      }
      const zs = zoneMap.get(zone)!;
      if (failing) zs.failingTLs++;
      if (zero) zs.zeroTLs++;

      const aseName = tl.ase?.name || 'UNASSIGNED';
      const aseStaffId = tl.ase?.staffId || 'UNASSIGNED';

      if (failing) zs.failingASEs.add(aseStaffId);

      const existing = zs.aseSet.get(aseStaffId) || { name: aseName, staffId: aseStaffId, attain: 0, tlCount: 0, failingTlCount: 0 };
      existing.tlCount++;
      if (failing) existing.failingTlCount++;
      existing.attain = existing.tlCount > 0 ? Math.round((existing.attain * (existing.tlCount - 1) + attain) / existing.tlCount) : attain;
      zs.aseSet.set(aseStaffId, existing);

      if (failing) {
        zs.tls.push({ tlName: tl.user.name, tlStaffId: tl.user.staffId, mtd, target, attain, noYday, aseName, aseStaffId });
      }
    }

    const summary = Array.from(zoneMap.values()).map((zs) => ({
      zone: zs.zone,
      failingTLs: zs.failingTLs,
      zeroTLs: zs.zeroTLs,
      failingASECount: zs.failingASEs.size,
      ases: Array.from(zs.aseSet.values()).filter((a) => a.failingTlCount > 0).sort((a, b) => a.attain - b.attain),
      tls: zs.tls.sort((a, b) => a.attain - b.attain).slice(0, 20),
    })).sort((a, b) => b.failingTLs - a.failingTLs);

    res.json({ success: true, data: { summary, generatedAt: new Date().toISOString() } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

export { router as hsdRouter };

// ── PATCH /api/v1/hsd/teamleads/:id — edit any TL (HSD national) ───────────
router.patch('/teamleads/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const tl = await prisma.teamLead.findUnique({ where: { id }, include: { user: true } });
    if (!tl) { res.status(404).json({ success: false, error: 'Team lead not found' }); return; }

    const { name, zone, region, territory, allocatedTarget, pin } = req.body as {
      name?: string; zone?: string; region?: string; territory?: string;
      allocatedTarget?: number; pin?: string;
    };

    const userUpdate: Record<string, unknown> = {};
    if (name !== undefined)      userUpdate.name      = name.trim();
    if (zone !== undefined)      userUpdate.zone      = zone.trim() || null;
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
    if (zone !== undefined)            tlUpdate.zone            = zone.trim() || null;
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

// ── DELETE /api/v1/hsd/teamleads/:id — unlink TL from ASE (HSD) ─────────────
router.delete('/teamleads/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const tl = await prisma.teamLead.findUnique({ where: { id } });
    if (!tl) { res.status(404).json({ success: false, error: 'Team lead not found' }); return; }
    await prisma.teamLead.update({ where: { id }, data: { aseId: null } });
    res.json({ success: true, data: { message: 'Team lead unlinked' } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// ── GET /api/v1/hsd/teamleads/:id/performance ───────────────────────────────
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
