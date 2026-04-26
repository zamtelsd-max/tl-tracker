export interface HourlySlot {
    slot: string;
    activations: number;
}
export interface KPIResult {
    headcountCompliance: number;
    grossAddsPerDSA: number;
    hourlyProductivity: number;
    teamTargetAttainment: number;
    activeDSARatio: number;
    zeroActivityRate: number;
    runRateForecast: number;
    carryForward: number;
    requiredRunRate: number;
    totalActivations: number;
    hoursElapsed: number;
    hoursRemaining: number;
    currentHour: string;
}
export declare function getWorkingHours(): string[];
export declare function getCurrentHour(): number;
export declare function getHoursElapsed(): number;
export declare function getHoursRemaining(): number;
export declare function getCurrentHourSlot(): string;
export declare function calculateKPIs(params: {
    totalActivations: number;
    dsaCount: number;
    activeDSAsToday: number;
    activationsThisHour: number;
    activeDSAsThisHour: number;
    hourlyActivations: HourlySlot[];
    allocatedTarget: number;
}): KPIResult;
//# sourceMappingURL=kpi.d.ts.map