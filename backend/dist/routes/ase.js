"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.aseRouter = void 0;
const express_1 = require("express");
const prisma_1 = __importDefault(require("../lib/prisma"));
const auth_1 = require("../middleware/auth");
const kpi_1 = require("../services/kpi");
const router = (0, express_1.Router)();
exports.aseRouter = router;
router.use(auth_1.authenticate);
router.use((0, auth_1.requireRole)('ASE', 'ADMIN'));
// GET /api/v1/ase/dashboard
router.get('/dashboard', async (req, res) => {
    try {
        const { userId } = req.user;
        const today = new Date().toISOString().split('T')[0];
        const teamLeads = await prisma_1.default.teamLead.findMany({
            where: { aseId: userId },
            include: { user: true, dsas: { where: { status: 'ACTIVE' } } },
        });
        let totalActivations = 0;
        let totalTeams = teamLeads.length;
        let teamsWithActivity = 0;
        const currentSlot = (0, kpi_1.getCurrentHourSlot)();
        const tlSummaries = await Promise.all(teamLeads.map(async (tl) => {
            const acts = await prisma_1.default.activation.findMany({
                where: { teamLeadId: tl.id, date: today },
            });
            const tlTotal = acts.reduce((sum, a) => sum + a.count, 0);
            totalActivations += tlTotal;
            if (tlTotal > 0)
                teamsWithActivity++;
            const workingHours = (0, kpi_1.getWorkingHours)();
            const hourlyActivations = workingHours.map((wh) => {
                const whNum = parseInt(wh);
                const slot = `${wh}:00-${String(whNum + 1).padStart(2, '0')}:00`;
                const slotActs = acts.filter((a) => a.hourSlot === slot);
                return { slot, activations: slotActs.reduce((sum, a) => sum + a.count, 0) };
            });
            const thisHourActs = acts.filter((a) => a.hourSlot === currentSlot);
            const kpis = (0, kpi_1.calculateKPIs)({
                totalActivations: tlTotal,
                dsaCount: tl.dsas.length,
                activeDSAsToday: new Set(acts.map((a) => a.dsaId)).size,
                activationsThisHour: thisHourActs.reduce((sum, a) => sum + a.count, 0),
                activeDSAsThisHour: new Set(thisHourActs.map((a) => a.dsaId)).size,
                hourlyActivations,
                allocatedTarget: tl.allocatedTarget,
            });
            const attainmentPct = kpis.teamTargetAttainment;
            const statusBadge = attainmentPct >= 80 ? 'on-track' : attainmentPct >= 50 ? 'at-risk' : 'critical';
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
        }));
        const avgRunRate = tlSummaries.length > 0
            ? tlSummaries.reduce((s, t) => s + t.runRate, 0) / tlSummaries.length
            : 0;
        const exceptions = await prisma_1.default.alert.findMany({
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
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});
// GET /api/v1/ase/teamleads
router.get('/teamleads', async (req, res) => {
    try {
        const { userId } = req.user;
        const teamLeads = await prisma_1.default.teamLead.findMany({
            where: { aseId: userId },
            include: { user: true, dsas: true },
            orderBy: { createdAt: 'asc' },
        });
        res.json({ success: true, data: teamLeads });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});
// GET /api/v1/ase/teamleads/:id
router.get('/teamleads/:id', async (req, res) => {
    try {
        const { userId } = req.user;
        const { id } = req.params;
        const today = new Date().toISOString().split('T')[0];
        const tl = await prisma_1.default.teamLead.findFirst({
            where: { id, aseId: userId },
            include: { user: true, dsas: true },
        });
        if (!tl) {
            res.status(404).json({ success: false, error: 'Team lead not found' });
            return;
        }
        const activations = await prisma_1.default.activation.findMany({
            where: { teamLeadId: id, date: today },
            include: { dsa: true },
            orderBy: { createdAt: 'desc' },
        });
        res.json({ success: true, data: { tl, activations } });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});
// GET /api/v1/ase/exceptions
router.get('/exceptions', async (req, res) => {
    try {
        const { userId } = req.user;
        const today = new Date().toISOString().split('T')[0];
        const teamLeads = await prisma_1.default.teamLead.findMany({
            where: { aseId: userId },
            include: { dsas: { where: { status: 'ACTIVE' } } },
        });
        const exceptions = [];
        for (const tl of teamLeads) {
            for (const dsa of tl.dsas) {
                const acts = await prisma_1.default.activation.count({
                    where: { dsaId: dsa.id, date: today },
                });
                if (acts === 0) {
                    exceptions.push({ tlId: tl.id, dsaId: dsa.id, dsaName: dsa.name });
                }
            }
        }
        res.json({ success: true, data: exceptions });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});
// GET /api/v1/ase/alerts
router.get('/alerts', async (req, res) => {
    try {
        const { userId } = req.user;
        const alerts = await prisma_1.default.alert.findMany({
            where: { targetUserId: userId },
            include: { teamLead: { include: { user: true } } },
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
//# sourceMappingURL=ase.js.map