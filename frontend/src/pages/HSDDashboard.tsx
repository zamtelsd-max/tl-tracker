import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import Layout from '../components/Layout';
import MTDReport from '../components/MTDReport';
import {
  getHSDDashboard, getHSDMTD,
  hsdPatchTL, hsdDeleteTL, hsdGetTLPerformance, type TLPerformance,
} from '../api';
import { Globe, Trophy, TrendingDown, Target, Edit2, Trash2,
         BarChart2, ChevronUp, ChevronDown, X, AlertTriangle } from 'lucide-react';

const ZONES = ['Lusaka-South','Lusaka North','Copperbelt','Southern','Eastern','Western','North-Western','Central','Northern','Muchinga','Luapula'];
const ZONE_COLORS = ['#00843D','#E4007C','#F59E0B','#3B82F6','#8B5CF6','#EF4444','#06B6D4','#84CC16','#F97316','#6366F1','#14B8A6'];

function Spinner() {
  return <div className="flex items-center justify-center h-32"><div className="w-10 h-10 border-4 border-[#00843D] border-t-transparent rounded-full animate-spin" /></div>;
}

function AttainBar({ pct }: { pct: number }) {
  const color = pct >= 80 ? '#00843D' : pct >= 50 ? '#F59E0B' : '#DC2626';
  return (
    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, pct)}%`, backgroundColor: color }} />
    </div>
  );
}

function AttainBadge({ pct }: { pct: number }) {
  const cls = pct >= 80 ? 'bg-green-100 text-green-700' : pct >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700';
  return <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cls}`}>{pct}%</span>;
}

// ── TL Performance Panel ──────────────────────────────────────
function TLPerfPanel({ tlId, target }: { tlId: string; target: number }) {
  const { data: perf, isLoading } = useQuery<TLPerformance>({
    queryKey: ['hsd-tl-perf', tlId],
    queryFn: () => hsdGetTLPerformance(tlId),
    staleTime: 60000,
  });
  if (isLoading) return <div className="mt-2 animate-pulse h-10 bg-slate-100 rounded-xl" />;
  if (!perf) return null;
  const pct = Math.min(100, Math.round((perf.monthly / Math.max(target, 1)) * 100));
  return (
    <div className="mt-2 pt-2 border-t border-slate-100">
      <div className="grid grid-cols-4 gap-1 text-center mb-2">
        {[['Today', perf.today, 'text-slate-800'], ['Yest.', perf.yesterday, 'text-blue-600'], ['7-Day', perf.weekly, 'text-purple-600'], ['MTD', perf.monthly, 'text-[#00843D]']].map(([l, v, c]) => (
          <div key={String(l)} className="bg-slate-50 rounded-lg py-1.5">
            <p className={`text-sm font-black ${c}`}>{v}</p>
            <p className="text-[9px] text-slate-400">{l}</p>
          </div>
        ))}
      </div>
      <AttainBar pct={pct} />
    </div>
  );
}

// ── Edit TL Modal ─────────────────────────────────────────────
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
    if (pin && !/^\d{4}$/.test(pin)) { setErr('PIN must be 4 digits'); return; }
    setSaving(true);
    try {
      const payload: Parameters<typeof hsdPatchTL>[1] = { name, zone };
      if (pin) payload.pin = pin;
      if (target) payload.allocatedTarget = Number(target);
      await onSave(payload); onClose();
    } catch (e: any) { setErr(e.message || 'Save failed'); }
    finally { setSaving(false); }
  };
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
      <div className="bg-white rounded-t-2xl w-full max-w-md p-5 space-y-3">
        <div className="flex justify-between items-center">
          <p className="font-bold text-slate-800">✏️ Edit Team Lead</p>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        {err && <p className="text-red-500 text-sm">{err}</p>}
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Full Name"
          className="w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00843D]" />
        <select value={zone} onChange={e => setZone(e.target.value)}
          className="w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00843D]">
          <option value="">— Select Zone —</option>
          {ZONES.map(z => <option key={z} value={z}>{z}</option>)}
        </select>
        <div className="grid grid-cols-2 gap-3">
          <input type="number" value={target} onChange={e => setTarget(e.target.value)} placeholder="Target"
            className="border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00843D]" />
          <input value={pin} onChange={e => setPin(e.target.value)} maxLength={4} placeholder="New PIN (optional)"
            className="border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00843D]" />
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 border rounded-xl text-sm font-semibold text-slate-600">Cancel</button>
          <button onClick={save} disabled={saving} className="flex-1 py-2.5 bg-[#00843D] text-white rounded-xl text-sm font-bold disabled:opacity-50">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Compact TL Row ────────────────────────────────────────────
function TLRow({ tl, onEdit, onDelete, expanded, onTogglePerf }: {
  tl: { id: string; name: string; zone?: string; activations: number; attainment: number };
  onEdit: () => void; onDelete: () => void; expanded: boolean; onTogglePerf: () => void;
}) {
  return (
    <div className={`bg-white rounded-xl px-3 py-2.5 border-l-4 ${tl.attainment >= 80 ? 'border-[#00843D]' : tl.attainment >= 50 ? 'border-amber-400' : 'border-red-500'}`}>
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-bold text-slate-800 text-sm truncate">{tl.name}</p>
          <p className="text-[11px] text-slate-400">{tl.zone ?? '—'}</p>
        </div>
        <p className="text-lg font-black text-[#00843D] flex-shrink-0">{tl.activations}</p>
        <AttainBadge pct={tl.attainment} />
        <div className="flex gap-0.5 flex-shrink-0">
          <button onClick={onEdit} className="p-1 rounded hover:bg-blue-50 text-blue-400"><Edit2 size={11} /></button>
          <button onClick={onDelete} className="p-1 rounded hover:bg-red-50 text-red-400"><Trash2 size={11} /></button>
          <button onClick={onTogglePerf} className="p-1 rounded hover:bg-purple-50 text-purple-400">
            {expanded ? <ChevronUp size={11} /> : <BarChart2 size={11} />}
          </button>
        </div>
      </div>
      <AttainBar pct={tl.attainment} />
      {expanded && <TLPerfPanel tlId={tl.id} target={50} />}
    </div>
  );
}

// ── Zone Card ─────────────────────────────────────────────────
function ZoneCard({ zone, rank, color, data, onEdit, onDelete, expandedPerf, onTogglePerf }: {
  zone: string; rank: number; color: string;
  data: { activations: number; attainment: number; teams: number; target: number };
  onEdit: (tl: any) => void; onDelete: (tl: any) => void;
  expandedPerf: string[]; onTogglePerf: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;
  const riskColor = data.attainment >= 80 ? 'border-green-300' : data.attainment >= 50 ? 'border-amber-300' : 'border-red-400';

  return (
    <div className={`bg-white rounded-2xl border-2 shadow-sm overflow-hidden ${riskColor}`}>
      <button onClick={() => setOpen(o => !o)} className="w-full px-4 py-3 text-left">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base w-7 text-center">{medal}</span>
            <div>
              <p className="font-bold text-slate-800 text-sm">{zone}</p>
              <p className="text-[11px] text-slate-400">{data.teams} teams · target {data.target}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right">
              <p className="font-black text-[#00843D] text-base leading-none">{data.activations}</p>
              <AttainBadge pct={data.attainment} />
            </div>
            <div className="w-10 h-10 rounded-full flex-shrink-0" style={{ background: `conic-gradient(${color} ${data.attainment * 3.6}deg, #f1f5f9 0deg)` }}>
              <div className="w-full h-full rounded-full flex items-center justify-center bg-white m-[3px] -ml-[0px]" style={{ width: 'calc(100% - 6px)', height: 'calc(100% - 6px)', marginLeft: '3px', marginTop: '3px' }}>
                <span className="text-[9px] font-black text-slate-600">{data.attainment}%</span>
              </div>
            </div>
            {open ? <ChevronUp size={15} className="text-slate-400" /> : <ChevronDown size={15} className="text-slate-400" />}
          </div>
        </div>
        <div className="mt-2"><AttainBar pct={data.attainment} /></div>
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
export default function HSDDashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'dashboard' | 'mtd' | 'leaderboard'>('dashboard');
  const [editTL, setEditTL] = useState<{ id: string; name: string; zone?: string } | null>(null);
  const [expandedPerf, setExpandedPerf] = useState<string[]>([]);

  // ── All hooks before early return ──────────────────────────
  const editMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof hsdPatchTL>[1] }) => hsdPatchTL(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['hsd-dashboard'] }),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => hsdDeleteTL(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['hsd-dashboard'] }),
  });
  const togglePerf = (id: string) => setExpandedPerf(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const { data, isLoading } = useQuery({
    queryKey: ['hsd-dashboard'],
    queryFn: async () => { const res = await getHSDDashboard(); if (!res.success) throw new Error(res.error); return res.data; },
    refetchInterval: 60000,
  });
  const { data: mtdData, isLoading: mtdLoading } = useQuery({
    queryKey: ['hsd-mtd'],
    queryFn: async () => { const res = await getHSDMTD(); if (!res.success) throw new Error(res.error); return res; },
    refetchInterval: 300000,
  });

  if (isLoading) return <Layout title="HSD Dashboard"><div className="flex items-center justify-center h-64"><div className="w-12 h-12 border-4 border-[#00843D] border-t-transparent rounded-full animate-spin" /></div></Layout>;

  const { national, zoneRankings = [], leaderboard = [], underperformers = [] } = data || {};
  const totalTarget = national?.totalTarget ?? 0;

  const handleDelete = (tl: { id: string; name: string }) => {
    if (!confirm(`Remove "${tl.name}"?\nAll history preserved.`)) return;
    deleteMutation.mutate(tl.id);
  };

  const pieData = zoneRankings.slice(0, 6).map((z, i) => ({ name: z.zone, value: z.activations, color: ZONE_COLORS[i] }));
  const leaderboardEntries = [...leaderboard].sort((a, b) => b.activations - a.activations);

  return (
    <Layout title="HSD Dashboard" subtitle="National Overview">
      {editTL && (
        <HSDEditTLModal tl={editTL} onClose={() => setEditTL(null)}
          onSave={async (payload) => { await editMutation.mutateAsync({ id: editTL.id, data: payload }); setEditTL(null); }} />
      )}

      {/* Tab bar */}
      <div className="flex gap-2 px-4 pt-3 pb-1">
        {(['dashboard', 'mtd', 'leaderboard'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-xl text-xs font-bold uppercase tracking-wide transition-all ${tab === t ? 'bg-[#00843D] text-white shadow' : 'bg-white text-slate-500 border border-slate-200'}`}>
            {t === 'dashboard' ? '📊 Today' : t === 'mtd' ? '📅 MTD' : '🏆 Ranks'}
          </button>
        ))}
      </div>

      {/* ── Dashboard Tab ────────────────────────────────────── */}
      {tab === 'dashboard' && (
        <div className="px-4 py-4 space-y-4">

          {/* National hero banner */}
          {national && (
            <div className="bg-gradient-to-br from-[#003366] to-[#00843D] rounded-2xl p-4 text-white shadow-lg">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-4xl font-black leading-none">{national.totalActivations.toLocaleString()}</p>
                  <p className="text-green-200 text-sm mt-1">national activations today</p>
                </div>
                {pieData.length > 0 && (
                  <div className="w-20 h-20">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" outerRadius={38} paddingAngle={2} dataKey="value" strokeWidth={0}>
                          {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-white/20">
                {[
                  { label: 'Attainment', value: `${national.attainment}%` },
                  { label: 'Target',     value: national.totalTarget.toLocaleString() },
                  { label: 'Teams',      value: national.totalTeams },
                ].map(({ label, value }) => (
                  <div key={label} className="text-center">
                    <p className="font-black text-xl">{value}</p>
                    <p className="text-green-200 text-[10px]">{label}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3">
                <AttainBar pct={national.attainment} />
              </div>
            </div>
          )}

          {/* Quick actions */}
          <div className="flex gap-2">
            <button onClick={() => navigate('/leaderboard')}
              className="flex-1 flex items-center justify-center gap-1.5 bg-gradient-to-r from-amber-400 to-yellow-400 text-white text-xs font-bold py-2.5 rounded-xl shadow">
              <Trophy size={14} /> Full Leaderboard
            </button>
            {underperformers.length > 0 && (
              <button onClick={() => setTab('leaderboard')}
                className="flex items-center gap-1 bg-red-50 text-red-600 text-xs font-bold py-2.5 px-3 rounded-xl border border-red-200">
                <AlertTriangle size={13} /> {underperformers.length} failing
              </button>
            )}
            <a href={`${import.meta.env.VITE_API_URL || '/api'}/hsd/export?format=xlsx`}
              className="flex items-center gap-1 bg-slate-100 text-slate-700 text-xs font-bold py-2.5 px-3 rounded-xl border border-slate-200" download>
              ↓ Export
            </a>
          </div>

          {/* Zone ranking cards */}
          <div>
            <p className="text-sm font-bold text-slate-700 mb-2">📍 Zone Rankings</p>
            <div className="space-y-2">
              {zoneRankings.map((zone, i) => (
                <ZoneCard
                  key={zone.zone} zone={zone.zone} rank={i + 1} color={ZONE_COLORS[i % ZONE_COLORS.length]}
                  data={{ activations: zone.activations, attainment: zone.attainment, teams: zone.teams, target: zone.target }}
                  onEdit={setEditTL} onDelete={handleDelete} expandedPerf={expandedPerf} onTogglePerf={togglePerf}
                />
              ))}
            </div>
          </div>

          {/* Underperformers strip */}
          {underperformers.length > 0 && (
            <div className="bg-red-50 border border-red-100 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <TrendingDown size={16} className="text-red-500" />
                <p className="text-sm font-bold text-red-700">⚠️ Underperformers (&lt;50%) — {underperformers.length} TLs</p>
              </div>
              <div className="space-y-2">
                {underperformers.slice(0, 8).map(tl => (
                  <TLRow key={tl.id} tl={tl}
                    onEdit={() => setEditTL({ id: tl.id, name: tl.name, zone: tl.zone })}
                    onDelete={() => handleDelete(tl)}
                    expanded={expandedPerf.includes(tl.id)} onTogglePerf={() => togglePerf(tl.id)} />
                ))}
                {underperformers.length > 8 && (
                  <p className="text-xs text-center text-red-400 pt-1">+ {underperformers.length - 8} more — see Leaderboard tab</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── MTD Tab ──────────────────────────────────────────── */}
      {tab === 'mtd' && (
        <div className="px-4 py-4">
          {mtdLoading ? <Spinner /> : mtdData?.data ?
            <MTDReport days={mtdData.data} totalTarget={totalTarget} /> :
            <p className="text-center text-slate-500 py-8">No MTD data available</p>}
        </div>
      )}

      {/* ── Leaderboard Tab ──────────────────────────────────── */}
      {tab === 'leaderboard' && (
        <div className="px-4 py-4 space-y-2">
          {leaderboardEntries.length === 0 ? (
            <p className="text-center text-slate-500 py-8">No data available</p>
          ) : (
            leaderboardEntries.map((tl, i) => {
              const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
              return (
                <div key={tl.id} className="bg-white rounded-2xl p-3 flex items-center gap-3 shadow-sm">
                  <span className="text-xl w-8 text-center flex-shrink-0">{medal}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-800 text-sm truncate">{tl.name}</p>
                    <p className="text-xs text-slate-500">{tl.zone ?? ''}</p>
                    <AttainBar pct={tl.attainment} />
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-black text-[#00843D] text-lg leading-none">{tl.activations}</p>
                    <AttainBadge pct={tl.attainment} />
                  </div>
                  <div className="flex flex-col gap-0.5 flex-shrink-0">
                    <button onClick={() => setEditTL({ id: tl.id, name: tl.name, zone: tl.zone })} className="p-1 rounded hover:bg-blue-50 text-blue-400"><Edit2 size={11} /></button>
                    <button onClick={() => handleDelete(tl)} className="p-1 rounded hover:bg-red-50 text-red-400"><Trash2 size={11} /></button>
                    <button onClick={() => togglePerf(tl.id)} className="p-1 rounded hover:bg-purple-50 text-purple-400">
                      {expandedPerf.includes(tl.id) ? <ChevronUp size={11} /> : <BarChart2 size={11} />}
                    </button>
                  </div>
                  {expandedPerf.includes(tl.id) && (
                    <div className="w-full mt-1">
                      <TLPerfPanel tlId={tl.id} target={50} />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </Layout>
  );
}
