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
//# sourceMappingURL=zbm.js.map