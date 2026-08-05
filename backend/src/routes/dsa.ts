import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma';
import { AuthRequest, authenticate, requireRole } from '../middleware/auth';

const router = Router();

function ymd(d = new Date()) { const t = new Date(d.getTime() + 2 * 3600 * 1000); return t.toISOString().slice(0, 10); }
function hourSlot(d = new Date()): string { const t = new Date(d.getTime() + 2 * 3600 * 1000); return `${String(t.getUTCHours()).padStart(2, '0')}:00`; }
function haversine(la1: number, lo1: number, la2: number, lo2: number): number {
  const R = 6371000, rad = (x: number) => x * Math.PI / 180;
  const dLa = rad(la2 - la1), dLo = rad(lo2 - lo1);
  const a = Math.sin(dLa / 2) ** 2 + Math.cos(rad(la1)) * Math.cos(rad(la2)) * Math.sin(dLo / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
const APPROVE_RADIUS_M = 10;

router.use(authenticate);

// GET /dsa/me
router.get('/me', requireRole('DSA'), async (req: AuthRequest, res: Response): Promise<void> => {
  const dsaId = req.user!.dsaId!; const date = ymd();
  const dsa = await prisma.dSA.findUnique({ where: { id: dsaId }, include: { teamLead: { include: { user: true } } } });
  if (!dsa) { res.status(404).json({ success: false, error: 'Not found' }); return; }
  const acts = await prisma.activation.findMany({ where: { dsaId, date } });
  const todayCount = acts.reduce((s, a) => s + a.count, 0);
  const mtdStart = date.slice(0, 8) + '01';
  const mtdActs = await prisma.activation.findMany({ where: { dsaId, date: { gte: mtdStart } } });
  const mtd = mtdActs.reduce((s, a) => s + a.count, 0);
  const att = await prisma.attendance.findUnique({ where: { dsaId_date: { dsaId, date } } });
  res.json({ success: true, data: { id: dsa.id, name: dsa.name, staffId: dsa.staffId, mustChangePin: dsa.mustChangePin, teamLead: dsa.teamLead?.user?.name, zone: dsa.teamLead?.zone, todayCount, mtd, attendance: att } });
});

router.post('/change-pin', requireRole('DSA'), async (req: AuthRequest, res: Response): Promise<void> => {
  const { pin } = req.body || {};
  if (!pin || String(pin).length !== 4) { res.status(400).json({ success: false, error: 'PIN must be 4 digits' }); return; }
  await prisma.dSA.update({ where: { id: req.user!.dsaId! }, data: { pinHash: await bcrypt.hash(String(pin), 10), mustChangePin: false } });
  res.json({ success: true });
});

router.post('/clock-in', requireRole('DSA'), async (req: AuthRequest, res: Response): Promise<void> => {
  const { latitude, longitude, locationOk } = req.body || {};
  const dsaId = req.user!.dsaId!, teamLeadId = req.user!.teamLeadId!;
  const now = new Date(); const date = ymd(now);
  const lt = new Date(now.getTime() + 2 * 3600 * 1000);
  const onTime = lt.getUTCHours() < 7 || (lt.getUTCHours() === 7 && lt.getUTCMinutes() <= 30);
  const a = await prisma.attendance.upsert({
    where: { dsaId_date: { dsaId, date } },
    update: { clockInAt: now, onTime, latitude, longitude, locationOk: locationOk !== false, worked: true },
    create: { dsaId, teamLeadId, date, clockInAt: now, onTime, latitude, longitude, locationOk: locationOk !== false, worked: true },
  });
  res.status(201).json({ success: true, data: a, onTime });
});

router.post('/add-customer', requireRole('DSA'), async (req: AuthRequest, res: Response): Promise<void> => {
  const { customerName, msisdn, walletActivated, amountRecharged, latitude, longitude } = req.body || {};
  if (!msisdn) { res.status(400).json({ success: false, error: 'Customer MSISDN is required' }); return; }
  const dsaId = req.user!.dsaId!, teamLeadId = req.user!.teamLeadId!;
  const now = new Date(); const date = ymd(now); const slot = hourSlot(now);
  try {
    const dup = await prisma.registeredNumber.findFirst({ where: { msisdn, date } });
    const activation = await prisma.activation.create({ data: { teamLeadId, dsaId, customerName: customerName || null, count: 1, registeredCount: 1, hourSlot: slot, date, latitude: latitude ?? null, longitude: longitude ?? null } });
    await prisma.grossAdd.create({ data: { teamLeadId, dsaId, msisdn, walletActivated: !!walletActivated, amountRecharged: amountRecharged != null ? Number(amountRecharged) : null, hourSlot: slot, date, latitude: latitude ?? null, longitude: longitude ?? null } }).catch(() => {});
    if (!dup) await prisma.registeredNumber.create({ data: { teamLeadId, dsaId, msisdn, date } }).catch(() => {});
    const att = await prisma.attendance.findUnique({ where: { dsaId_date: { dsaId, date } } });
    if (att && !att.firstCustomerAt) {
      const mins = att.clockInAt ? Math.round((now.getTime() - new Date(att.clockInAt).getTime()) / 60000) : null;
      await prisma.attendance.update({ where: { id: att.id }, data: { firstCustomerAt: now, timeToFirstMin: mins } });
    }
    res.status(201).json({ success: true, data: activation, duplicate: !!dup });
  } catch (err) { console.error(err); res.status(500).json({ success: false, error: 'Server error' }); }
});

router.get('/my-customers', requireRole('DSA'), async (req: AuthRequest, res: Response): Promise<void> => {
  const dsaId = req.user!.dsaId!; const date = (req.query.date as string) || ymd();
  const list = await prisma.grossAdd.findMany({ where: { dsaId, date }, orderBy: { createdAt: 'desc' } });
  res.json({ success: true, data: list });
});

router.post('/create-account', requireRole('TL', 'ASE', 'ADMIN'), async (req: AuthRequest, res: Response): Promise<void> => {
  const { dsaId } = req.body || {};
  const dsa = await prisma.dSA.findUnique({ where: { id: dsaId } });
  if (!dsa) { res.status(404).json({ success: false, error: 'DSA not found' }); return; }
  if (req.user!.role === 'TL' && dsa.teamLeadId !== req.user!.teamLeadId) { res.status(403).json({ success: false, error: 'Not your DSA' }); return; }
  const staffId = dsa.staffId || `DSA-${dsa.id.slice(-6).toUpperCase()}`;
  await prisma.dSA.update({ where: { id: dsa.id }, data: { staffId, pinHash: await bcrypt.hash('1234', 10), mustChangePin: true } });
  res.json({ success: true, data: { staffId, defaultPin: '1234' } });
});

router.post('/create-accounts-bulk', requireRole('TL', 'ASE', 'ADMIN'), async (req: AuthRequest, res: Response): Promise<void> => {
  const where: any = { staffId: null };
  if (req.user!.role === 'TL') where.teamLeadId = req.user!.teamLeadId;
  const dsas = await prisma.dSA.findMany({ where });
  const hash = await bcrypt.hash('1234', 10);
  let created = 0;
  for (const d of dsas) { await prisma.dSA.update({ where: { id: d.id }, data: { staffId: `DSA-${d.id.slice(-6).toUpperCase()}`, pinHash: hash, mustChangePin: true } }).catch(() => {}); created++; }
  res.json({ success: true, created, defaultPin: '1234' });
});

router.get('/attendance/pending', requireRole('TL', 'ASE', 'ADMIN'), async (req: AuthRequest, res: Response): Promise<void> => {
  const date = ymd(); const where: any = { date };
  if (req.user!.role === 'TL') where.teamLeadId = req.user!.teamLeadId;
  const rows = await prisma.attendance.findMany({ where, orderBy: { clockInAt: 'asc' } });
  const ids = [...new Set(rows.map(r => r.dsaId))];
  const dsas = await prisma.dSA.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, staffId: true } });
  const map = Object.fromEntries(dsas.map(d => [d.id, d]));
  res.json({ success: true, date, data: rows.map(r => ({ ...r, dsa: map[r.dsaId] })) });
});

router.patch('/attendance/:id/approve', requireRole('TL', 'ASE', 'ADMIN'), async (req: AuthRequest, res: Response): Promise<void> => {
  const approved = req.body?.approved !== false;
  const { latitude, longitude } = req.body || {};
  const att = await prisma.attendance.findUnique({ where: { id: req.params.id } });
  if (!att) { res.status(404).json({ success: false, error: 'Not found' }); return; }
  if (req.user!.role === 'TL' && att.teamLeadId !== req.user!.teamLeadId) { res.status(403).json({ success: false, error: 'Not your DSA' }); return; }
  if (approved) {
    if (latitude == null || longitude == null) { res.status(400).json({ success: false, error: 'Location required — you must be at the gate meeting to approve.' }); return; }
    if (att.latitude == null || att.longitude == null) { res.status(422).json({ success: false, error: 'DSA has no clock-in GPS — cannot verify proximity.' }); return; }
    const dist = Math.round(haversine(att.latitude, att.longitude, Number(latitude), Number(longitude)));
    if (dist > APPROVE_RADIUS_M) { res.status(422).json({ success: false, error: `You are ${dist}m from the DSA — must be within ${APPROVE_RADIUS_M}m to approve.`, distanceM: dist }); return; }
  }
  const a = await prisma.attendance.update({ where: { id: att.id }, data: { approved, approvedBy: req.user!.userId, approvedAt: new Date() } });
  res.json({ success: true, data: a });
});

router.get('/attendance/report', requireRole('TL', 'ASE', 'ZBM', 'HSD', 'ADMIN'), async (req: AuthRequest, res: Response): Promise<void> => {
  const to = (req.query.to as string) || ymd();
  const from = (req.query.from as string) || (to.slice(0, 8) + '01');
  const where: any = { date: { gte: from, lte: to } };
  if (req.user!.role === 'TL') where.teamLeadId = req.user!.teamLeadId;
  const rows = await prisma.attendance.findMany({ where, orderBy: { date: 'desc' }, take: 1000 });
  const ids = [...new Set(rows.map(r => r.dsaId))];
  const dsas = await prisma.dSA.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, staffId: true } });
  const map: Record<string, any> = Object.fromEntries(dsas.map(d => [d.id, d]));
  res.json({ success: true, from, to, data: rows.map(r => { const d: any = map[r.dsaId] || {}; return {
    date: r.date, staffId: d.staffId, name: d.name,
    clockIn: r.clockInAt ? new Date(r.clockInAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lusaka' }) : '—',
    onTime: r.onTime ? 'Yes' : 'No', locationOk: r.locationOk ? 'Yes' : 'No',
    firstCustomer: r.firstCustomerAt ? new Date(r.firstCustomerAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lusaka' }) : '—',
    timeToFirstMin: r.timeToFirstMin ?? '—', approved: r.approved ? 'Approved' : 'Pending' }; }) });
});

router.get('/attendance/report.xlsx', requireRole('TL', 'ASE', 'ZBM', 'HSD', 'ADMIN'), async (req: AuthRequest, res: Response): Promise<void> => {
  const to = (req.query.to as string) || ymd();
  const from = (req.query.from as string) || (to.slice(0, 8) + '01');
  const where: any = { date: { gte: from, lte: to } };
  if (req.user!.role === 'TL') where.teamLeadId = req.user!.teamLeadId;
  const rows = await prisma.attendance.findMany({ where, orderBy: { date: 'desc' }, take: 2000 });
  const ids = [...new Set(rows.map(r => r.dsaId))];
  const dsas = await prisma.dSA.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, staffId: true } });
  const map: Record<string, any> = Object.fromEntries(dsas.map(d => [d.id, d]));
  const ExcelJS = require('exceljs');
  const wb = new ExcelJS.Workbook(); wb.creator = 'Zamtel TL Tracker';
  const ws = wb.addWorksheet('Gate Attendance');
  ws.mergeCells('A1:H1'); ws.getCell('A1').value = `Gate Meeting Attendance — ${from} to ${to}`;
  ws.getCell('A1').font = { bold: true, size: 14, color: { argb: 'FF00843D' } };
  ws.addRow([]);
  const hr = ws.addRow(['Date', 'User ID', 'DSA Name', 'Clock-In', 'On Time', 'Location OK', 'First Customer', 'Approval']);
  hr.eachCell((c: any) => { c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00843D' } }; c.alignment = { horizontal: 'center' }; });
  rows.forEach(r => { const d: any = map[r.dsaId] || {}; ws.addRow([r.date, d.staffId || '', d.name || '', r.clockInAt ? new Date(r.clockInAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lusaka' }) : '—', r.onTime ? 'Yes' : 'No', r.locationOk ? 'Yes' : 'No', r.firstCustomerAt ? new Date(r.firstCustomerAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lusaka' }) : '—', r.approved ? 'Approved' : 'Pending']); });
  ws.columns.forEach((c: any) => { c.width = 15; }); ws.getColumn(3).width = 22;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="dsa-attendance-${from}_${to}.xlsx"`);
  await wb.xlsx.write(res); res.end();
});

export { router as dsaRouter };
