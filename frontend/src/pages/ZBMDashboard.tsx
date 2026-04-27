import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import Layout from '../components/Layout';
import StatCard from '../components/StatCard';
import { getZBMDashboard, zbmAddTeamLead, zbmGetASEs } from '../api';
import { Map, TrendingUp, Users, Target, UserPlus, X } from 'lucide-react';

function AddTLModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [staffId, setStaffId] = useState('');
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [region, setRegion] = useState('');
  const [aseId, setAseId] = useState('');
  const [target, setTarget] = useState('50');
  const [err, setErr] = useState('');

  const { data: asesRes } = useQuery({
    queryKey: ['zbm-ases'],
    queryFn: async () => { const r = await zbmGetASEs(); return r.data ?? []; },
  });
  const ases = asesRes ?? [];

  const mutation = useMutation({
    mutationFn: () => zbmAddTeamLead({
      staffId: staffId.trim().toUpperCase(),
      name: name.trim(),
      pin,
      region: region.trim(),
      aseId: aseId || undefined,
      allocatedTarget: Number(target) || 50,
    }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['zbm-dashboard'] });
      onClose();
    },
    onError: (e: unknown) => {
      const ax = e as { response?: { data?: { error?: string } } };
      setErr(ax.response?.data?.error || 'Failed to add Team Lead');
    },
  });

  const handleSubmit = () => {
    setErr('');
    if (!staffId.trim()) { setErr('Staff ID required'); return; }
    if (!name.trim()) { setErr('Full name required'); return; }
    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) { setErr('PIN must be exactly 4 digits'); return; }
    if (!region.trim()) { setErr('Region required'); return; }
    mutation.mutate();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50">
      <div className="bg-white rounded-t-3xl w-full max-w-lg p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <UserPlus size={20} className="text-[#00843D]" /> Add Team Lead
          </h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100">
            <X size={20} className="text-slate-500" />
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-1 block">Staff ID *</label>
            <input type="text" value={staffId} onChange={e => setStaffId(e.target.value.toUpperCase())}
              placeholder="e.g. TL-CE-04"
              className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-base font-mono tracking-widest focus:outline-none focus:border-[#00843D] transition-colors" />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-1 block">Full Name *</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. John Mwila"
              className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-[#00843D] transition-colors" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-1 block">PIN * (4 digits)</label>
              <input type="password" inputMode="numeric" maxLength={4} value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="• • • •"
                className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-center text-base tracking-widest focus:outline-none focus:border-[#00843D] transition-colors" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-1 block">Daily Target</label>
              <input type="number" value={target} onChange={e => setTarget(e.target.value)} min={1} placeholder="50"
                className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-[#00843D] transition-colors" />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-1 block">Region *</label>
            <input type="text" value={region} onChange={e => setRegion(e.target.value)} placeholder="e.g. Central South"
              className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-[#00843D] transition-colors" />
          </div>
          {ases.length > 0 && (
            <div>
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-1 block">Assign to ASE (Optional)</label>
              <select value={aseId} onChange={e => setAseId(e.target.value)}
                className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-base bg-white focus:outline-none focus:border-[#00843D] transition-colors">
                <option value="">— Unassigned —</option>
                {ases.map(a => <option key={a.id} value={a.id}>{a.name} ({a.staffId})</option>)}
              </select>
            </div>
          )}
          {err && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{err}</div>}
          <button onClick={handleSubmit} disabled={mutation.isPending}
            className="w-full bg-[#00843D] hover:bg-[#006B31] disabled:bg-slate-300 text-white font-bold text-base rounded-2xl py-4 transition-all active:scale-98 mt-1">
            {mutation.isPending ? 'Creating...' : 'Create Team Lead'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ZBMDashboard() {
  const [showAddTL, setShowAddTL] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ['zbm-dashboard'],
    queryFn: async () => {
      const res = await getZBMDashboard();
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    refetchInterval: 60000,
  });

  if (isLoading) {
    return (
      <Layout title="ZBM Dashboard">
        <div className="flex items-center justify-center h-64">
          <div className="w-12 h-12 border-4 border-[#00843D] border-t-transparent rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  const { summary, teamLeads = [], heatmap = [] } = data || {};

  const getHeatColor = (val: number) => {
    if (val === 0) return '#f1f5f9';
    if (val < 3) return '#bbf7d0';
    if (val < 6) return '#4ade80';
    if (val < 10) return '#16a34a';
    return '#14532d';
  };

  const hourLabels = ['08', '09', '10', '11', '12', '13', '14', '15', '16', '17'];

  const barData = teamLeads.map((tl) => ({
    name: tl.name.split(' ').slice(-1)[0], // Last name
    activations: tl.activations,
    target: tl.target,
    attainment: tl.attainment,
  }));

  return (
    <Layout title="ZBM Dashboard" subtitle={data?.zone ? `Zone: ${data.zone}` : undefined}>
      {showAddTL && <AddTLModal onClose={() => setShowAddTL(false)} />}
      <div className="px-4 py-4 space-y-4">

        {/* Summary */}
        {summary && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <StatCard
                label="Total Activations"
                value={summary.totalActivations}
                sub={`Target: ${summary.totalTargets}`}
                color="green"
                icon={<Target size={16} />}
              />
              <StatCard
                label="Compliance Rate"
                value={`${summary.complianceRate}%`}
                color={summary.complianceRate >= 80 ? 'green' : summary.complianceRate >= 50 ? 'amber' : 'pink'}
                icon={<TrendingUp size={16} />}
              />
              <StatCard
                label="Avg Run Rate"
                value={summary.avgRunRate.toFixed(1)}
                sub="/hr"
                color="blue"
                icon={<Map size={16} />}
              />
              <StatCard
                label="Teams Below Target"
                value={summary.teamsBelow}
                sub={`of ${summary.totalTeams} teams`}
                color={summary.teamsBelow > 0 ? 'pink' : 'slate'}
                icon={<Users size={16} />}
              />
            </div>
          </>
        )}

        {/* Branch Comparison Chart */}
        {barData.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm p-4">
            <p className="text-sm font-bold text-slate-700 mb-3">Team Performance</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={barData} margin={{ top: 0, right: 0, bottom: 0, left: -10 }}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="activations" radius={[4, 4, 0, 0]}>
                  {barData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.attainment >= 80 ? '#00843D' : entry.attainment >= 50 ? '#F59E0B' : '#DC2626'}
                    />
                  ))}
                </Bar>
                <Bar dataKey="target" fill="#e2e8f0" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Hourly Heatmap */}
        {heatmap.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm p-4">
            <p className="text-sm font-bold text-slate-700 mb-3">Hourly Heatmap</p>
            {/* Hour labels */}
            <div className="flex gap-1 mb-1 pl-16">
              {hourLabels.map((h) => (
                <div key={h} className="flex-1 text-center text-[9px] text-slate-400 font-medium">{h}</div>
              ))}
            </div>
            {/* Heatmap rows */}
            <div className="space-y-1">
              {heatmap.map((row) => (
                <div key={row.name} className="flex items-center gap-1">
                  <div className="w-16 text-xs text-slate-600 truncate font-medium">
                    {row.name.split(' ').slice(-1)[0]}
                  </div>
                  {row.slots.map((slot, i) => (
                    <div
                      key={i}
                      className="flex-1 h-6 rounded"
                      style={{ backgroundColor: getHeatColor(slot.activations) }}
                      title={`${slot.slot}: ${slot.activations}`}
                    />
                  ))}
                </div>
              ))}
            </div>
            {/* Legend */}
            <div className="flex items-center gap-3 mt-3 text-xs text-slate-500">
              <span>Low</span>
              {['#f1f5f9', '#bbf7d0', '#4ade80', '#16a34a', '#14532d'].map((c) => (
                <div key={c} className="w-5 h-3 rounded" style={{ backgroundColor: c }} />
              ))}
              <span>High</span>
            </div>
          </div>
        )}

        {/* Team Lead Table */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-slate-700">Team Lead Details</p>
            <button onClick={() => setShowAddTL(true)}
              className="flex items-center gap-1 bg-[#00843D]/10 hover:bg-[#00843D]/20 text-[#00843D] text-xs font-bold px-3 py-1.5 rounded-lg transition-all">
              <UserPlus size={13} /> Add TL
            </button>
          </div>
          {teamLeads.map((tl) => (
            <div key={tl.id} className="bg-white rounded-xl shadow-sm p-4">
              <div className="flex items-center justify-between mb-1">
                <p className="font-bold text-slate-800 text-sm">{tl.name}</p>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  tl.attainment >= 80 ? 'bg-green-100 text-green-700' :
                  tl.attainment >= 50 ? 'bg-amber-100 text-amber-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {tl.attainment}%
                </span>
              </div>
              <p className="text-xs text-slate-500 mb-2">{tl.region}</p>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">{tl.activations} acts</span>
                <span className="text-[#00843D] font-semibold">{tl.runRate}/hr</span>
                <span className="text-slate-500">Target: {tl.target}</span>
              </div>
              <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(100, tl.attainment)}%`,
                    backgroundColor: tl.attainment >= 80 ? '#00843D' : tl.attainment >= 50 ? '#F59E0B' : '#DC2626',
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}
