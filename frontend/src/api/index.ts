import api from './client';
import type {
  TLDashboard, Activation, DSA, Alert,
  ASEDashboard, ZBMDashboard, HSDDashboard, AdminUser,
  ApiResponse, MTDDay
} from '../types';

// Auth
export const login = async (staffId: string, pin: string) => {
  const res = await api.post<ApiResponse<{ token: string; user: { id: string; staffId: string; name: string; role: string; zone?: string; region?: string; teamLeadId?: string } }>>('/auth/login', { staffId, pin });
  return res.data;
};

// TL
export const getTLDashboard = async () => {
  const res = await api.get<ApiResponse<TLDashboard>>('/tl/dashboard');
  return res.data;
};

export const getActivations = async (date?: string) => {
  const res = await api.get<ApiResponse<Activation[]>>(`/tl/activations${date ? `?date=${date}` : ''}`);
  return res.data;
};

export const logActivation = async (data: {
  dsaId: string;
  count: number;
  registeredCount?: number;
  hourSlot: string;
  date: string;
  latitude?: number;
  longitude?: number;
  notes?: string;
}) => {
  const res = await api.post<ApiResponse<Activation>>('/tl/activations', data);
  return res.data;
};

export const getDSAs = async () => {
  const res = await api.get<ApiResponse<DSA[]>>('/tl/dsas');
  return res.data;
};

export const addDSA = async (data: { name: string; phone?: string; dealerCode?: string }) => {
  const res = await api.post<ApiResponse<DSA>>('/tl/dsas', data);
  return res.data;
};

export const updateDSA = async (id: string, data: { name?: string; phone?: string; dealerCode?: string; status?: 'ACTIVE' | 'INACTIVE' }) => {
  const res = await api.patch<ApiResponse<DSA>>(`/tl/dsas/${id}`, data);
  return res.data;
};

export const getTLAlerts = async () => {
  const res = await api.get<ApiResponse<Alert[]>>('/tl/alerts');
  return res.data;
};

export const getHeatmap = async () => {
  const res = await api.get<ApiResponse<Array<{ dsa: { id: string; name: string }; slots: Array<{ slot: string; activations: number }> }>>>('/tl/heatmap');
  return res.data;
};

// ASE
export const getASEDashboard = async () => {
  const res = await api.get<ApiResponse<ASEDashboard>>('/ase/dashboard');
  return res.data;
};

export const getASETeamLeads = async () => {
  const res = await api.get<ApiResponse<unknown[]>>('/ase/teamleads');
  return res.data;
};

export const getASEAlerts = async () => {
  const res = await api.get<ApiResponse<Alert[]>>('/ase/alerts');
  return res.data;
};

// ZBM
export const getZBMDashboard = async () => {
  const res = await api.get<ApiResponse<ZBMDashboard>>('/zbm/dashboard');
  return res.data;
};

// HSD
export const getHSDDashboard = async () => {
  const res = await api.get<ApiResponse<HSDDashboard>>('/hsd/dashboard');
  return res.data;
};

export const getLeaderboard = async () => {
  const res = await api.get<ApiResponse<HSDDashboard['leaderboard']>>('/hsd/leaderboard');
  return res.data;
};

// ASE — add TL
export const aseAddTeamLead = async (data: {
  staffId: string; name: string; pin: string; region: string; allocatedTarget?: number;
}) => {
  const res = await api.post<ApiResponse<{ user: AdminUser; teamLead: unknown }>>('/ase/teamleads', data);
  return res.data;
};

// ZBM — list ASEs in zone, list TLs, add TL
export const zbmGetASEs = async () => {
  const res = await api.get<ApiResponse<{ id: string; staffId: string; name: string; zone?: string; region?: string }[]>>('/zbm/ases');
  return res.data;
};
export const zbmAddASE = async (data: {
  staffId: string; name: string; pin: string; region: string;
}) => {
  const res = await api.post<ApiResponse<{ id: string; staffId: string; name: string }>>('/zbm/ases', data);
  return res.data;
};
export const zbmGetTeamLeads = async () => {
  const res = await api.get<ApiResponse<unknown[]>>('/zbm/teamleads');
  return res.data;
};
export const zbmAddTeamLead = async (data: {
  staffId: string; name: string; pin: string; region: string; aseId?: string; allocatedTarget?: number;
}) => {
  const res = await api.post<ApiResponse<{ user: AdminUser; teamLead: unknown }>>('/zbm/teamleads', data);
  return res.data;
};

// Admin
export const getAdminUsers = async () => {
  const res = await api.get<ApiResponse<AdminUser[]>>('/admin/users');
  return res.data;
};

export const createUser = async (data: {
  staffId: string;
  pin: string;
  name: string;
  role: string;
  zone?: string;
  region?: string;
  territory?: string;
  aseId?: string;
}) => {
  const res = await api.post<ApiResponse<AdminUser>>('/admin/users', data);
  return res.data;
};

export const updateUser = async (id: string, data: { name?: string; zone?: string; region?: string; active?: boolean; pin?: string }) => {
  const res = await api.patch<ApiResponse<AdminUser>>(`/admin/users/${id}`, data);
  return res.data;
};

export const deleteUser = async (id: string) => {
  const res = await api.delete<ApiResponse<{ message: string }>>(`/admin/users/${id}`);
  return res.data;
};

// ── ASE: available TLs + link/unlink ────────────────────────────────────────
export const aseGetAvailableTLs = () =>
  api.get<{
    id: string; region: string | null; zone: string | null;
    aseId: string | null; allocatedTarget: number;
    pickable: boolean; mine: boolean;
    user: { staffId: string; name: string };
    _count: { dsas: number };
  }[]>('/ase/available-teamleads').then(r => r.data);

export const aseLinkTeamLead = (teamLeadId: string) =>
  api.post<ApiResponse<unknown>>('/ase/link-teamlead', { teamLeadId }).then(r => r.data);

export const aseUnlinkTeamLead = (teamLeadId: string) =>
  api.delete<ApiResponse<unknown>>(`/ase/link-teamlead/${teamLeadId}`).then(r => r.data);

// MTD
export const getHSDMTD = async () => {
  const res = await api.get<ApiResponse<MTDDay[]>>('/hsd/mtd');
  return res.data;
};
export const getZBMMTD = async () => {
  const res = await api.get<ApiResponse<MTDDay[]>>('/zbm/mtd');
  return res.data;
};
export const getASEMTD = async () => {
  const res = await api.get<ApiResponse<MTDDay[]>>('/ase/mtd');
  return res.data;
};

// ── TL: registered numbers ───────────────────────────────────────────────────
export const tlLogRegisteredNumbers = (dsaId: string, numbers: string[]) =>
  api.post<ApiResponse<{ saved: number; skipped: number; duplicates: string[] }>>('/tl/registered-numbers', { dsaId, numbers }).then(r => r.data.data!);

export const tlGetRegisteredNumbers = (dsaId?: string, date?: string) =>
  api.get<ApiResponse<{ id: string; msisdn: string; date: string; dsa: { name: string; dealerCode: string | null } }[]>>(
    '/tl/registered-numbers', { params: { dsaId, date } }
  ).then(r => r.data.data!);

// ── TL Edit / Delete / Performance ─────────────────────────────────────────
export type TLPerformance = { today: number; yesterday: number; weekly: number; monthly: number };

export const asePatchTL = (tlId: string, data: { name?: string; zone?: string; region?: string; territory?: string; allocatedTarget?: number; pin?: string }) =>
  api.patch<ApiResponse<unknown>>(`/ase/teamleads/${tlId}`, data).then(r => r.data);

export const aseDeleteTL = (tlId: string) =>
  api.delete<ApiResponse<unknown>>(`/ase/teamleads/${tlId}`).then(r => r.data);

export const aseGetTLPerformance = (tlId: string) =>
  api.get<ApiResponse<TLPerformance>>(`/ase/teamleads/${tlId}/performance`).then(r => r.data.data!);

export const zbmPatchTL = (tlId: string, data: { name?: string; zone?: string; region?: string; territory?: string; allocatedTarget?: number; pin?: string }) =>
  api.patch<ApiResponse<unknown>>(`/zbm/teamleads/${tlId}`, data).then(r => r.data);

export const zbmDeleteTL = (tlId: string) =>
  api.delete<ApiResponse<unknown>>(`/zbm/teamleads/${tlId}`).then(r => r.data);

export const zbmGetTLPerformance = (tlId: string) =>
  api.get<ApiResponse<TLPerformance>>(`/zbm/teamleads/${tlId}/performance`).then(r => r.data.data!);

export const hsdPatchTL = (tlId: string, data: { name?: string; zone?: string; region?: string; territory?: string; allocatedTarget?: number; pin?: string }) =>
  api.patch<ApiResponse<unknown>>(`/hsd/teamleads/${tlId}`, data).then(r => r.data);

export const hsdDeleteTL = (tlId: string) =>
  api.delete<ApiResponse<unknown>>(`/hsd/teamleads/${tlId}`).then(r => r.data);

export const hsdGetTLPerformance = (tlId: string) =>
  api.get<ApiResponse<TLPerformance>>(`/hsd/teamleads/${tlId}/performance`).then(r => r.data.data!);

// ── Gross Adds ──────────────────────────────────────────────────────────────
export interface GrossAdd {
  id: string;
  dsaId: string;
  teamLeadId: string;
  msisdn: string;
  amountRecharged: number | null;
  walletActivated: boolean;
  firstDeposit: number | null;
  hourSlot: string;
  date: string;
  latitude: number | null;
  longitude: number | null;
  notes: string | null;
  createdAt: string;
  dsa?: { name: string; dealerCode: string | null };
}

export const logGrossAdd = async (data: {
  dsaId: string;
  msisdn: string;
  amountRecharged?: number;
  walletActivated?: boolean;
  firstDeposit?: number;
  latitude?: number;
  longitude?: number;
  notes?: string;
  hourSlot?: string;
  date?: string;
}) => {
  const res = await api.post<ApiResponse<GrossAdd>>('/tl/gross-adds', data);
  return res.data;
};

export const getGrossAdds = async (dsaId?: string, date?: string) => {
  const res = await api.get<ApiResponse<GrossAdd[]>>('/tl/gross-adds', { params: { dsaId, date } });
  return res.data;
};

export const getDSAGrossAdds = async (dsaId: string, date?: string) => {
  const res = await api.get<ApiResponse<{
    dsa: { id: string; name: string; dealerCode: string | null };
    date: string;
    totalAdds: number;
    totalRecharged: number;
    walletActivations: number;
    totalFirstDeposit: number;
    adds: GrossAdd[];
  }>>(`/tl/dsa/${dsaId}/gross-adds`, { params: { date } });
  return res.data;
};

// ── Excel Export helpers ─────────────────────────────────────────────────────
// Downloads the xlsx directly by opening an authenticated fetch + blob URL.
export const downloadExport = async (endpoint: string, filename: string): Promise<void> => {
  const token = localStorage.getItem('tl-tracker-token');
  const baseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3002/api/v1').replace(/\/$/, '');
  const res = await fetch(`${baseUrl}${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Export failed');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

export const tlExport    = () => downloadExport('/tl/export',      `TL-Report-${new Date().toISOString().split('T')[0]}.xlsx`);
export const aseExport   = () => downloadExport('/ase/export',     `ASE-Report-${new Date().toISOString().split('T')[0]}.xlsx`);
export const zbmExport   = () => downloadExport('/zbm/export',     `ZBM-Report-${new Date().toISOString().split('T')[0]}.xlsx`);
export const hsdExport   = () => downloadExport('/hsd/export',     `HSD-National-${new Date().toISOString().split('T')[0]}.xlsx`);
export const adminExport = () => downloadExport('/admin/export',   `National-Report-${new Date().toISOString().split('T')[0]}.xlsx`);
export const listerExport = () => downloadExport('/lister/export',  `Copperbelt-Activations-${new Date().toISOString().split('T')[0]}.xlsx`);
