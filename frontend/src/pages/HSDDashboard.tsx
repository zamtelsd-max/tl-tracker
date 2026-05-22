import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend } from 'recharts';
import Layout from '../components/Layout';
import StatCard from '../components/StatCard';
import MTDReport from '../components/MTDReport';
import {
  getHSDDashboard, getHSDMTD,
  hsdPatchTL, hsdDeleteTL, hsdGetTLPerformance,
  type TLPerformance,
} from '../api';
import { Globe, Trophy, TrendingDown, Target, Edit2, Trash2, BarChart2, ChevronUp, ChevronDown, X } from 'lucide-react';

const ZONE_COLORS = ['#00843D', '#E4007C', '#F59E0B', '#3B82F6', '#8B5CF6', '#EF4444'];
const ZONES = ['Lusaka-South','Lusaka North','Copperbelt','Southern','Eastern','Western','North-Western','Central','Northern','Muchinga','Luapula'];

function Spinner() {
  return (
    <div className="flex items-center justify-center h-32">
      <div className="w-10 h-10 border-4 border-[#00843D] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

// ── Edit TL Modal ────────────────────────────────────────────
function HSDEditTLModal({ tl, onClose, onSave }: {
  tl: { id: string; name: string; zone?: string };
  onClose: () => void;
  onSave: (payload: Parameters<typeof hsdPatchTL>[1]) => Promise<void>;
}) {
  const [name, setName]   = useState(tl.name);
  const [zone, setZone]   = useState(tl.zone ?? '');
  const [pin, setPin]     = useState('');
  const [target, setTarget] = useState('50');
  const [saving, setSaving] = useState(false);
  const [err, setErr]     = useState('');

  const save = async () => {
    if (pin && !/^\d{4}$/.test(pin)) { setErr('PIN must be exactly 4 digits'); return; }
    setSaving(true);
    try {
      const payload: Parameters<typeof hsdPatchTL>[1] = { name, zone };
      if (pin) payload.pin = pin;
      if (target) payload.allocatedTarget = Number(target);
      await onSave(payload);
      onClose();
    } catch (e: any) { setErr(e.message || 'Save failed'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
      <div className="bg-white rounded-t-2xl w-full max-w-md p-5 space-y-3">
        <div className="flex justify-between items-center">
          <p className="font-bold text-slate-800">Edit Team Lead</p>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        {err && <p className="text-red-500 text-sm">{err}</p>}
        <div>
          <label className="text-xs text-slate-500 font-semibold">Name</label>
          <input value={name} onChange={e => setName(e.target.value)}
            className="w-full border rounded-xl px-3 py-2 mt-1 text-sm" />
        </div>
        <div>
          <label className="text-xs text-slate-500 font-semibold">Zone</label>
          <select value={zone} onChange={e => setZone(e.target.value)}
            className="w-full border rounded-xl px-3 py-2 mt-1 text-sm">
            <option value="">— Select Zone —</option>
            {ZONES.map(z => <option key={z} value={z}>{z}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-500 font-semibold">Monthly Target</label>
          <input type="number" value={target} onChange={e => setTarget(e.target.value)}
            className="w-full border rounded-xl px-3 py-2 mt-1 text-sm" />
        </div>
        <div>
          <label className="text-xs text-slate-500 font-semibold">New PIN (4 digits, leave blank to keep)</label>
          <input value={pin} onChange={e => setPin(e.target.value)} maxLength={4}
            className="w-full border rounded-xl px-3 py-2 mt-1 text-sm" placeholder="••••" />
        </div>
        <button onClick={save} disabled={saving}
          className="w-full bg-[#00843D] text-white font-bold py-3 rounded-xl disabled:opacity-50">
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}

// ── Performance Panel ────────────────────────────────────────
function HSDTLPerfPanel({ tlId, target }: { tlId: string; target: number }) {
  const { data: perf, isLoading } = useQuery<TLPerformance>({
    queryKey: ['hsd-tl-perf', tlId],
    queryFn: () => hsdGetTLPerformance(tlId),
    staleTime: 60000,
  });
  if (isLoading) return <div className="mt-3 animate-pulse h-10 bg-slate-100 rounded-xl" />;
  if (!perf) return null;
  const attainPct = Math.min(100, Math.round((perf.monthly / Math.max(target, 1)) * 100));
  return (
    <div className="mt-3 border-t border-slate-100 pt-3">
      <div className="grid grid-cols-4 gap-1 text-center">
        {[
          { label: 'Today',     value: perf.today,     color: 'text-slate-800' },
          { label: 'Yesterday', value: perf.yesterday, color: 'text-blue-700' },
          { label: '7 Days',    value: perf.weekly,    color: 'text-purple-700' },
          { label: 'MTD',       value: perf.monthly,   color: 'text-[#00843D]' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-slate-50 rounded-lg py-1.5 px-1">
            <p className={`text-base font-black ${color}`}>{value}</p>
            <p className="text-[9px] text-slate-400">{label}</p>
          </div>
        ))}
      </div>
      <div className="mt-2">
        <div className="flex justify-between text-[10px] text-slate-400 mb-0.5">
          <span>MTD vs target ({target})</span>
          <span className={attainPct >= 80 ? 'text-green-600 font-bold' : attainPct >= 50 ? 'text-amber-600 font-bold' : 'text-red-500 font-bold'}>{attainPct}%</span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all"
            style={{ width: `${attainPct}%`, backgroundColor: attainPct >= 80 ? '#00843D' : attainPct >= 50 ? '#F59E0B' : '#DC2626' }} />
        </div>
      </div>
    </div>
  );
}

// ── TL Card with Edit / Delete / Performance ─────────────────
function TLCard({ tl, rank, onEdit, onDelete, expanded, onTogglePerf }: {
  tl: { id: string; name: string; zone?: string; activations: number; attainment: number };
  rank?: number;
  onEdit: () => void;
  onDelete: () => void;
  expanded: boolean;
  onTogglePerf: () => void;
}) {
  const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank ? `${rank}.` : null;
  const badgeColor = tl.attainment >= 80 ? 'bg-green-100 text-green-700' :
    tl.attainment >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700';

  return (
    <div className="bg-white rounded-2xl p-3 shadow-sm">
      <div className="flex items-center gap-3">
        {medal && <span className="text-xl w-8 text-center flex-shrink-0">{medal}</span>}
        <div className="flex-1 min-w-0">
          <p className="font-bold text-slate-800 text-sm truncate">{tl.name}</p>
          <p className="text-xs text-slate-500">{tl.zone ?? ''}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="font-black text-[#00843D] text-base">{tl.activations}</p>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${badgeColor}`}>{tl.attainment}%</span>
        </div>
        <div className="flex flex-col gap-1 flex-shrink-0">
          <button onClick={onEdit} title="Edit" className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100">
            <Edit2 size={12} />
          </button>
          <button onClick={onDelete} title="Unlink" className="p-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100">
            <Trash2 size={12} />
          </button>
          <button onClick={onTogglePerf} title="Performance" className="p-1.5 rounded-lg bg-purple-50 text-purple-600 hover:bg-purple-100">
            {expanded ? <ChevronUp size={12} /> : <BarChart2 size={12} />}
          </button>
        </div>
      </div>
      {expanded && <HSDTLPerfPanel tlId={tl.id} target={50} />}
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────
export default function HSDDashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'dashboard' | 'mtd' | 'leaderboard'>('dashboard');
  const [editTL, setEditTL] = useState<{ id: string; name: string; zone?: string } | null>(null);
  const [expandedPerf, setExpandedPerf] = useState<string[]>([]);

  // ── All hooks before any early return ───────────────────────
  const editMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof hsdPatchTL>[1] }) => hsdPatchTL(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['hsd-dashboard'] }),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => hsdDeleteTL(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['hsd-dashboard'] }),
  });
  const togglePerf = (id: string) => setExpandedPerf(prev =>
    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
  );

  const { data, isLoading } = useQuery({
    queryKey: ['hsd-dashboard'],
    queryFn: async () => {
      const res = await getHSDDashboard();
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    refetchInterval: 60000,
  });

  const { data: mtdData, isLoading: mtdLoading } = useQuery({
    queryKey: ['hsd-mtd'],
    queryFn: async () => {
      const res = await getHSDMTD();
      if (!res.success) throw new Error(res.error);
      return res;
    },
    refetchInterval: 300000,
  });

  if (isLoading) {
    return (
      <Layout title="HSD Dashboard">
        <div className="flex items-center justify-center h-64">
          <div className="w-12 h-12 border-4 border-[#00843D] border-t-transparent rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  const { national, zoneRankings = [], leaderboard = [], underperformers = [] } = data || {};
  const pieData = zoneRankings.slice(0, 6).map(z => ({ name: z.zone, value: z.activations }));
  const totalTarget = national?.totalTarget ?? 0;

  const handleDelete = (tl: { id: string; name: string }) => {
    if (!confirm(`Remove "${tl.name}" from their ASE?\n\nAll history preserved. TL returns to pool.`)) return;
    deleteMutation.mutate(tl.id);
  };

  return (
    <Layout title="HSD Dashboard" subtitle="National Overview">
      {/* Edit modal */}
      {editTL && (
        <HSDEditTLModal
          tl={editTL}
          onClose={() => setEditTL(null)}
          onSave={async (payload) => {
            await editMutation.mutateAsync({ id: editTL.id, data: payload });
            setEditTL(null);
          }}
        />
      )}

      {/* Tab bar */}
      <div className="flex gap-2 px-4 pt-3 pb-1">
        {(['dashboard', 'mtd', 'leaderboard'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-xl text-xs font-bold uppercase tracking-wide transition-all ${
              tab === t ? 'bg-[#00843D] text-white shadow' : 'bg-white text-slate-500 border border-slate-200'
            }`}
          >
            {t === 'dashboard' ? '📊 Today' : t === 'mtd' ? '📅 MTD' : '🏆 Ranks'}
          </button>
        ))}
      </div>

      {/* Dashboard tab */}
      {tab === 'dashboard' && (
        <div className="px-4 py-4 space-y-4">
          {national && (
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="National Activations" value={national.totalActivations.toLocaleString()}
                sub={`Target: ${national.totalTarget}`} color="green" icon={<Globe size={16} />} />
              <StatCard label="National Attainment" value={`${national.attainment}%`}
                color={national.attainment >= 80 ? 'green' : national.attainment >= 50 ? 'amber' : 'pink'}
                icon={<Target size={16} />} />
              <div className="col-span-2">
                <StatCard label="Total Teams" value={national.totalTeams}
                  sub="active team leads" color="blue" icon={<Globe size={16} />} />
              </div>
            </div>
          )}

          {pieData.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm p-4">
              <p className="text-sm font-bold text-slate-700 mb-3">Zone Distribution</p>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value">
                    {pieData.map((_, i) => <Cell key={i} fill={ZONE_COLORS[i % ZONE_COLORS.length]} />)}
                  </Pie>
                  <Legend iconType="circle" iconSize={8} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-sm p-4">
            <div className="flex items-center gap-2 mb-3">
              <Trophy size={16} className="text-[#00843D]" />
              <p className="text-sm font-bold text-slate-700">Zone Rankings</p>
            </div>
            <div className="space-y-2">
              {zoneRankings.map((zone, i) => (
                <div key={zone.zone} className="flex items-center gap-3">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${
                    i === 0 ? 'bg-yellow-100 text-yellow-700' : i === 1 ? 'bg-slate-200 text-slate-600' :
                    i === 2 ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-500'
                  }`}>{i + 1}</span>
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-0.5">
                      <span className="text-sm font-semibold text-slate-700">{zone.zone}</span>
                      <span className="text-sm font-bold text-[#00843D]">{zone.attainment}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full"
                        style={{ width: `${Math.min(100, zone.attainment)}%`,
                          backgroundColor: zone.attainment >= 80 ? '#00843D' : zone.attainment >= 50 ? '#F59E0B' : '#DC2626' }} />
                    </div>
                  </div>
                  <span className="text-xs text-slate-500">{zone.activations}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Underperformers with Edit/Delete/Perf */}
          {underperformers.length > 0 && (
            <div className="bg-red-50 border border-red-100 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <TrendingDown size={16} className="text-red-500" />
                <p className="text-sm font-bold text-red-700">Underperformers (&lt;50%) — {underperformers.length}</p>
              </div>
              <div className="space-y-2">
                {underperformers.map((tl) => (
                  <TLCard
                    key={tl.id} tl={tl}
                    onEdit={() => setEditTL({ id: tl.id, name: tl.name, zone: tl.zone })}
                    onDelete={() => handleDelete(tl)}
                    expanded={expandedPerf.includes(tl.id)}
                    onTogglePerf={() => togglePerf(tl.id)}
                  />
                ))}
              </div>
            </div>
          )}

          <button onClick={() => navigate('/leaderboard')}
            className="w-full bg-gradient-to-r from-yellow-400 to-yellow-500 text-white font-bold py-4 rounded-2xl shadow-lg flex items-center justify-center gap-2">
            <Trophy size={20} /> View Full Leaderboard
          </button>
          <a href={`${import.meta.env.VITE_API_URL || '/api'}/hsd/export?format=xlsx`}
            className="block w-full bg-[#00843D] text-white font-bold text-center py-4 rounded-2xl shadow-lg" download>
            ↓ Export to Excel
          </a>
        </div>
      )}

      {/* MTD tab */}
      {tab === 'mtd' && (
        <div className="px-4 py-4">
          {mtdLoading ? <Spinner /> : mtdData?.data ?
            <MTDReport days={mtdData.data} totalTarget={totalTarget} /> :
            <p className="text-center text-slate-500 py-8">No MTD data available</p>}
        </div>
      )}

      {/* Leaderboard tab — full list with Edit/Delete/Perf */}
      {tab === 'leaderboard' && (
        <div className="px-4 py-4 space-y-2">
          {leaderboard.length === 0 ? (
            <p className="text-center text-slate-500 py-8">No data available</p>
          ) : (
            leaderboard.map((tl, i) => (
              <TLCard
                key={tl.id} tl={tl} rank={i + 1}
                onEdit={() => setEditTL({ id: tl.id, name: tl.name, zone: tl.zone })}
                onDelete={() => handleDelete(tl)}
                expanded={expandedPerf.includes(tl.id)}
                onTogglePerf={() => togglePerf(tl.id)}
              />
            ))
          )}
        </div>
      )}
    </Layout>
  );
}
