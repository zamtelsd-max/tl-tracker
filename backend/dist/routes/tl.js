"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.tlRouter = void 0;
const express_1 = require("express");
const prisma_1 = __importDefault(require("../lib/prisma"));
const auth_1 = require("../middleware/auth");
const kpi_1 = require("../services/kpi");
const express_validator_1 = require("express-validator");
const router = (0, express_1.Router)();
exports.tlRouter = router;
router.use(auth_1.authenticate);
// GET /api/v1/tl/dashboard
router.get('/dashboard', async (req, res) => {
    try {
        const { teamLeadId } = req.user;
        if (!teamLeadId) {
            res.status(403).json({ success: false, error: 'Not a team lead' });
            return;
        }
        const today = new Date().toISOString().split('T')[0];
        const tl = await prisma_1.default.teamLead.findUnique({
            where: { id: teamLeadId },
            include: { user: true, dsas: { where: { status: 'ACTIVE' } } },
        });
        if (!tl) {
            res.status(404).json({ success: false, error: 'Team lead not found' });
            return;
        }
        const todayActivations = await prisma_1.default.activation.findMany({
            where: { teamLeadId, date: today },
            include: { dsa: true },
        });
        const totalActivations = todayActivations.reduce((sum, a) => sum + a.count, 0);
        const dsaCount = tl.dsas.length;
        // Active DSAs today
        const activeDSAIds = new Set(todayActivations.map((a) => a.dsaId));
        const activeDSAsToday = activeDSAIds.size;
        // Current hour activations
        const currentSlot = (0, kpi_1.getCurrentHourSlot)();
        const thisHourActivations = todayActivations.filter((a) => a.hourSlot === currentSlot);
        const activationsThisHour = thisHourActivations.reduce((sum, a) => sum + a.count, 0);
        const activeDSAsThisHour = new Set(thisHourActivations.map((a) => a.dsaId)).size;
        // Hourly breakdown — include active DSA count per slot
        const workingHours = (0, kpi_1.getWorkingHours)();
        const hourlyActivations = workingHours.map((wh) => {
            const whNum = parseInt(wh);
            const slot = `${wh}:00-${String(whNum + 1).padStart(2, '0')}:00`;
            const slotActs = todayActivations.filter((a) => a.hourSlot === slot);
            const activeDSAsInSlot = new Set(slotActs.map((a) => a.dsaId)).size;
            return {
                slot,
                activations: slotActs.reduce((sum, a) => sum + a.count, 0),
                activeDSAs: activeDSAsInSlot,
                dsaTarget: dsaCount,
            };
        });
        const kpis = (0, kpi_1.calculateKPIs)({
            totalActivations,
            dsaCount,
            activeDSAsToday,
            activationsThisHour,
            activeDSAsThisHour,
            hourlyActivations,
            allocatedTarget: tl.allocatedTarget,
        });
        // DSA summary
        const dsaSummary = tl.dsas.map((dsa) => {
            const dsaActs = todayActivations.filter((a) => a.dsaId === dsa.id);
            const total = dsaActs.reduce((sum, a) => sum + a.count, 0);
            const thisHourDSAActs = dsaActs.filter((a) => a.hourSlot === currentSlot);
            const thisHour = thisHourDSAActs.reduce((sum, a) => sum + a.count, 0);
            const target = 5;
            const pct = (total / target) * 100;
            const status = pct >= 80 ? 'green' : pct >= 50 ? 'amber' : 'red';
            return { id: dsa.id, name: dsa.name, total, thisHour, target, pct, status };
        });
        // Unread alerts
        const alertCount = await prisma_1.default.alert.count({
            where: { teamLeadId, status: 'SENT' },
        });
        res.json({
            success: true,
            data: {
                tl: { id: tl.id, name: tl.user.name, zone: tl.zone, region: tl.region },
                kpis,
                dsaSummary,
                hourlyActivations,
                alertCount,
                today,
            },
        });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});
// POST /api/v1/tl/activations
router.post('/activations', [
    (0, express_validator_1.body)('dsaId').notEmpty(),
    (0, express_validator_1.body)('count').isInt({ min: 1 }),
    (0, express_validator_1.body)('hourSlot').notEmpty(),
    (0, express_validator_1.body)('date').isISO8601(),
], async (req, res) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ success: false, error: errors.array()[0].msg });
        return;
    }
    try {
        const { teamLeadId } = req.user;
        if (!teamLeadId) {
            res.status(403).json({ success: false, error: 'Not a team lead' });
            return;
        }
        const { dsaId, count, hourSlot, date, latitude, longitude, notes } = req.body;
        // Verify DSA belongs to this TL
        const dsa = await prisma_1.default.dSA.findFirst({
            where: { id: dsaId, teamLeadId },
        });
        if (!dsa) {
            res.status(404).json({ success: false, error: 'DSA not found' });
            return;
        }
        const activation = await prisma_1.default.activation.create({
            data: {
                teamLeadId,
                dsaId,
                count: Number(count),
                hourSlot,
                date,
                latitude: latitude ? Number(latitude) : null,
                longitude: longitude ? Number(longitude) : null,
                notes: notes || null,
            },
            include: { dsa: true },
        });
        res.status(201).json({ success: true, data: activation });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});
// GET /api/v1/tl/activations
router.get('/activations', async (req, res) => {
    try {
        const { teamLeadId } = req.user;
        if (!teamLeadId) {
            res.status(403).json({ success: false, error: 'Not a team lead' });
            return;
        }
        const date = req.query.date || new Date().toISOString().split('T')[0];
        const activations = await prisma_1.default.activation.findMany({
            where: { teamLeadId, date },
            include: { dsa: true },
            orderBy: { createdAt: 'desc' },
        });
        res.json({ success: true, data: activations });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});
// GET /api/v1/tl/dsas
router.get('/dsas', async (req, res) => {
    try {
        const { teamLeadId } = req.user;
        if (!teamLeadId) {
            res.status(403).json({ success: false, error: 'Not a team lead' });
            return;
        }
        const dsas = await prisma_1.default.dSA.findMany({
            where: { teamLeadId },
            orderBy: { name: 'asc' },
        });
        res.json({ success: true, data: dsas });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});
// POST /api/v1/tl/dsas
router.post('/dsas', [(0, express_validator_1.body)('name').notEmpty()], async (req, res) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ success: false, error: errors.array()[0].msg });
        return;
    }
    try {
        const { teamLeadId } = req.user;
        if (!teamLeadId) {
            res.status(403).json({ success: false, error: 'Not a team lead' });
            return;
        }
        const { name, phone } = req.body;
        const dsa = await prisma_1.default.dSA.create({
            data: { teamLeadId, name, phone: phone || null },
        });
        res.status(201).json({ success: true, data: dsa });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});
// PATCH /api/v1/tl/dsas/:id
router.patch('/dsas/:id', async (req, res) => {
    try {
        const { teamLeadId } = req.user;
        if (!teamLeadId) {
            res.status(403).json({ success: false, error: 'Not a team lead' });
            return;
        }
        const { id } = req.params;
        const dsa = await prisma_1.default.dSA.findFirst({ where: { id, teamLeadId } });
        if (!dsa) {
            res.status(404).json({ success: false, error: 'DSA not found' });
            return;
        }
        const { name, phone, status } = req.body;
        const updated = await prisma_1.default.dSA.update({
            where: { id },
            data: {
                name: name ?? dsa.name,
                phone: phone ?? dsa.phone,
                status: status ?? dsa.status,
            },
        });
        res.json({ success: true, data: updated });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});
// GET /api/v1/tl/alerts
router.get('/alerts', async (req, res) => {
    try {
        const { teamLeadId } = req.user;
        if (!teamLeadId) {
            res.status(403).json({ success: false, error: 'Not a team lead' });
            return;
        }
        const alerts = await prisma_1.default.alert.findMany({
            where: { teamLeadId },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });
        res.json({ success: true, data: alerts });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});
// GET /api/v1/tl/runrate
router.get('/runrate', async (req, res) => {
    try {
        const { teamLeadId } = req.user;
        if (!teamLeadId) {
            res.status(403).json({ success: false, error: 'Not a team lead' });
            return;
        }
        const today = new Date().toISOString().split('T')[0];
        const tl = await prisma_1.default.teamLead.findUnique({
            where: { id: teamLeadId },
            include: { dsas: { where: { status: 'ACTIVE' } } },
        });
        if (!tl) {
            res.status(404).json({ success: false, error: 'Team lead not found' });
            return;
        }
        const todayActivations = await prisma_1.default.activation.findMany({
            where: { teamLeadId, date: today },
        });
        const totalActivations = todayActivations.reduce((sum, a) => sum + a.count, 0);
        const currentSlot = (0, kpi_1.getCurrentHourSlot)();
        const thisHourActs = todayActivations.filter((a) => a.hourSlot === currentSlot);
        const activationsThisHour = thisHourActs.reduce((sum, a) => sum + a.count, 0);
        const activeDSAsThisHour = new Set(thisHourActs.map((a) => a.dsaId)).size;
        const workingHours = (0, kpi_1.getWorkingHours)();
        const hourlyActivations = workingHours.map((wh) => {
            const whNum = parseInt(wh);
            const slot = `${wh}:00-${String(whNum + 1).padStart(2, '0')}:00`;
            const slotActs = todayActivations.filter((a) => a.hourSlot === slot);
            return {
                slot,
                activations: slotActs.reduce((sum, a) => sum + a.count, 0),
                activeDSAs: new Set(slotActs.map((a) => a.dsaId)).size,
                dsaTarget: tl.dsas.length,
            };
        });
        const activeDSAIds = new Set(todayActivations.map((a) => a.dsaId));
        const kpis = (0, kpi_1.calculateKPIs)({
            totalActivations,
            dsaCount: tl.dsas.length,
            activeDSAsToday: activeDSAIds.size,
            activationsThisHour,
            activeDSAsThisHour,
            hourlyActivations,
            allocatedTarget: tl.allocatedTarget,
        });
        res.json({ success: true, data: { runRateForecast: kpis.runRateForecast, requiredRunRate: kpis.requiredRunRate, carryForward: kpis.carryForward, currentHour: kpis.currentHour } });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});
// GET /api/v1/tl/heatmap
router.get('/heatmap', async (req, res) => {
    try {
        const { teamLeadId } = req.user;
        if (!teamLeadId) {
            res.status(403).json({ success: false, error: 'Not a team lead' });
            return;
        }
        const today = new Date().toISOString().split('T')[0];
        const tl = await prisma_1.default.teamLead.findUnique({
            where: { id: teamLeadId },
            include: { dsas: { where: { status: 'ACTIVE' } } },
        });
        if (!tl) {
            res.status(404).json({ success: false, error: 'Team lead not found' });
            return;
        }
        const todayActivations = await prisma_1.default.activation.findMany({
            where: { teamLeadId, date: today },
            include: { dsa: true },
        });
        const workingHours = (0, kpi_1.getWorkingHours)();
        const heatmap = tl.dsas.map((dsa) => {
            const slots = workingHours.map((wh) => {
                const whNum = parseInt(wh);
                const slot = `${wh}:00-${String(whNum + 1).padStart(2, '0')}:00`;
                const acts = todayActivations.filter((a) => a.dsaId === dsa.id && a.hourSlot === slot);
                return { slot, activations: acts.reduce((sum, a) => sum + a.count, 0) };
            });
            return { dsa: { id: dsa.id, name: dsa.name }, slots };
        });
        res.json({ success: true, data: heatmap });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});
//# sourceMappingURL=tl.js.map