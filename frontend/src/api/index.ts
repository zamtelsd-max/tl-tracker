import api from './client';
import type {
  TLDashboard, Activation, DSA, Alert,
  ASEDashboard, ZBMDashboard, HSDDashboard, AdminUser,
  ApiResponse
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
