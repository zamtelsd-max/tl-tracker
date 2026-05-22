import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { Users, TrendingUp, AlertTriangle, Activity, UserPlus, X, Trophy,
         Search, CheckCircle2, Link, Pencil, Trash2, ChevronDown, ChevronUp,
         BarChart2, ChevronRight } from 'lucide-react';
import Layout from '../components/Layout';
import MTDReport from '../components/MTDReport';
import { getASEDashboard, getASEAlerts, aseAddTeamLead, aseGetAvailableTLs, aseLinkTeamLead, getASEMTD,
         asePatchTL, aseDeleteTL, aseGetTLPerformance, type TLPerformance } from '../api';
import type { TLSummary } from '../types';

const ZONES_LIST = ['Lusaka North','Lusaka-South','Copperbelt','Central','Eastern','Northern','Luapula','Muchinga','North-Western','Southern','Western'];

// ── Helpers ───────────────────────────────────────────────────
function StatusBadge({ status }: { status: TLSummary['status'] }) {
  const map = { 'on-track': 'bg-green-100 text-green-700', 'at-risk': 'bg-amber-100 text-amber-700', 'critical': 'bg-red-100 text-red-700' };
  const labels = { 'on-track': '✓ On Track', 'at-risk': '⚠ At Risk', 'critical': '🔴 Critical' };
  return <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${map[status]}`}>{labels[status]}</span>;
}

function AttainBar({ pct }: { pct: number }) {
  const color = pct >= 80 ? '#00843D' : pct >= 50 ? '#F59E0B' : '#DC2626';
  return (
    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, pct)}%`, backgroundColor: color }} />
    </div>
  );
}

function Spinner() {
  return <div className="flex items-center justify-center h-32"><div className="w-10 h-10 border-4 border-[#00843D] border-t-transparent rounded-full animate-spin" /></div>;
}

// ── Performance Panel ─────────────────────────────────────────
function TLPerfPanel({ tlId, target }: { tlId: string; target: number }) {
  const { data: perf, isLoading } = useQuery<TLPerformance>({
    queryKey: ['ase-tl-perf', tlId],
    queryFn: () => aseGetTLPerformance(tlId),
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
      <div className="flex justify-between text-[10px] text-slate-400 mb-0.5">
        <span>MTD vs target ({target})</span>
        <span className={pct >= 80 ? 'text-green-600 font-bold' : pct >= 50 ? 'text-amber-600 font-bold' : 'text-red-500 font-bold'}>{pct}%</span>
      </div>
      <AttainBar pct={pct} />
    </div>
  );
}

// ── Compact TL Row ────────────────────────────────────────────
function TLRow({ tl, onEdit, onDelete, expanded, onTogglePerf }: {
  tl: TLSummary;
  onEdit: () => void;
  onDelete: () => void;
  expanded: boolean;
  onTogglePerf: () => void;
}) {
  return (
    <div className={`bg-white rounded-xl px-3 py-2.5 border-l-4 ${
      tl.status === 'on-track' ? 'border-[#00843D]' : tl.status === 'at-risk' ? 'border-amber-400' : 'border-red-500'
    }`}>
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="font-bold text-slate-800 text-sm truncate">{tl.name}</p>
            <StatusBadge status={tl.status} />
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">{tl.staffId} · {tl.region ?? tl.zone ?? '—'}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-lg font-black text-[#00843D] leading-none">{tl.activations}</p>
          <p className="text-[10px] text-slate-400">{tl.attainment}% · {tl.runRate}/hr</p>
        </div>
        <div className="flex flex-col gap-0.5 flex-shrink-0">
          <button onClick={onEdit} className="p-1 rounded hover:bg-blue-50 text-blue-400"><Pencil size={11} /></button>
          <button onClick={onDelete} className="p-1 rounded hover:bg-red-50 text-red-400"><Trash2 size={11} /></button>
          <button onClick={onTogglePerf} className="p-1 rounded hover:bg-purple-50 text-purple-400">
            {expanded ? <ChevronUp size={11} /> : <BarChart2 size={11} />}
          </button>
        </div>
      </div>
      <div className="mt-1.5"><AttainBar pct={tl.attainment} /></div>
      {expanded && <TLPerfPanel tlId={tl.id} target={tl.target} />}
    </div>
  );
}

// ── Status Group ──────────────────────────────────────────────
function StatusGroup({ label, color, tls, onEdit, onDelete, expandedPerf, onTogglePerf }: {
  label: string; color: string; tls: TLSummary[];
  onEdit: (tl: TLSummary) => void; onDelete: (tl: TLSummary) => void;
  expandedPerf: string[]; onTogglePerf: (id: string) => void;
}) {
  const [open, setOpen] = useState(true);
  if (tls.length === 0) return null;
  return (
    <div className="rounded-2xl overflow-hidden border border-slate-100 shadow-sm">
      <button onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between px-4 py-3 ${color}`}>
        <span className="font-bold text-sm">{label} <span className="opacity-70">({tls.length})</span></span>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {open && (
        <div className="divide-y divide-slate-50 bg-slate-50">
          {tls.map(tl => (
            <div key={tl.id} className="p-2">
              <TLRow tl={tl} onEdit={() => onEdit(tl)} onDelete={() => onDelete(tl)}
                expanded={expandedPerf.includes(tl.id)} onTogglePerf={() => onTogglePerf(tl.id)} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Add TL Modal ──────────────────────────────────────────────
function AddTLModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<'select' | 'create'>('select');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [staffId, setStaffId] = useState('');
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [region, setRegion] = useState('');
  const [target, setTarget] = useState('50');
  const [err, setErr] = useState('');

  const { data: availableTLs = [], isLoading: loadingTLs } = useQuery({ queryKey: ['ase-available-tls'], queryFn: aseGetAvailableTLs });
  const filteredTLs = availableTLs.filter(tl => tl.pickable && (
    tl.user.name.toLowerCase().includes(search.toLowerCase()) ||
    tl.user.staffId.toLowerCase().includes(search.toLowerCase()) ||
    (tl.region || '').toLowerCase().includes(search.toLowerCase())
  ));

  const linkMutation = useMutation({ mutationFn: () => aseLinkTeamLead(selectedId),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['ase-dashboard'] }); void queryClient.invalidateQueries({ queryKey: ['ase-available-tls'] }); onClose(); },
    onError: (e: any) => setErr(e.response?.data?.error || 'Failed to link TL'),
  });
  const createMutation = useMutation({
    mutationFn: () => aseAddTeamLead({ staffId: staffId.trim().toUpperCase(), name: name.trim(), pin, region: region.trim(), allocatedTarget: Number(target) || 50 }),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['ase-dashboard'] }); onClose(); },
    onError: (e: any) => setErr(e.response?.data?.error || 'Failed to create TL'),
  });

  const submit = () => {
    setErr('');
    if (mode === 'select') { if (!selectedId) { setErr('Select a TL'); return; } linkMutation.mutate(); }
    else {
      if (!staffId.trim()) { setErr('Staff ID required'); return; }
      if (!name.trim()) { setErr('Name required'); return; }
      if (!/^\d{4}$/.test(pin)) { setErr('PIN must be 4 digits'); return; }
      if (!region.trim()) { setErr('Region required'); return; }
      createMutation.mutate();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60">
      <div className="bg-white rounded-t-3xl w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0">
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2"><UserPlus size={18} className="text-[#00843D]" /> Add Team Lead</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100"><X size={18} /></button>
        </div>
        <div className="flex gap-1 mx-5 mb-3 bg-slate-100 p-1 rounded-xl flex-shrink-0">
          {(['select', 'create'] as const).map(m => (
            <button key={m} onClick={() => setMode(m)}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${mode === m ? 'bg-white text-[#00843D] shadow' : 'text-slate-500'}`}>
              {m === 'select' ? <><Link size={12} /> Select Existing</> : <><UserPlus size={12} /> Create New</>}
            </button>
          ))}
        </div>
        <div className="overflow-y-auto flex-1 px-5">
          {mode === 'select' ? (
            <div className="space-y-2 pb-4">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name / ID / region…"
                  className="w-full pl-8 pr-3 py-2.5 border-2 border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#00843D]" />
              </div>
              {loadingTLs ? <div className="text-center py-6 text-slate-400 text-sm">Loading…</div>
                : filteredTLs.length === 0 ? <div className="text-center py-6 text-slate-400 text-sm">No TLs available</div>
                : filteredTLs.map(tl => (
                  <button key={tl.id} onClick={() => setSelectedId(tl.id)}
                    className={`w-full text-left p-3 rounded-xl border-2 transition-all ${selectedId === tl.id ? 'border-[#00843D] bg-green-50' : 'border-slate-100 bg-slate-50 hover:border-slate-300'}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-bold text-slate-800 text-sm">{tl.user.name}</p>
                        <p className="text-xs text-slate-500">{tl.user.staffId}{tl.region ? ` · ${tl.region}` : ''}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {tl.mine ? <span className="text-xs bg-[#00843D] text-white px-2 py-0.5 rounded-full">✓ Yours</span>
                          : <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">Available</span>}
                        {selectedId === tl.id && <CheckCircle2 size={16} className="text-[#00843D]" />}
                      </div>
                    </div>
                  </button>
                ))}
            </div>
          ) : (
            <div className="space-y-3 pb-4">
              {[['Staff ID *', staffId, (v: string) => setStaffId(v.toUpperCase()), 'TL-CB-02', 'font-mono tracking-widest'],
                ['Full Name *', name, setName, 'John Mwila', '']].map(([label, val, set, ph, extra]) => (
                <div key={String(label)}>
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-1 block">{label}</label>
                  <input value={String(val)} onChange={e => (set as (v: string) => void)(e.target.value)} placeholder={String(ph)}
                    className={`w-full border-2 border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#00843D] ${extra}`} />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-1 block">PIN * (4 digits)</label>
                  <input type="password" inputMode="numeric" maxLength={4} value={pin}
                    onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="••••"
                    className="w-full border-2 border-slate-200 rounded-xl px-3 py-2.5 text-sm text-center tracking-widest focus:outline-none focus:border-[#00843D]" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-1 block">Target</label>
                  <input type="number" value={target} onChange={e => setTarget(e.target.value)} min={1} placeholder="50"
                    className="w-full border-2 border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#00843D]" />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-1 block">Region *</label>
                <input value={region} onChange={e => setRegion(e.target.value)} placeholder="e.g. Lusaka Central"
                  className="w-full border-2 border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#00843D]" />
              </div>
            </div>
          )}
        </div>
        <div className="px-5 pb-6 pt-2 flex-shrink-0">
          {err && <p className="text-red-600 text-sm bg-red-50 rounded-xl px-3 py-2 mb-3">{err}</p>}
          <button onClick={submit} disabled={linkMutation.isPending || createMutation.isPending}
            className="w-full bg-[#00843D] text-white font-bold text-sm rounded-2xl py-3.5 disabled:opacity-50">
            {linkMutation.isPending || createMutation.isPending ? 'Saving…' : mode === 'select' ? 'Add to My Team' : 'Create Team Lead'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Edit TL Modal ─────────────────────────────────────────────
function EditTLModal({ tl, onClose, onSave }: {
  tl: TLSummary; onClose: () => void;
  onSave: (data: { name: string; zone: string; region: string; allocatedTarget: number; pin?: string }) => Promise<void>;
}) {
  const [name, setName] = useState(tl.name);
  const [zone, setZone] = useState(tl.zone ?? '');
  const [region, setRegion] = useState(tl.region ?? '');
  const [target, setTarget] = useState(String(tl.target ?? 50));
  const [pin, setPin] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    if (!name.trim()) { setErr('Name required'); return; }
    if (pin && !/^\d{4}$/.test(pin)) { setErr('PIN must be 4 digits'); return; }
    setSaving(true);
    try { await onSave({ name: name.trim(), zone, region, allocatedTarget: Number(target) || 50, pin: pin || undefined }); onClose(); }
    catch (e: any) { setErr(e?.response?.data?.error ?? 'Save failed'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center" onClick={onClose}>
      <div className="bg-white rounded-t-2xl w-full max-w-md p-5 space-y-3" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-slate-800">✏️ Edit Team Lead</h2>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        {err && <p className="text-red-600 text-sm bg-red-50 rounded-xl px-3 py-2">{err}</p>}
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Full Name"
          className="w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00843D]" />
        <div className="grid grid-cols-2 gap-3">
          <select value={zone} onChange={e => setZone(e.target.value)}
            className="border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00843D]">
            <option value="">— Zone —</option>
            {ZONES_LIST.map(z => <option key={z}>{z}</option>)}
          </select>
          <input value={region} onChange={e => setRegion(e.target.value)} placeholder="Region"
            className="border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00843D]" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <input type="number" value={target} onChange={e => setTarget(e.target.value)} placeholder="Target"
            className="border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00843D]" />
          <input type="password" value={pin} onChange={e => setPin(e.target.value)} maxLength={4} placeholder="New PIN (optional)"
            className="border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00843D]" />
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 border rounded-xl text-sm font-semibold text-slate-600">Cancel</button>
          <button onClick={submit} disabled={saving} className="flex-1 py-2.5 bg-[#00843D] text-white rounded-xl text-sm font-bold disabled:opacity-50">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
export default function ASEDashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'dashboard' | 'mtd' | 'leaderboard'>('dashboard');
  const [showAddTL, setShowAddTL] = useState(false);
  const [editTL, setEditTL] = useState<TLSummary | null>(null);
  const [expandedPerf, setExpandedPerf] = useState<string[]>([]);

  // ── All hooks before any early return ──────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ['ase-dashboard'],
    queryFn: async () => { const res = await getASEDashboard(); if (!res.success) throw new Error(res.error); return res.data; },
    refetchInterval: 60000,
  });
  const { data: alertsRes } = useQuery({
    queryKey: ['ase-alerts'],
    queryFn: async () => { const res = await getASEAlerts(); if (!res.success) throw new Error(res.error); return res.data; },
  });
  const { data: mtdData, isLoading: mtdLoading } = useQuery({
    queryKey: ['ase-mtd'],
    queryFn: async () => { const res = await getASEMTD(); if (!res.success) throw new Error(res.error); return res; },
    refetchInterval: 300000,
  });
  const editMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof asePatchTL>[1] }) => asePatchTL(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ase-dashboard'] }),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => aseDeleteTL(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ase-dashboard'] }),
  });
  const togglePerf = (id: string) => setExpandedPerf(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const handleDelete = (tl: TLSummary) => {
    if (!confirm(`Remove "${tl.name}" from your team?\nAll history preserved.`)) return;
    deleteMutation.mutate(tl.id);
  };

  if (isLoading) return <Layout title="ASE Dashboard"><div className="flex items-center justify-center h-64"><div className="w-12 h-12 border-4 border-[#00843D] border-t-transparent rounded-full animate-spin" /></div></Layout>;

  const { summary, teamLeads = [] } = data || {};
  const alerts = alertsRes || [];
  const totalTarget = teamLeads.reduce((s, t) => s + t.target, 0);

  const onTrack  = teamLeads.filter(t => t.status === 'on-track');
  const atRisk   = teamLeads.filter(t => t.status === 'at-risk');
  const critical = teamLeads.filter(t => t.status === 'critical');

  const pieData = [
    { name: 'On Track', value: onTrack.length, color: '#00843D' },
    { name: 'At Risk',  value: atRisk.length,  color: '#F59E0B' },
    { name: 'Critical', value: critical.length, color: '#DC2626' },
  ].filter(d => d.value > 0);

  const leaderboardEntries = [...teamLeads].sort((a, b) => b.activations - a.activations);

  return (
    <Layout title="ASE Dashboard">
      {showAddTL && <AddTLModal onClose={() => { setShowAddTL(false); queryClient.invalidateQueries({ queryKey: ['ase-dashboard'] }); }} />}
      {editTL && (
        <EditTLModal tl={editTL} onClose={() => setEditTL(null)}
          onSave={async (d) => { await editMutation.mutateAsync({ id: editTL.id, data: d }); setEditTL(null); }} />
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
          {/* Header card with donut + stats */}
          {summary && (
            <div className="bg-gradient-to-br from-[#00843D] to-[#006B31] rounded-2xl p-4 text-white shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-black">{summary.totalActivations}</p>
                  <p className="text-green-200 text-sm">activations today</p>
                  <div className="flex gap-3 mt-3">
                    <div>
                      <p className="text-xl font-bold">{summary.teamsWithActivity}<span className="text-green-200 text-xs">/{summary.totalTeams}</span></p>
                      <p className="text-green-200 text-[10px]">teams active</p>
                    </div>
                    <div>
                      <p className="text-xl font-bold">{summary.avgRunRate.toFixed(1)}</p>
                      <p className="text-green-200 text-[10px]">avg run/hr</p>
                    </div>
                    {summary.exceptions > 0 && (
                      <div>
                        <p className="text-xl font-bold text-red-300">{summary.exceptions}</p>
                        <p className="text-green-200 text-[10px]">alerts</p>
                      </div>
                    )}
                  </div>
                </div>
                {pieData.length > 0 && (
                  <div className="relative w-24 h-24">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={28} outerRadius={42} paddingAngle={2} dataKey="value" strokeWidth={0}>
                          {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-white font-black text-sm">{teamLeads.length}</span>
                    </div>
                  </div>
                )}
              </div>
              {/* Legend */}
              <div className="flex gap-3 mt-3 pt-3 border-t border-green-600">
                <span className="flex items-center gap-1 text-xs"><span className="w-2 h-2 rounded-full bg-white inline-block" />{onTrack.length} On Track</span>
                <span className="flex items-center gap-1 text-xs"><span className="w-2 h-2 rounded-full bg-amber-300 inline-block" />{atRisk.length} At Risk</span>
                <span className="flex items-center gap-1 text-xs"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" />{critical.length} Critical</span>
              </div>
            </div>
          )}

          {/* Quick actions */}
          <div className="flex gap-2">
            <button onClick={() => setShowAddTL(true)}
              className="flex-1 flex items-center justify-center gap-1.5 border-2 border-dashed border-[#00843D]/40 text-[#00843D] text-xs font-bold py-2.5 rounded-xl hover:bg-green-50">
              <UserPlus size={14} /> Add TL
            </button>
            <button onClick={() => navigate('/leaderboard')}
              className="flex-1 flex items-center justify-center gap-1.5 bg-gradient-to-r from-amber-400 to-yellow-400 text-white text-xs font-bold py-2.5 rounded-xl shadow">
              <Trophy size={14} /> Leaderboard
            </button>
            {alerts.length > 0 && (
              <button className="flex items-center gap-1 bg-red-50 text-red-600 text-xs font-bold py-2.5 px-3 rounded-xl border border-red-200">
                <AlertTriangle size={14} /> {alerts.length}
              </button>
            )}
          </div>

          {/* Grouped TL list */}
          <div className="space-y-3">
            <StatusGroup label="🔴 Critical" color="bg-red-50 text-red-700 hover:bg-red-100"
              tls={critical} onEdit={setEditTL} onDelete={handleDelete} expandedPerf={expandedPerf} onTogglePerf={togglePerf} />
            <StatusGroup label="⚠️ At Risk" color="bg-amber-50 text-amber-700 hover:bg-amber-100"
              tls={atRisk} onEdit={setEditTL} onDelete={handleDelete} expandedPerf={expandedPerf} onTogglePerf={togglePerf} />
            <StatusGroup label="✅ On Track" color="bg-green-50 text-green-700 hover:bg-green-100"
              tls={onTrack} onEdit={setEditTL} onDelete={handleDelete} expandedPerf={expandedPerf} onTogglePerf={togglePerf} />
            {teamLeads.length === 0 && (
              <div className="text-center py-10 text-slate-400">
                <Users size={36} className="mx-auto mb-2 opacity-20" />
                <p className="text-sm">No team leads yet</p>
                <button onClick={() => setShowAddTL(true)} className="mt-3 text-[#00843D] font-bold text-sm underline">Add one now</button>
              </div>
            )}
          </div>
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
          {leaderboardEntries.map((tl, i) => {
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
            return (
              <div key={tl.id} className="bg-white rounded-2xl p-3 flex items-center gap-3 shadow-sm">
                <span className="text-xl w-8 text-center flex-shrink-0">{medal}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-800 text-sm truncate">{tl.name}</p>
                  <p className="text-xs text-slate-500">{tl.zone ?? ''}{tl.region ? ` · ${tl.region}` : ''}</p>
                  <AttainBar pct={tl.attainment} />
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-black text-[#00843D] text-lg leading-none">{tl.activations}</p>
                  <StatusBadge status={tl.status} />
                </div>
                <div className="flex flex-col gap-0.5 flex-shrink-0">
                  <button onClick={() => setEditTL(tl)} className="p-1 rounded hover:bg-blue-50 text-blue-400"><Pencil size={11} /></button>
                  <button onClick={() => handleDelete(tl)} className="p-1 rounded hover:bg-red-50 text-red-400"><Trash2 size={11} /></button>
                  <button onClick={() => togglePerf(tl.id)} className="p-1 rounded hover:bg-purple-50 text-purple-400"><BarChart2 size={11} /></button>
                </div>
              </div>
            );
          })}
          {leaderboardEntries.length === 0 && <p className="text-center text-slate-500 py-8">No data available</p>}
        </div>
      )}
    </Layout>
  );
}
