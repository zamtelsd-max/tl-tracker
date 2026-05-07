import { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuthStore } from '../store/authStore';

const API = import.meta.env.VITE_API_URL || 'https://depcxnwq.gensparkclaw.com/tl-api/api/v1';

const ZONES = ['Lusaka North','Lusaka-South','Copperbelt','Central','Eastern','Northern','Luapula','Muchinga','North-Western','Southern','Western'];

interface TLEntry {
  id: string;
  staffId: string;
  name: string;
  zone: string | null;
  region: string | null;
  territory: string | null;
  active: boolean;
  createdAt: string;
  asTeamLead: {
    id: string;
    aseId: string | null;
    allocatedTarget: number;
    ase: { staffId: string; name: string } | null;
  } | null;
}

const emptyForm = { staffId: '', name: '', pin: '1234', zone: '', region: '', territory: '' };

export default function ListerDashboard() {
  const { token, logout } = useAuthStore();
  const [pool, setPool]   = useState<TLEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [filter, setFilter]   = useState<'all' | 'assigned' | 'unassigned'>('all');

  // Modal state
  const [mode, setMode] = useState<'add' | 'edit' | null>(null);
  const [editing, setEditing] = useState<TLEntry | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const headers = { Authorization: `Bearer ${token}` };

  const load = async () => {
    try {
      const r = await axios.get(`${API}/lister/pool`, { headers });
      setPool(r.data.data);
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setMode('add'); setEditing(null); setForm(emptyForm); setError('');
  };

  const openEdit = (tl: TLEntry) => {
    setMode('edit'); setEditing(tl); setError('');
    setForm({ staffId: tl.staffId, name: tl.name, pin: '', zone: tl.zone ?? '', region: tl.region ?? '', territory: tl.territory ?? '' });
  };

  const closeModal = () => { setMode(null); setEditing(null); setForm(emptyForm); setError(''); };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      if (mode === 'add') {
        await axios.post(`${API}/lister/pool`, form, { headers });
      } else if (mode === 'edit' && editing) {
        const payload: Record<string, string> = { name: form.name, zone: form.zone, region: form.region, territory: form.territory };
        if (form.pin) payload.pin = form.pin;
        await axios.patch(`${API}/lister/pool/${editing.id}`, payload, { headers });
      }
      closeModal(); load();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save');
    } finally { setSaving(false); }
  };

  const handleDelete = async (tl: TLEntry) => {
    if (!confirm(`Remove "${tl.name}" from the pool?\n\nThis will deactivate their login. All historical data is preserved.`)) return;
    try {
      await axios.delete(`${API}/lister/pool/${tl.id}`, { headers });
      load();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to remove TL');
    }
  };

  const filtered = pool.filter(tl => {
    const q = search.toLowerCase();
    const matchSearch = !q || tl.name.toLowerCase().includes(q) || tl.staffId.toLowerCase().includes(q) || (tl.zone ?? '').toLowerCase().includes(q);
    const matchFilter = filter === 'all' || (filter === 'assigned' ? !!tl.asTeamLead?.aseId : !tl.asTeamLead?.aseId);
    return matchSearch && matchFilter && tl.active;
  });

  const counts = {
    total: pool.filter(t => t.active).length,
    assigned: pool.filter(t => t.active && !!t.asTeamLead?.aseId).length,
    unassigned: pool.filter(t => t.active && !t.asTeamLead?.aseId).length,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-zamtel-green text-white px-4 py-3 flex items-center justify-between sticky top-0 z-30 shadow">
        <div>
          <p className="font-extrabold text-sm">TL Pool Manager</p>
          <p className="text-[10px] text-green-200">Team Lead Registry</p>
        </div>
        <button onClick={logout} className="text-xs bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-full">Logout</button>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-5 space-y-4">

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total in Pool', val: counts.total, color: 'text-zamtel-green' },
            { label: 'Assigned to ASE', val: counts.assigned, color: 'text-blue-600' },
            { label: 'Available (Free)', val: counts.unassigned, color: 'text-zamtel-pink' },
          ].map(c => (
            <div key={c.label} className="bg-white rounded-2xl border border-gray-200 p-3 text-center shadow-sm">
              <p className={`text-2xl font-extrabold ${c.color}`}>{c.val}</p>
              <p className="text-[11px] text-gray-500 leading-tight mt-0.5">{c.label}</p>
            </div>
          ))}
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-3">
          <input value={search} onChange={e => setSearch(e.target.value)}
            className="flex-1 border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zamtel-green"
            placeholder="Search name, staff ID, or zone…" />
          <div className="flex gap-2">
            {(['all', 'unassigned', 'assigned'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-2 rounded-xl text-xs font-bold border-2 transition-colors ${filter === f ? 'border-zamtel-green bg-green-50 text-zamtel-green' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                {f === 'all' ? 'All' : f === 'unassigned' ? '🟢 Free' : '🔵 Assigned'}
              </button>
            ))}
          </div>
          <button onClick={openAdd}
            className="bg-zamtel-green text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-green-800 whitespace-nowrap">
            + Add TL
          </button>
        </div>

        {/* Pool table */}
        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading pool…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-300 text-gray-400">
            <p className="text-3xl mb-2">👥</p>
            <p className="font-semibold">No Team Leads found</p>
            <p className="text-xs mt-1">Tap <strong>+ Add TL</strong> to populate the pool</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-gray-500 sticky top-0">
                  <tr>
                    {['Staff ID', 'Name', 'Zone', 'Region', 'Territory', 'Target', 'ASE', 'Status', ''].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(tl => {
                    const assigned = !!tl.asTeamLead?.aseId;
                    return (
                      <tr key={tl.id} className="border-t border-gray-100 hover:bg-gray-50">
                        <td className="px-3 py-2.5 font-mono text-gray-600">{tl.staffId}</td>
                        <td className="px-3 py-2.5 font-semibold text-gray-900">{tl.name}</td>
                        <td className="px-3 py-2.5 text-gray-500">{tl.zone ?? '—'}</td>
                        <td className="px-3 py-2.5 text-gray-500">{tl.region ?? '—'}</td>
                        <td className="px-3 py-2.5 text-gray-500">{tl.territory ?? '—'}</td>
                        <td className="px-3 py-2.5 font-bold text-gray-700">{tl.asTeamLead?.allocatedTarget ?? 50}</td>
                        <td className="px-3 py-2.5">
                          {assigned
                            ? <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold whitespace-nowrap">{tl.asTeamLead!.ase?.name ?? '—'}</span>
                            : <span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-bold">Free</span>}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${tl.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                            {tl.active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex gap-2">
                            <button onClick={() => openEdit(tl)} className="text-zamtel-green font-bold hover:underline">Edit</button>
                            {!assigned && (
                              <button onClick={() => handleDelete(tl)} className="text-red-500 font-bold hover:underline">Remove</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2 border-t text-xs text-gray-400 bg-gray-50">
              Showing {filtered.length} of {counts.total} TLs · 🔵 Assigned cannot be removed without unassigning first
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {mode && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b">
              <h2 className="font-bold text-gray-900 text-base">{mode === 'add' ? '➕ Add TL to Pool' : `✏️ Edit — ${editing?.name}`}</h2>
              <button onClick={closeModal} className="text-gray-400 text-2xl leading-none">×</button>
            </div>
            <form onSubmit={handleSave} className="px-6 py-4 space-y-3">
              {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>}

              {mode === 'add' && (
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Staff ID <span className="text-red-500">*</span></label>
                  <input value={form.staffId} onChange={e => setForm(p => ({ ...p, staffId: e.target.value.toUpperCase() }))} required
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zamtel-green font-mono"
                    placeholder="e.g. TL-LUN-001" />
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Full Name <span className="text-red-500">*</span></label>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zamtel-green"
                  placeholder="e.g. John Phiri" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Zone</label>
                  <select value={form.zone} onChange={e => setForm(p => ({ ...p, zone: e.target.value }))}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zamtel-green">
                    <option value="">— select —</option>
                    {ZONES.map(z => <option key={z}>{z}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Region</label>
                  <input value={form.region} onChange={e => setForm(p => ({ ...p, region: e.target.value }))}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zamtel-green"
                    placeholder="e.g. Lusaka Urban" />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Territory / Cluster</label>
                <input value={form.territory} onChange={e => setForm(p => ({ ...p, territory: e.target.value }))}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zamtel-green"
                  placeholder="e.g. Kalingalinga" />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">
                  PIN {mode === 'add' ? <span className="text-gray-400">(default 1234)</span> : <span className="text-gray-400">(leave blank to keep current)</span>}
                </label>
                <input type="password" value={form.pin} onChange={e => setForm(p => ({ ...p, pin: e.target.value }))}
                  maxLength={4} pattern="\d{4}"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zamtel-green"
                  placeholder="4-digit PIN" />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={closeModal}
                  className="flex-1 py-3 border border-gray-300 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-3 bg-zamtel-green text-white rounded-xl text-sm font-bold hover:bg-green-800 disabled:opacity-60">
                  {saving ? 'Saving…' : mode === 'add' ? 'Add to Pool' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
