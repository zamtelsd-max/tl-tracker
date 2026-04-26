import api from './client';
import type {
  TLDashboard, Activation, DSA, Alert,
  ASEDashboard, ZBMDashboard, HSDDashboard, AdminUser,
  ApiResponse
} from '../types';

// Auth
export const login = async (staffId: string, pin: string) => {
  const res = await api.post<ApiResponse<{ token: string; user: { id: string; staffId: string; name: string; role: string; zone?: string; region?: string; teamLeadId?: string } }>>('/v1/auth/login', { staffId, pin });
  return res.data;
};

// TL
export const getTLDashboard = async () => {
  const res = await api.get<ApiResponse<TLDashboard>>('/v1/tl/dashboard');
  return res.data;
};

export const getActivations = async (date?: string) => {
  const res = await api.get<ApiResponse<Activation[]>>(`/v1/tl/activations${date ? `?date=${date}` : ''}`);
  return res.data;
};

export const logActivation = async (data: {
  dsaId: string;
  customerName: string;
  count: number;
  hourSlot: string;
  date: string;
  latitude?: number;
  longitude?: number;
  notes?: string;
}) => {
  const res = await api.post<ApiResponse<Activation>>('/v1/tl/activations', data);
  return res.data;
};

export const getDSAs = async () => {
  const res = await api.get<ApiResponse<DSA[]>>('/v1/tl/dsas');
  return res.data;
};

export const addDSA = async (data: { name: string; phone?: string }) => {
  const res = await api.post<ApiResponse<DSA>>('/v1/tl/dsas', data);
  return res.data;
};

export const updateDSA = async (id: string, data: { name?: string; phone?: string; status?: 'ACTIVE' | 'INACTIVE' }) => {
  const res = await api.patch<ApiResponse<DSA>>(`/v1/tl/dsas/${id}`, data);
  return res.data;
};

export const getTLAlerts = async () => {
  const res = await api.get<ApiResponse<Alert[]>>('/v1/tl/alerts');
  return res.data;
};

export const getHeatmap = async () => {
  const res = await api.get<ApiResponse<Array<{ dsa: { id: string; name: string }; slots: Array<{ slot: string; activations: number }> }>>>('/v1/tl/heatmap');
  return res.data;
};

// ASE
export const getASEDashboard = async () => {
  const res = await api.get<ApiResponse<ASEDashboard>>('/v1/ase/dashboard');
  return res.data;
};

export const getASETeamLeads = async () => {
  const res = await api.get<ApiResponse<unknown[]>>('/v1/ase/teamleads');
  return res.data;
};

export const getASEAlerts = async () => {
  const res = await api.get<ApiResponse<Alert[]>>('/v1/ase/alerts');
  return res.data;
};

// ZBM
export const getZBMDashboard = async () => {
  const res = await api.get<ApiResponse<ZBMDashboard>>('/v1/zbm/dashboard');
  return res.data;
};

// HSD
export const getHSDDashboard = async () => {
  const res = await api.get<ApiResponse<HSDDashboard>>('/v1/hsd/dashboard');
  return res.data;
};

export const getLeaderboard = async () => {
  const res = await api.get<ApiResponse<HSDDashboard['leaderboard']>>('/v1/hsd/leaderboard');
  return res.data;
};

// Admin
export const getAdminUsers = async () => {
  const res = await api.get<ApiResponse<AdminUser[]>>('/v1/admin/users');
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
  const res = await api.post<ApiResponse<AdminUser>>('/v1/admin/users', data);
  return res.data;
};

export const updateUser = async (id: string, data: { name?: string; zone?: string; region?: string; active?: boolean; pin?: string }) => {
  const res = await api.patch<ApiResponse<AdminUser>>(`/v1/admin/users/${id}`, data);
  return res.data;
};

export const deleteUser = async (id: string) => {
  const res = await api.delete<ApiResponse<{ message: string }>>(`/v1/admin/users/${id}`);
  return res.data;
};
