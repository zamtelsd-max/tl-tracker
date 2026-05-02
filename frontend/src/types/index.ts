export interface User {
  id: string;
  staffId: string;
  name: string;
  role: 'HSD' | 'ZBM' | 'ASE' | 'TL' | 'ADMIN';
  zone?: string;
  region?: string;
  teamLeadId?: string;
}

export interface DSA {
  id: string;
  name: string;
  phone?: string;
  status: 'ACTIVE' | 'INACTIVE';
  teamLeadId: string;
}

export interface DSASummary {
  id: string;
  name: string;
  total: number;
  thisHour: number;
  target: number;
  pct: number;
  status: 'green' | 'amber' | 'red';
}

export interface KPIs {
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

export interface HourlySlot {
  slot: string;
  activations: number;
}

export interface TLDashboard {
  tl: { id: string; name: string; zone?: string; region?: string };
  kpis: KPIs;
  dsaSummary: DSASummary[];
  hourlyActivations: HourlySlot[];
  alertCount: number;
  today: string;
}

export interface Activation {
  id: string;
  teamLeadId: string;
  dsaId: string;
  dsa: DSA;
  customerName: string;
  count: number;
  hourSlot: string;
  date: string;
  latitude?: number;
  longitude?: number;
  notes?: string;
  createdAt: string;
}

export interface Alert {
  id: string;
  type: 'ZERO_ACTIVITY' | 'MISSED_TARGET' | 'END_OF_DAY' | 'ESCALATION';
  message: string;
  status: 'SENT' | 'READ' | 'RESOLVED';
  createdAt: string;
}

export interface TLSummary {
  id: string;
  name: string;
  staffId: string;
  zone?: string;
  region?: string;
  activations: number;
  target: number;
  attainment: number;
  runRate: number;
  dsaCount: number;
  status: 'on-track' | 'at-risk' | 'critical';
}

export interface ASEDashboard {
  summary: {
    totalActivations: number;
    totalTeams: number;
    teamsWithActivity: number;
    avgRunRate: number;
    exceptions: number;
  };
  teamLeads: TLSummary[];
  exceptions: Alert[];
}

export interface ZBMDashboard {
  zone?: string;
  summary: {
    totalActivations: number;
    totalTargets: number;
    complianceRate: number;
    avgRunRate: number;
    teamsBelow: number;
    totalTeams: number;
  };
  teamLeads: Array<{
    id: string;
    name: string;
    zone?: string;
    region?: string;
    activations: number;
    target: number;
    attainment: number;
    runRate: number;
    hourlyActivations: HourlySlot[];
  }>;
  heatmap: Array<{ name: string; slots: HourlySlot[] }>;
}

export interface HSDDashboard {
  national: {
    totalActivations: number;
    totalTarget: number;
    attainment: number;
    totalTeams: number;
  };
  zoneRankings: Array<{
    zone: string;
    activations: number;
    target: number;
    teams: number;
    attainment: number;
  }>;
  leaderboard: Array<{ id: string; name: string; zone?: string; activations: number; attainment: number }>;
  underperformers: Array<{ id: string; name: string; zone?: string; activations: number; attainment: number }>;
}

export interface AdminUser {
  id: string;
  staffId: string;
  name: string;
  role: string;
  zone?: string;
  region?: string;
  territory?: string;
  active: boolean;
  createdAt: string;
}

export interface MTDDay {
  date: string;
  activations: number;
  target: number;
  cumActivations: number;
  cumTarget: number;
}

export type ApiResponse<T> = {
  success: true;
  data: T;
} | {
  success: false;
  error: string;
};
