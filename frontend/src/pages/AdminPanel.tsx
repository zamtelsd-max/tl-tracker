import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UserPlus, Pencil, X, Check } from 'lucide-react';
import Layout from '../components/Layout';
import { getAdminUsers, createUser, updateUser, deleteUser, adminExport } from '../api';
import ExportButton from '../components/ExportButton';
import type { AdminUser } from '../types';

const ROLES = ['HSD', 'ZBM', 'ASE', 'TL', 'ADMIN'];

const roleColors: Record<string, string> = {
  HSD: 'bg-purple-100 text-purple-700',
  ZBM: 'bg-blue-100 text-blue-700',
  ASE: 'bg-cyan-100 text-cyan-700',
  TL: 'bg-green-100 text-green-700',
  ADMIN: 'bg-slate-100 text-slate-700',
};

interface UserFormData {
  staffId: string;
  pin: string;
  name: string;
  role: string;
  zone: string;
  region: string;
}

const emptyForm: UserFormData = { staffId: '', pin: '', name: '', role: 'TL', zone: '', region: '' };

export default function AdminPanel() {
  const queryClient = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editUser, setEditUser] = useState<AdminUser | null>(null);
  const [form, setForm] = useState<UserFormData>(emptyForm);
  const [error, setError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const res = await getAdminUsers();
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setShowAddModal(false);
      setForm(emptyForm);
      setError('');
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e.response?.data?.error || 'Failed to create user');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updateUser>[1] }) =>
      updateUser(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setEditUser(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteUser,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });

  const handleCreate = () => {
    setError('');
    if (!form.staffId || !form.pin || !form.name) { setError('All required fields must be filled'); return; }
    if (form.pin.length !== 4) { setError('PIN must be 4 digits'); return; }
    createMutation.mutate({
      staffId: form.staffId.toUpperCase(),
      pin: form.pin,
      name: form.name,
      role: form.role,
      zone: form.zone || undefined,
      region: form.region || undefined,
    });
  };

  const users = data || [];
  const activeUsers = users.filter((u) => u.active);
  const inactiveUsers = users.filter((u) => !u.active);

  if (isLoading) {
    return (
      <Layout title="Admin Panel">
        <div className="flex items-center justify-center h-64">
          <div className="w-12 h-12 border-4 border-[#00843D] border-t-transparent rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Admin Panel" subtitle="User Management">
      <div className="px-4 pt-3 flex justify-end">
        <ExportButton onExport={adminExport} label="Export National Report" />
      </div>
      <div className="px-4 py-4 space-y-4">

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl p-3 text-center shadow-sm">
            <p className="text-2xl font-black text-[#00843D]">{users.length}</p>
            <p className="text-xs text-slate-500">Total</p>
          </div>
          <div className="bg-white rounded-xl p-3 text-center shadow-sm">
            <p className="text-2xl font-black text-slate-800">{activeUsers.length}</p>
            <p className="text-xs text-slate-500">Active</p>
          </div>
          <div className="bg-white rounded-xl p-3 text-center shadow-sm">
            <p className="text-2xl font-black text-red-500">{inactiveUsers.length}</p>
            <p className="text-xs text-slate-500">Inactive</p>
          </div>
        </div>

        {/* Add User Button */}
        <button
          onClick={() => { setShowAddModal(true); setForm(emptyForm); setError(''); }}
          className="w-full flex items-center justify-center gap-2 bg-[#00843D] text-white font-bold py-3 rounded-xl shadow-md hover:bg-[#006B31] active:scale-98 transition-all"
        >
          <UserPlus size={18} />
          Add New User
        </button>

        {/* User List */}
        <div className="space-y-2">
          {users.map((user) => (
            <div
              key={user.id}
              className={`bg-white rounded-xl shadow-sm p-4 ${!user.active ? 'opacity-50' : ''}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-slate-800 text-sm">{user.name}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${roleColors[user.role] || 'bg-slate-100 text-slate-600'}`}>
                      {user.role}
                    </span>
                    {!user.active && (
                      <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Inactive</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{user.staffId}</p>
                  {(user.zone || user.region) && (
                    <p className="text-xs text-slate-400 mt-0.5">{[user.zone, user.region].filter(Boolean).join(' · ')}</p>
                  )}
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button
                    onClick={() => setEditUser(user)}
                    className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm(`Deactivate ${user.name}?`)) {
                        deleteMutation.mutate(user.id);
                      }
                    }}
                    className="p-2 rounded-lg hover:bg-red-50 text-red-500 transition-colors"
                    disabled={!user.active}
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Joined {new Date(user.createdAt).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50 p-4" onClick={() => setShowAddModal(false)}>
          <div
            className="bg-white rounded-2xl w-full max-w-lg p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">Add New User</h3>
              <button onClick={() => setShowAddModal(false)} className="p-1 rounded-full hover:bg-slate-100">
                <X size={20} className="text-slate-600" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-600 mb-1 block">Staff ID *</label>
                <input
                  value={form.staffId}
                  onChange={(e) => setForm({ ...form, staffId: e.target.value.toUpperCase() })}
                  className="w-full border-2 border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#00843D]"
                  placeholder="TL-001"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600 mb-1 block">PIN (4 digits) *</label>
                <input
                  value={form.pin}
                  onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                  type="password"
                  maxLength={4}
                  className="w-full border-2 border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#00843D]"
                  placeholder="1234"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-600 mb-1 block">Full Name *</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full border-2 border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#00843D]"
                placeholder="John Doe"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-600 mb-1 block">Role *</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="w-full border-2 border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#00843D] bg-white"
                >
                  {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600 mb-1 block">Zone</label>
                <input
                  value={form.zone}
                  onChange={(e) => setForm({ ...form, zone: e.target.value })}
                  className="w-full border-2 border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#00843D]"
                  placeholder="Lusaka"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-600 mb-1 block">Region</label>
              <input
                value={form.region}
                onChange={(e) => setForm({ ...form, region: e.target.value })}
                className="w-full border-2 border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#00843D]"
                placeholder="Lusaka Central"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button
              onClick={handleCreate}
              disabled={createMutation.isPending}
              className="w-full bg-[#00843D] text-white font-bold py-3 rounded-xl hover:bg-[#006B31] transition-all flex items-center justify-center gap-2"
            >
              <Check size={18} />
              {createMutation.isPending ? 'Creating...' : 'Create User'}
            </button>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editUser && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50 p-4" onClick={() => setEditUser(null)}>
          <div
            className="bg-white rounded-2xl w-full max-w-lg p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">Edit: {editUser.name}</h3>
              <button onClick={() => setEditUser(null)} className="p-1 rounded-full hover:bg-slate-100">
                <X size={20} className="text-slate-600" />
              </button>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600 mb-1 block">Status</label>
              <div className="flex gap-2">
                <button
                  onClick={() => updateMutation.mutate({ id: editUser.id, data: { active: true } })}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold border-2 transition-all ${
                    editUser.active ? 'bg-green-50 border-green-400 text-green-700' : 'border-slate-200 text-slate-500'
                  }`}
                >
                  Active
                </button>
                <button
                  onClick={() => updateMutation.mutate({ id: editUser.id, data: { active: false } })}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold border-2 transition-all ${
                    !editUser.active ? 'bg-red-50 border-red-400 text-red-700' : 'border-slate-200 text-slate-500'
                  }`}
                >
                  Inactive
                </button>
              </div>
            </div>
            <button
              onClick={() => setEditUser(null)}
              className="w-full bg-slate-100 text-slate-700 font-semibold py-3 rounded-xl hover:bg-slate-200 transition-all"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </Layout>
  );
}
