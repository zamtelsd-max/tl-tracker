"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.zbmRouter = void 0;
const express_1 = require("express");
const prisma_1 = __importDefault(require("../lib/prisma"));
const auth_1 = require("../middleware/auth");
const kpi_1 = require("../services/kpi");
const express_validator_1 = require("express-validator");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const router = (0, express_1.Router)();
exports.zbmRouter = router;
router.use(auth_1.authenticate);
router.use((0, auth_1.requireRole)('ZBM', 'ADMIN'));
// GET /api/v1/zbm/dashboard
router.get('/dashboard', async (req, res) => {
    try {
        const { userId } = req.user;
        const today = new Date().toISOString().split('T')[0];
        const zbmUser = await prisma_1.default.user.findUnique({ where: { id: userId } });
        const zone = zbmUser?.zone;
        const teamLeads = await prisma_1.default.teamLead.findMany({
            where: zone ? { zone } : {},
            include: { user: true, dsas: { where: { status: 'ACTIVE' } } },
        });
        const currentSlot = (0, kpi_1.getCurrentHourSlot)();
        let totalActivations = 0;
        let totalTargets = 0;
        let teamsBelow = 0;
        const workingHours = (0, kpi_1.getWorkingHours)();
        const tlData = await Promise.all(teamLeads.map(async (tl) => {
            const acts = await prisma_1.default.activation.findMany({
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
            const kpis = (0, kpi_1.calculateKPIs)({
                totalActivations: tlTotal,
                dsaCount: tl.dsas.length,
                activeDSAsToday: new Set(acts.map((a) => a.dsaId)).size,
                activationsThisHour: thisHourActs.reduce((sum, a) => sum + a.count, 0),
                activeDSAsThisHour: new Set(thisHourActs.map((a) => a.dsaId)).size,
                hourlyActivations,
                allocatedTarget: tl.allocatedTarget,
            });
            if (kpis.teamTargetAttainment < 50)
                teamsBelow++;
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
        }));
        const complianceRate = totalTargets > 0 ? Math.round((totalActivations / totalTargets) * 100) : 0;
        const avgRunRate = tlData.length > 0 ? tlData.reduce((s, t) => s + t.runRate, 0) / tlData.length : 0;
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
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});
// GET /api/v1/zbm/runrate
router.get('/runrate', async (req, res) => {
    try {
        const { userId } = req.user;
        const today = new Date().toISOString().split('T')[0];
        const zbmUser = await prisma_1.default.user.findUnique({ where: { id: userId } });
        const zone = zbmUser?.zone;
        const teamLeads = await prisma_1.default.teamLead.findMany({
            where: zone ? { zone } : {},
        });
        const currentSlot = (0, kpi_1.getCurrentHourSlot)();
        const workingHours = (0, kpi_1.getWorkingHours)();
        const rates = await Promise.all(teamLeads.map(async (tl) => {
            const acts = await prisma_1.default.activation.findMany({
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
            const kpis = (0, kpi_1.calculateKPIs)({
                totalActivations: tlTotal,
                dsaCount: 10,
                activeDSAsToday: new Set(acts.map((a) => a.dsaId)).size,
                activationsThisHour: thisHourActs.reduce((sum, a) => sum + a.count, 0),
                activeDSAsThisHour: new Set(thisHourActs.map((a) => a.dsaId)).size,
                hourlyActivations,
                allocatedTarget: tl.allocatedTarget,
            });
            return { id: tl.id, runRateForecast: kpis.runRateForecast, requiredRunRate: kpis.requiredRunRate };
        }));
        res.json({ success: true, data: rates });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});
// POST /api/v1/zbm/teamleads — create a new TL under a specified ASE (or unassigned)
router.post('/teamleads', [
    (0, express_validator_1.body)('staffId').notEmpty().withMessage('Staff ID required'),
    (0, express_validator_1.body)('name').notEmpty().withMessage('Name required'),
    (0, express_validator_1.body)('pin').isLength({ min: 4, max: 4 }).withMessage('PIN must be 4 digits'),
    (0, express_validator_1.body)('region').notEmpty().withMessage('Region required'),
], async (req, res) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ success: false, error: errors.array()[0].msg });
        return;
    }
    try {
        const { userId } = req.user;
        const zbmUser = await prisma_1.default.user.findUnique({ where: { id: userId } });
        const { staffId, name, pin, region, aseId, allocatedTarget } = req.body;
        const existing = await prisma_1.default.user.findUnique({ where: { staffId: staffId.toUpperCase() } });
        if (existing) {
            res.status(409).json({ success: false, error: 'Staff ID already exists' });
            return;
        }
        const pinHash = await bcryptjs_1.default.hash(pin, 10);
        const tlUser = await prisma_1.default.user.create({
            data: {
                staffId: staffId.toUpperCase(),
                pinHash,
                name,
                role: 'TL',
                zone: zbmUser?.zone ?? undefined,
                region,
            },
        });
        const tl = await prisma_1.default.teamLead.create({
            data: {
                userId: tlUser.id,
                aseId: aseId ?? null,
                zone: zbmUser?.zone ?? undefined,
                region,
                allocatedTarget: allocatedTarget ?? 50,
            },
        });
        res.status(201).json({ success: true, data: { user: tlUser, teamLead: tl } });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});
// GET /api/v1/zbm/leaderboard?level=tl|ase — scoped to this ZBM's zone
router.get('/leaderboard', async (req, res) => {
    try {
        const { userId } = req.user;
        const zbmUser = await prisma_1.default.user.findUnique({ where: { id: userId } });
        const zone = zbmUser?.zone;
        const level = req.query.level || 'tl';
        const today = new Date().toISOString().split('T')[0];
        if (level === 'tl') {
            const tls = await prisma_1.default.teamLead.findMany({
                where: zone ? { zone } : {},
                include: { user: true, dsas: { where: { status: 'ACTIVE' } }, ase: true },
            });
            const ranked = await Promise.all(tls.map(async (tl) => {
                const agg = await prisma_1.default.activation.aggregate({ where: { teamLeadId: tl.id, date: today }, _sum: { count: true } });
                const activations = agg._sum.count || 0;
                const attainment = tl.allocatedTarget > 0 ? Math.round((activations / tl.allocatedTarget) * 100) : 0;
                return { id: tl.id, name: tl.user.name, staffId: tl.user.staffId, zone: tl.zone ?? 'Unknown', region: tl.region ?? '', aseName: tl.ase?.name ?? null, dsaCount: tl.dsas.length, activations, target: tl.allocatedTarget, attainment };
            }));
            ranked.sort((a, b) => b.activations - a.activations || b.attainment - a.attainment);
            res.json({ success: true, data: { level: 'tl', entries: ranked } });
        }
        else if (level === 'ase') {
            const ases = await prisma_1.default.user.findMany({ where: { role: 'ASE', active: true, ...(zone ? { zone } : {}) }, include: { teamLeads: { include: { dsas: { where: { status: 'ACTIVE' } } } } } });
            const ranked = await Promise.all(ases.map(async (ase) => {
                let activations = 0, target = 0, dsaCount = 0;
                for (const tl of ase.teamLeads) {
                    const agg = await prisma_1.default.activation.aggregate({ where: { teamLeadId: tl.id, date: today }, _sum: { count: true } });
                    activations += agg._sum.count || 0;
                    target += tl.allocatedTarget;
                    dsaCount += tl.dsas.length;
                }
                const attainment = target > 0 ? Math.round((activations / target) * 100) : 0;
                return { id: ase.id, name: ase.name, staffId: ase.staffId, zone: ase.zone ?? 'Unknown', region: ase.region ?? '', tlCount: ase.teamLeads.length, dsaCount, activations, target, attainment };
            }));
            ranked.sort((a, b) => b.activations - a.activations || b.attainment - a.attainment);
            res.json({ success: true, data: { level: 'ase', entries: ranked } });
        }
        else {
            res.status(400).json({ success: false, error: 'Invalid level' });
        }
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});
// GET /api/v1/zbm/teamleads — list all TLs in this ZBM's zone
router.get('/teamleads', async (req, res) => {
    try {
        const { userId } = req.user;
        const zbmUser = await prisma_1.default.user.findUnique({ where: { id: userId } });
        const zone = zbmUser?.zone;
        const teamLeads = await prisma_1.default.teamLead.findMany({
            where: zone ? { zone } : {},
            include: { user: true, ase: true },
            orderBy: { createdAt: 'asc' },
        });
        res.json({ success: true, data: teamLeads });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});
// POST /api/v1/zbm/ases — create a new ASE under this ZBM's zone
router.post('/ases', [
    (0, express_validator_1.body)('staffId').notEmpty().withMessage('Staff ID required'),
    (0, express_validator_1.body)('name').notEmpty().withMessage('Name required'),
    (0, express_validator_1.body)('pin').isLength({ min: 4, max: 4 }).withMessage('PIN must be 4 digits'),
    (0, express_validator_1.body)('region').notEmpty().withMessage('Region required'),
], async (req, res) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ success: false, error: errors.array()[0].msg });
        return;
    }
    try {
        const { userId } = req.user;
        const zbmUser = await prisma_1.default.user.findUnique({ where: { id: userId } });
        const { staffId, name, pin, region } = req.body;
        const existing = await prisma_1.default.user.findUnique({ where: { staffId: staffId.toUpperCase() } });
        if (existing) {
            res.status(409).json({ success: false, error: 'Staff ID already exists' });
            return;
        }
        const pinHash = await bcryptjs_1.default.hash(pin, 10);
        const aseUser = await prisma_1.default.user.create({
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
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});
// GET /api/v1/zbm/ases — list ASEs in this ZBM's zone (for assigning TLs)
router.get('/ases', async (req, res) => {
    try {
        const { userId } = req.user;
        const zbmUser = await prisma_1.default.user.findUnique({ where: { id: userId } });
        const zone = zbmUser?.zone;
        const ases = await prisma_1.default.user.findMany({
            where: { role: 'ASE', active: true, ...(zone ? { zone } : {}) },
            select: { id: true, staffId: true, name: true, zone: true, region: true },
            orderBy: { name: 'asc' },
        });
        res.json({ success: true, data: ases });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});
//# sourceMappingURL=zbm.js.map