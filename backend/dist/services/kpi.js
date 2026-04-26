"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWorkingHours = getWorkingHours;
exports.getCurrentHour = getCurrentHour;
exports.getHoursElapsed = getHoursElapsed;
exports.getHoursRemaining = getHoursRemaining;
exports.getCurrentHourSlot = getCurrentHourSlot;
exports.calculateKPIs = calculateKPIs;
function getWorkingHours() {
    return ['08', '09', '10', '11', '12', '13', '14', '15', '16', '17'];
}
function getCurrentHour() {
    const now = new Date();
    return now.getHours();
}
function getHoursElapsed() {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinutes = now.getMinutes();
    if (currentHour < 8)
        return 0;
    if (currentHour >= 18)
        return 10;
    const elapsed = currentHour - 8;
    // Add partial hour
    return elapsed + currentMinutes / 60;
}
function getHoursRemaining() {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinutes = now.getMinutes();
    if (currentHour >= 18)
        return 0;
    if (currentHour < 8)
        return 10;
    const remainingHours = 18 - currentHour - 1;
    const remainingMins = 60 - currentMinutes;
    return remainingHours + remainingMins / 60;
}
function getCurrentHourSlot() {
    const now = new Date();
    const hour = now.getHours();
    if (hour < 8)
        return '08:00-09:00';
    if (hour >= 18)
        return '17:00-18:00';
    return `${String(hour).padStart(2, '0')}:00-${String(hour + 1).padStart(2, '0')}:00`;
}
function calculateKPIs(params) {
    const { totalActivations, dsaCount, activeDSAsToday, activationsThisHour, activeDSAsThisHour, hourlyActivations, allocatedTarget, } = params;
    const hoursElapsed = getHoursElapsed();
    const hoursRemaining = getHoursRemaining();
    const currentHour = getCurrentHour();
    // Headcount compliance
    const headcountCompliance = (dsaCount / 10) * 100;
    // Gross adds per DSA
    const grossAddsPerDSA = dsaCount > 0 ? totalActivations / dsaCount : 0;
    // Hourly productivity
    const hourlyProductivity = activeDSAsThisHour > 0 ? activationsThisHour / activeDSAsThisHour : 0;
    // Team target attainment
    const teamTargetAttainment = (totalActivations / allocatedTarget) * 100;
    // Active DSA ratio
    const activeDSARatio = dsaCount > 0 ? (activeDSAsToday / dsaCount) * 100 : 0;
    // Zero activity rate
    const zeroActivityRate = dsaCount > 0 ? ((dsaCount - activeDSAsToday) / dsaCount) * 100 : 0;
    // Run rate forecast
    const runRateForecast = hoursElapsed > 0 ? (totalActivations / hoursElapsed) * 10 : 0;
    // Carry forward: sum unmet hourly targets
    let carryForward = 0;
    const workingHours = getWorkingHours();
    const hourlyTarget = 5; // per DSA per hour -> team of 10: 5 activations/hour total per DSA
    for (const wh of workingHours) {
        const whNum = parseInt(wh);
        if (whNum >= currentHour)
            break;
        const slot = `${wh}:00-${String(whNum + 1).padStart(2, '0')}:00`;
        const found = hourlyActivations.find((h) => h.slot === slot);
        const actual = found ? found.activations : 0;
        const target = dsaCount * 0.5; // 0.5 per DSA per hour
        const unmet = Math.max(0, target - actual);
        carryForward += unmet;
    }
    // Required run rate
    const requiredRunRate = hoursRemaining > 0
        ? (allocatedTarget - totalActivations + carryForward) / hoursRemaining
        : 0;
    return {
        headcountCompliance,
        grossAddsPerDSA,
        hourlyProductivity,
        teamTargetAttainment,
        activeDSARatio,
        zeroActivityRate,
        runRateForecast,
        carryForward,
        requiredRunRate: Math.max(0, requiredRunRate),
        totalActivations,
        hoursElapsed,
        hoursRemaining,
        currentHour: getCurrentHourSlot(),
    };
}
//# sourceMappingURL=kpi.js.map