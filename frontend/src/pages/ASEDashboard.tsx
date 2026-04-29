import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, TrendingUp, AlertTriangle, Activity, UserPlus, X, Trophy, Search, CheckCircle2, Link } from 'lucide-react';
import Layout from '../components/Layout';
import StatCard from '../components/StatCard';
import { getASEDashboard, getASEAlerts, aseAddTeamLead, aseGetAvailableTLs, aseLinkTeamLead } from '../api';
import type { TLSummary } from '../types';

function StatusBadge({ status }: { status: TLSummary['status'] }) {
  const map = {
    'on-track': 'bg-green-100 text-green-700',
    'at-risk': 'bg-amber-100 text-amber-700',
    'critical': 'bg-red-100 text-red-700',
  };
  const labels = { 'on-track': 'On Track', 'at-risk': 'At Risk', 'critical': 'Critical' };
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${map[status]}`}>
      {labels[status]}
    </span>
  );
}

function AddTLModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<'select' | 'create'>('select');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState('');
  // create fields
  const [staffId, setStaffId] = useState('');
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [region, setRegion] = useState('');
  const [target, setTarget] = useState('50');
  const [err, setErr] = useState('');

  const { data: availableTLs = [], isLoading: loadingTLs } = useQuery({
    queryKey: ['ase-available-tls'],
    queryFn: aseGetAvailableTLs,
  });

  const filteredTLs = availableTLs.filter(tl =>
    tl.user.name.toLowerCase().includes(search.toLowerCase()) ||
    tl.user.staffId.toLowerCase().includes(search.toLowerCase()) ||
    (tl.region || '').toLowerCase().includes(search.toLowerCase())
  );

  const linkMutation = useMutation({
    mutationFn: () => aseLinkTeamLead(selectedId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['ase-dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['ase-available-tls'] });
      onClose();
    },
    onError: (e: unknown) => {
      const ax = e as { response?: { data?: { error?: string } } };
      setErr(ax.response?.data?.error || 'Failed to link Team Lead');
    },
  });

  const createMutation = useMutation({
    mutationFn: () => aseAddTeamLead({
      staffId: staffId.trim().toUpperCase(),
      name: name.trim(),
      pin,
      region: region.trim(),
      allocatedTarget: Number(target) || 50,
    }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['ase-dashboard'] });
      onClose();
    },
    onError: (e: unknown) => {
      const ax = e as { response?: { data?: { error?: string } } };
      setErr(ax.response?.data?.error || 'Failed to add Team Lead');
    },
  });

  const handleSubmit = () => {
    setErr('');
    if (mode === 'select') {
      if (!selectedId) { setErr('Select a Team Lead'); return; }
      linkMutation.mutate();
    } else {
      if (!staffId.trim()) { setErr('Staff ID required'); return; }
      if (!name.trim()) { setErr('Full name required'); return; }
      if (pin.length !== 4 || !/^\d{4}$/.test(pin)) { setErr('PIN must be exactly 4 digits'); return; }
      if (!region.trim()) { setErr('Region required'); return; }
      createMutation.mutate();
    }
  };

  const isPending = linkMutation.isPending || createMutation.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50">
      <div className="bg-white rounded-t-3xl w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 flex-shrink-0">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <UserPlus size={20} className="text-[#00843D]" /> Add Team Lead
          </h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100">
            <X size={20} className="text-slate-500" />
          </button>
        </div>

        {/* Mode tabs */}
        <div className="flex gap-1 mx-6 mb-4 bg-slate-100 p-1 rounded-xl flex-shrink-0">
          <button onClick={() => setMode('select')}
            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${mode === 'select' ? 'bg-white text-[#00843D] shadow' : 'text-slate-500'}`}>
            <Link size={14} /> Select Existing TL
          </button>
          <button onClick={() => setMode('create')}
            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${mode === 'create' ? 'bg-white text-[#00843D] shadow' : 'text-slate-500'}`}>
            <UserPlus size={14} /> Create New TL
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6">
          {mode === 'select' ? (
            <div className="space-y-3 pb-4">
              {/* Search */}
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search by name, ID or region..."
                  className="w-full pl-9 pr-4 py-3 border-2 border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#00843D]" />
              </div>

              {loadingTLs ? (
                <div className="text-center py-8 text-slate-400 text-sm">Loading team leads...</div>
              ) : filteredTLs.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm">No available team leads found</div>
              ) : (
                <div className="space-y-2">
                  {filteredTLs.map(tl => (
                    <button key={tl.id} onClick={() => setSelectedId(tl.id)}
                      className={`w-full text-left p-3 rounded-2xl border-2 transition-all ${selectedId === tl.id ? 'border-[#00843D] bg-green-50' : 'border-slate-100 bg-slate-50 hover:border-slate-300'}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-bold text-slate-800 text-sm">{tl.user.name}</p>
                          <p className="text-xs text-slate-500">{tl.user.staffId}{tl.region ? ` · ${tl.region}` : ''}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{tl._count.dsas} DSAs · Target: {tl.allocatedTarget}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          {tl.aseId ? (
                            <span className="text-xs bg-[#00843D] text-white px-2 py-0.5 rounded-full">Already yours</span>
                          ) : (
                            <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">Unassigned</span>
                          )}
                          {selectedId === tl.id && <CheckCircle2 size={18} className="text-[#00843D]" />}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3 pb-4">
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-1 block">Staff ID *</label>
                <input type="text" value={staffId} onChange={e => setStaffId(e.target.value.toUpperCase())}
                  placeholder="e.g. TL-CB-02"
                  className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-[#00843D] font-mono tracking-widest" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-1 block">Full Name *</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)}
                  placeholder="e.g. John Mwila"
                  className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-[#00843D]" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-1 block">PIN * (4 digits)</label>
                  <input type="password" inputMode="numeric" maxLength={4} value={pin}
                    onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="• • • •"
                    className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-base text-center tracking-widest focus:outline-none focus:border-[#00843D]" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-1 block">Daily Target</label>
                  <input type="number" value={target} onChange={e => setTarget(e.target.value)}
                    min={1} placeholder="50"
                    className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-[#00843D]" />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-1 block">Region *</label>
                <input type="text" value={region} onChange={e => setRegion(e.target.value)}
                  placeholder="e.g. Lusaka Central"
                  className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-[#00843D]" />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 pt-2 flex-shrink-0">
          {err && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-3">{err}</div>}
          <button onClick={handleSubmit} disabled={isPending}
            className="w-full bg-[#00843D] hover:bg-[#006B31] disabled:bg-slate-300 text-white font-bold text-base rounded-2xl py-4 transition-all active:scale-98">
            {isPending ? 'Saving...' : mode === 'select' ? 'Add to My Team' : 'Create Team Lead'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ASEDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'teams' | 'alerts'>('teams');
  const [showAddTL, setShowAddTL] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['ase-dashboard'],
    queryFn: async () => {
      const res = await getASEDashboard();
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    refetchInterval: 60000,
  });

  const { data: alertsRes } = useQuery({
    queryKey: ['ase-alerts'],
    queryFn: async () => {
      const res = await getASEAlerts();
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
  });

  if (isLoading) {
    return (
      <Layout title="ASE Dashboard">
        <div className="flex items-center justify-center h-64">
          <div className="w-12 h-12 border-4 border-[#00843D] border-t-transparent rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  const summary = data?.summary;
  const teamLeads = data?.teamLeads || [];
  const alerts = alertsRes || [];

  const alertTypeMap: Record<string, string> = {
    ZERO_ACTIVITY: '⚠️', MISSED_TARGET: '📉', END_OF_DAY: '📋', ESCALATION: '🚨',
  };

  return (
    <Layout title="ASE Dashboard">
      {showAddTL && <AddTLModal onClose={() => setShowAddTL(false)} />}

      <div className="px-4 py-4 space-y-4">

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Total Activations" value={summary.totalActivations} color="green" icon={<Activity size={16} />} />
            <StatCard label="Teams Active" value={`${summary.teamsWithActivity}/${summary.totalTeams}`} color="blue" icon={<Users size={16} />} />
            <StatCard label="Avg Run Rate" value={summary.avgRunRate.toFixed(1)} sub="per hour" color="amber" icon={<TrendingUp size={16} />} />
            <StatCard label="Exceptions" value={summary.exceptions} sub="alerts today" color={summary.exceptions > 0 ? 'pink' : 'slate'} icon={<AlertTriangle size={16} />} />
          </div>
        )}

        {/* Leaderboard shortcut */}
        <button onClick={() => navigate('/leaderboard')}
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-white font-bold py-3 rounded-2xl shadow transition-all active:scale-98">
          <Trophy size={18} /> Team Leaderboard
        </button>

        {/* Tabs */}
        <div className="flex gap-1 bg-slate-200 p-1 rounded-xl">
          <button onClick={() => setActiveTab('teams')}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'teams' ? 'bg-white text-[#00843D] shadow' : 'text-slate-600'}`}>
            Team Leads ({teamLeads.length})
          </button>
          <button onClick={() => setActiveTab('alerts')}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'alerts' ? 'bg-white text-[#E4007C] shadow' : 'text-slate-600'}`}>
            Alerts {alerts.length > 0 && `(${alerts.length})`}
          </button>
        </div>

        {/* Team Leads */}
        {activeTab === 'teams' && (
          <div className="space-y-3">
            {/* Add TL button */}
            <button onClick={() => setShowAddTL(true)}
              className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-[#00843D]/40 text-[#00843D] font-bold py-3 rounded-2xl hover:bg-[#00843D]/5 transition-all">
              <UserPlus size={18} /> Add Team Lead
            </button>

            {teamLeads.map((tl) => (
              <div key={tl.id} className="bg-white rounded-xl shadow-sm p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-bold text-slate-800 text-sm">{tl.name}</p>
                    <p className="text-xs text-slate-500">{tl.zone} · {tl.region}</p>
                  </div>
                  <StatusBadge status={tl.status} />
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-lg font-black text-slate-800">{tl.activations}</p>
                    <p className="text-xs text-slate-500">Acts</p>
                  </div>
                  <div>
                    <p className="text-lg font-black text-[#00843D]">{tl.runRate}</p>
                    <p className="text-xs text-slate-500">Run rate</p>
                  </div>
                  <div>
                    <p className="text-lg font-black text-slate-800">{tl.attainment}%</p>
                    <p className="text-xs text-slate-500">Attainment</p>
                  </div>
                </div>
                <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full"
                    style={{ width: `${Math.min(100, tl.attainment)}%`, backgroundColor: tl.status === 'on-track' ? '#00843D' : tl.status === 'at-risk' ? '#F59E0B' : '#DC2626' }} />
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-xs text-slate-400">{tl.dsaCount} DSAs</span>
                  <span className="text-xs text-slate-400">Target: {tl.target}</span>
                </div>
              </div>
            ))}

            {teamLeads.length === 0 && (
              <div className="text-center py-8 text-slate-500">
                <Users size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">No team leads yet — add one above</p>
              </div>
            )}
          </div>
        )}

        {/* Alerts */}
        {activeTab === 'alerts' && (
          <div className="space-y-3">
            {alerts.map((alert) => (
              <div key={alert.id}
                className={`bg-white rounded-xl shadow-sm p-4 border-l-4 ${
                  alert.type === 'ESCALATION' ? 'border-red-500' :
                  alert.type === 'MISSED_TARGET' ? 'border-amber-500' :
                  alert.type === 'ZERO_ACTIVITY' ? 'border-orange-400' : 'border-blue-400'
                }`}>
                <div className="flex items-start gap-2">
                  <span className="text-lg">{alertTypeMap[alert.type] || '📌'}</span>
                  <div className="flex-1">
                    <p className="text-sm text-slate-700">{alert.message}</p>
                    <p className="text-xs text-slate-400 mt-1">{new Date(alert.createdAt).toLocaleString()}</p>
                  </div>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                    alert.status === 'SENT' ? 'bg-blue-100 text-blue-700' :
                    alert.status === 'READ' ? 'bg-slate-100 text-slate-600' : 'bg-green-100 text-green-700'
                  }`}>{alert.status}</span>
                </div>
              </div>
            ))}
            {alerts.length === 0 && (
              <div className="text-center py-8 text-slate-500">
                <Activity size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">No alerts</p>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
