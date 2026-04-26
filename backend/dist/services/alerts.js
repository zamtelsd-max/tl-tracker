"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCurrentHourSlot = void 0;
exports.startAlertCron = startAlertCron;
const node_cron_1 = __importDefault(require("node-cron"));
const prisma_1 = __importDefault(require("../lib/prisma"));
const kpi_1 = require("./kpi");
Object.defineProperty(exports, "getCurrentHourSlot", { enumerable: true, get: function () { return kpi_1.getCurrentHourSlot; } });
async function checkZeroActivity() {
    try {
        const today = new Date().toISOString().split('T')[0];
        const currentHour = new Date().getHours();
        if (currentHour < 8 || currentHour >= 18)
            return;
        const teamLeads = await prisma_1.default.teamLead.findMany({
            include: { dsas: { where: { status: 'ACTIVE' } }, user: true },
        });
        for (const tl of teamLeads) {
            const activeDSAs = tl.dsas;
            for (const dsa of activeDSAs) {
                const todayActivations = await prisma_1.default.activation.count({
                    where: { dsaId: dsa.id, date: today },
                });
                if (todayActivations === 0 && (0, kpi_1.getHoursElapsed)() >= 2) {
                    // Check if alert already sent today
                    const existingAlert = await prisma_1.default.alert.findFirst({
                        where: {
                            teamLeadId: tl.id,
                            type: 'ZERO_ACTIVITY',
                            message: { contains: dsa.name },
                            createdAt: { gte: new Date(today) },
                        },
                    });
                    if (!existingAlert) {
                        await prisma_1.default.alert.create({
                            data: {
                                teamLeadId: tl.id,
                                type: 'ZERO_ACTIVITY',
                                message: `DSA ${dsa.name} has 0 activations today`,
                                targetUserId: tl.userId,
                                status: 'SENT',
                            },
                        });
                        console.log(`Zero activity alert created for DSA ${dsa.name}`);
                    }
                }
            }
        }
    }
    catch (err) {
        console.error('Error in checkZeroActivity:', err);
    }
}
async function checkMissedTarget() {
    try {
        const today = new Date().toISOString().split('T')[0];
        const currentHour = new Date().getHours();
        if (currentHour < 10 || currentHour >= 18)
            return; // Start checking after 2 hours
        const teamLeads = await prisma_1.default.teamLead.findMany({
            include: { user: true, ase: true },
        });
        for (const tl of teamLeads) {
            const totalActivations = await prisma_1.default.activation.count({
                where: { teamLeadId: tl.id, date: today },
            });
            const hoursElapsed = (0, kpi_1.getHoursElapsed)();
            const expectedByNow = (tl.allocatedTarget / 10) * hoursElapsed;
            const attainment = expectedByNow > 0 ? (totalActivations / expectedByNow) * 100 : 100;
            if (attainment < 70 && tl.aseId) {
                const existingAlert = await prisma_1.default.alert.findFirst({
                    where: {
                        teamLeadId: tl.id,
                        type: 'MISSED_TARGET',
                        createdAt: { gte: new Date(today) },
                    },
                });
                if (!existingAlert) {
                    await prisma_1.default.alert.create({
                        data: {
                            teamLeadId: tl.id,
                            type: 'MISSED_TARGET',
                            message: `Team Lead ${tl.user.name} is at ${Math.round(attainment)}% of expected target`,
                            targetUserId: tl.aseId,
                            status: 'SENT',
                        },
                    });
                    console.log(`Missed target alert for TL ${tl.user.name}`);
                }
            }
        }
    }
    catch (err) {
        console.error('Error in checkMissedTarget:', err);
    }
}
async function checkLoggingFailure() {
    try {
        const today = new Date().toISOString().split('T')[0];
        const currentHour = new Date().getHours();
        if (currentHour < 10 || currentHour >= 18)
            return;
        const teamLeads = await prisma_1.default.teamLead.findMany({
            include: { user: true },
        });
        for (const tl of teamLeads) {
            // Check last 2 hours
            const twoHoursAgo = new Date();
            twoHoursAgo.setHours(twoHoursAgo.getHours() - 2);
            const recentActivations = await prisma_1.default.activation.count({
                where: {
                    teamLeadId: tl.id,
                    date: today,
                    createdAt: { gte: twoHoursAgo },
                },
            });
            if (recentActivations === 0 && tl.aseId) {
                const existingAlert = await prisma_1.default.alert.findFirst({
                    where: {
                        teamLeadId: tl.id,
                        type: 'ESCALATION',
                        createdAt: { gte: new Date(new Date().getTime() - 2 * 60 * 60 * 1000) },
                    },
                });
                if (!existingAlert) {
                    await prisma_1.default.alert.create({
                        data: {
                            teamLeadId: tl.id,
                            type: 'ESCALATION',
                            message: `Team Lead ${tl.user.name} has not logged activations for 2 consecutive hours`,
                            targetUserId: tl.aseId,
                            status: 'SENT',
                        },
                    });
                    console.log(`Logging failure escalation for TL ${tl.user.name}`);
                }
            }
        }
    }
    catch (err) {
        console.error('Error in checkLoggingFailure:', err);
    }
}
async function endOfDaySummary() {
    try {
        const today = new Date().toISOString().split('T')[0];
        const teamLeads = await prisma_1.default.teamLead.findMany({
            include: { user: true },
        });
        for (const tl of teamLeads) {
            const totalActivations = await prisma_1.default.activation.count({
                where: { teamLeadId: tl.id, date: today },
            });
            const attainment = Math.round((totalActivations / tl.allocatedTarget) * 100);
            await prisma_1.default.alert.create({
                data: {
                    teamLeadId: tl.id,
                    type: 'END_OF_DAY',
                    message: `End of day summary for ${tl.user.name}: ${totalActivations}/${tl.allocatedTarget} activations (${attainment}%)`,
                    targetUserId: tl.userId,
                    status: 'SENT',
                },
            });
        }
        console.log('End of day summaries created');
    }
    catch (err) {
        console.error('Error in endOfDaySummary:', err);
    }
}
function startAlertCron() {
    // Every 5 minutes during working hours
    node_cron_1.default.schedule('*/5 * * * *', async () => {
        console.log(`Running alert checks at ${new Date().toISOString()}`);
        await checkZeroActivity();
        await checkMissedTarget();
        await checkLoggingFailure();
    });
    // End of day at 18:00
    node_cron_1.default.schedule('0 18 * * 1-5', async () => {
        console.log('Running end of day summary');
        await endOfDaySummary();
    });
    console.log('Alert cron jobs started');
}
//# sourceMappingURL=alerts.js.map