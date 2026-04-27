"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.hsdRouter = void 0;
const express_1 = require("express");
const prisma_1 = __importDefault(require("../lib/prisma"));
const auth_1 = require("../middleware/auth");
const kpi_1 = require("../services/kpi");
const exceljs_1 = __importDefault(require("exceljs"));
const router = (0, express_1.Router)();
exports.hsdRouter = router;
router.use(auth_1.authenticate);
router.use((0, auth_1.requireRole)('HSD', 'ADMIN'));
// GET /api/v1/hsd/dashboard
router.get('/dashboard', async (_req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const currentSlot = (0, kpi_1.getCurrentHourSlot)();
        const workingHours = (0, kpi_1.getWorkingHours)();
        const teamLeads = await prisma_1.default.teamLead.findMany({
            include: { user: true, dsas: { where: { status: 'ACTIVE' } } },
        });
        let nationalTotal = 0;
        let nationalTarget = 0;
        const zoneMap = new Map();
        const tlData = await Promise.all(teamLeads.map(async (tl) => {
            const acts = await prisma_1.default.activation.findMany({
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
            const kpis = (0, kpi_1.calculateKPIs)({
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
        }));
        const nationalAttainment = nationalTarget > 0 ? Math.round((nationalTotal / nationalTarget) * 100) : 0;
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
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});
// GET /api/v1/hsd/leaderboard?scope=national|zone&zone=Lusaka&level=tl|ase|zbm
router.get('/leaderboard', async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const level = req.query.level || 'tl'; // tl | ase | zbm
        const scope = req.query.scope || 'national';
        const filterZone = req.query.zone;
        if (level === 'tl') {
            const where = filterZone ? { zone: filterZone } : {};
            const teamLeads = await prisma_1.default.teamLead.findMany({
                where,
                include: { user: true, dsas: { where: { status: 'ACTIVE' } }, ase: true },
            });
            const ranked = await Promise.all(teamLeads.map(async (tl) => {
                const agg = await prisma_1.default.activation.aggregate({
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
            }));
            ranked.sort((a, b) => b.activations - a.activations || b.attainment - a.attainment);
            res.json({ success: true, data: { level: 'tl', scope, entries: ranked } });
        }
        else if (level === 'ase') {
            // Aggregate by ASE user
            const ases = await prisma_1.default.user.findMany({
                where: { role: 'ASE', active: true, ...(filterZone ? { zone: filterZone } : {}) },
                include: { teamLeads: { include: { dsas: { where: { status: 'ACTIVE' } } } } },
            });
            const ranked = await Promise.all(ases.map(async (ase) => {
                let activations = 0;
                let target = 0;
                let dsaCount = 0;
                for (const tl of ase.teamLeads) {
                    const agg = await prisma_1.default.activation.aggregate({
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
            }));
            ranked.sort((a, b) => b.activations - a.activations || b.attainment - a.attainment);
            res.json({ success: true, data: { level: 'ase', scope, entries: ranked } });
        }
        else if (level === 'zbm') {
            // Aggregate by zone
            const zbms = await prisma_1.default.user.findMany({
                where: { role: 'ZBM', active: true },
            });
            const ranked = await Promise.all(zbms.map(async (zbm) => {
                const zone = zbm.zone;
                const tls = await prisma_1.default.teamLead.findMany({
                    where: zone ? { zone } : {},
                    include: { dsas: { where: { status: 'ACTIVE' } } },
                });
                let activations = 0;
                let target = 0;
                let dsaCount = 0;
                for (const tl of tls) {
                    const agg = await prisma_1.default.activation.aggregate({
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
            }));
            ranked.sort((a, b) => b.activations - a.activations || b.attainment - a.attainment);
            res.json({ success: true, data: { level: 'zbm', scope, entries: ranked } });
        }
        else {
            res.status(400).json({ success: false, error: 'Invalid level. Use tl, ase, or zbm' });
        }
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});
// GET /api/v1/hsd/export?format=xlsx
router.get('/export', async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const teamLeads = await prisma_1.default.teamLead.findMany({
            include: { user: true, dsas: true },
        });
        const workbook = new exceljs_1.default.Workbook();
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
            const total = await prisma_1.default.activation.aggregate({
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
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});
//# sourceMappingURL=hsd.js.map