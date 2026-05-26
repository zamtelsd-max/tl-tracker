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

// ── GET /api/v1/admin/export — National Excel export (Admin/HSD) ─────────────
import ExcelJS from 'exceljs';
router.get('/export', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const mtdStart = today.substring(0, 7) + '-01';

    const teamLeads = await prisma.teamLead.findMany({
      include: { user: true, ase: true, dsas: { where: { status: 'ACTIVE' } } },
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Zamtel TL Tracker';
    workbook.created = new Date();

    // Sheet 1: National TL Performance
    const s1 = workbook.addWorksheet('All TL Performance');
    s1.columns = [
      { header: 'Team Lead', key: 'name', width: 22 },
      { header: 'Staff ID', key: 'staffId', width: 12 },
      { header: 'Zone', key: 'zone', width: 15 },
      { header: 'Region', key: 'region', width: 15 },
      { header: 'ASE', key: 'ase', width: 18 },
      { header: 'Active DSAs', key: 'dsas', width: 12 },
      { header: 'Today', key: 'today', width: 10 },
      { header: 'MTD Activations', key: 'mtd', width: 18 },
      { header: 'MTD Target', key: 'target', width: 12 },
      { header: 'Attainment %', key: 'attainment', width: 14 },
    ];
    s1.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    s1.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE4007C' } };

    for (const tl of teamLeads) {
      const mtdAgg = await prisma.activation.aggregate({ where: { teamLeadId: tl.id, date: { gte: mtdStart, lte: today } }, _sum: { count: true } });
      const todayAgg = await prisma.activation.aggregate({ where: { teamLeadId: tl.id, date: today }, _sum: { count: true } });
      const mtd = mtdAgg._sum.count || 0;
      const tgt = tl.allocatedTarget * new Date().getDate();
      const att = tgt > 0 ? Math.round((mtd / tgt) * 100) : 0;
      const row = s1.addRow({ name: tl.user.name, staffId: tl.user.staffId, zone: tl.zone || '', region: tl.region || '', ase: tl.ase?.name || 'UNASSIGNED', dsas: tl.dsas.length, today: todayAgg._sum.count || 0, mtd, target: tgt, attainment: att });
      if (att < 50) row.font = { color: { argb: 'FFCC0000' } };
    }

    // Sheet 2: Zone Summary
    const s2 = workbook.addWorksheet('Zone Summary');
    s2.columns = [
      { header: 'Zone', key: 'zone', width: 18 },
      { header: 'Total TLs', key: 'tls', width: 10 },
      { header: 'Total DSAs', key: 'dsas', width: 10 },
      { header: 'MTD Activations', key: 'mtd', width: 18 },
      { header: 'MTD Target', key: 'target', width: 12 },
      { header: 'Attainment %', key: 'attainment', width: 14 },
    ];
    s2.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    s2.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE4007C' } };

    const zoneMap = new Map<string, { tls: number; dsas: number; mtd: number; target: number }>();
    for (const tl of teamLeads) {
      const z = tl.zone || 'Unknown';
      const e = zoneMap.get(z) || { tls: 0, dsas: 0, mtd: 0, target: 0 };
      const mtdAgg = await prisma.activation.aggregate({ where: { teamLeadId: tl.id, date: { gte: mtdStart, lte: today } }, _sum: { count: true } });
      e.tls++; e.dsas += tl.dsas.length; e.mtd += mtdAgg._sum.count || 0; e.target += tl.allocatedTarget * new Date().getDate();
      zoneMap.set(z, e);
    }
    for (const [zone, d] of Array.from(zoneMap.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
      const att = d.target > 0 ? Math.round((d.mtd / d.target) * 100) : 0;
      s2.addRow({ zone, tls: d.tls, dsas: d.dsas, mtd: d.mtd, target: d.target, attainment: att });
    }

    // Sheet 3: All Users
    const s3 = workbook.addWorksheet('All Users');
    s3.columns = [
      { header: 'Name', key: 'name', width: 22 },
      { header: 'Staff ID', key: 'staffId', width: 12 },
      { header: 'Role', key: 'role', width: 10 },
      { header: 'Zone', key: 'zone', width: 15 },
      { header: 'Active', key: 'active', width: 8 },
    ];
    s3.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    s3.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE4007C' } };
    const allUsers = await prisma.user.findMany({ orderBy: [{ role: 'asc' }, { name: 'asc' }] });
    for (const u of allUsers) {
      s3.addRow({ name: u.name, staffId: u.staffId, role: u.role, zone: u.zone || '', active: u.active ? 'Yes' : 'No' });
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=National-Report-${today}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});
