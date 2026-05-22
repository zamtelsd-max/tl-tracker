import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import Layout from '../components/Layout';
import MTDReport from '../components/MTDReport';
import { getZBMDashboard, zbmAddTeamLead, zbmGetASEs, zbmAddASE, getZBMMTD,
         zbmPatchTL, zbmDeleteTL, zbmGetTLPerformance, type TLPerformance } from '../api';
import { TrendingUp, Users, Target, UserPlus, X, Trophy,
         Pencil, Trash2, ChevronDown, ChevronUp, BarChart2, AlertTriangle } from 'lucide-react';

const ZONES_ZBM = ['Lusaka North','Lusaka-South','Copperbelt','Central','Eastern','Northern','Luapula','Muchinga','North-Western','Southern','Western'];

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

// ── Performance Panel ────────────────────────────────────────
function ZBMTLPerfPanel({ tlId, target }: { tlId: string; target: number }) {
  const { data: perf, isLoading } = useQuery<TLPerformance>({
    queryKey: ['zbm-tl-perf', tlId],
    queryFn: () => zbmGetTLPerformance(tlId),
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

// ── Compact TL Row ───────────────────────────────────────────
function TLRow({ tl, onEdit, onDelete, expanded, onTogglePerf }: {
  tl: any; onEdit: () => void; onDelete: () => void; expanded: boolean; onTogglePerf: () => void;
}) {
  const pct = tl.attainment;
  const statusColor = pct >= 80 ? 'border-[#00843D]' : pct >= 50 ? 'border-amber-400' : 'border-red-500';
  return (
    <div className={`bg-white rounded-xl px-3 py-2.5 border-l-4 ${statusColor}`}>
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-bold text-slate-800 text-sm truncate">{tl.name}</p>
          <p className="text-[11px] text-slate-400">{tl.region ?? '—'}</p>
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
      {expanded && <ZBMTLPerfPanel tlId={tl.id} target={tl.target} />}
    </div>
  );
}

// ── Region Group ─────────────────────────────────────────────
function RegionGroup({ region, tls, onEdit, onDelete, expandedPerf, onTogglePerf }: {
  region: string; tls: any[];
  onEdit: (tl: any) => void; onDelete: (tl: any) => void;
  expandedPerf: string[]; onTogglePerf: (id: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const totalActs = tls.reduce((s, t) => s + t.activations, 0);
  const avgAtt   = tls.length ? Math.round(tls.reduce((s, t) => s + t.attainment, 0) / tls.length) : 0;
  const failing  = tls.filter(t => t.attainment < 50).length;
  const headerColor = failing > 0 ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700';

  return (
    <div className="rounded-2xl overflow-hidden border border-slate-100 shadow-sm">
      <button onClick={() => setOpen(o => !o)} className={`w-full flex items-center justify-between px-4 py-3 ${headerColor}`}>
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm">{region}</span>
          <span className="text-xs opacity-70">{tls.length} TL{tls.length !== 1 ? 's' : ''}</span>
          {failing > 0 && <span className="text-xs bg-red-200 text-red-800 px-1.5 py-0.5 rounded-full font-bold">{failing} failing</span>}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold">{totalActs} acts · {avgAtt}%</span>
          {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </div>
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

// ── Add ASE Modal ─────────────────────────────────────────────
function AddASEModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [staffId, setStaffId] = useState('');
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [region, setRegion] = useState('');
  const [err, setErr] = useState('');
  const mutation = useMutation({
    mutationFn: () => zbmAddASE({ staffId: staffId.trim().toUpperCase(), name: name.trim(), pin, region: region.trim() }),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['zbm-ases'] }); void queryClient.invalidateQueries({ queryKey: ['zbm-dashboard'] }); onClose(); },
    onError: (e: any) => setErr(e.response?.data?.error || 'Failed to add ASE'),
  });
  const submit = () => {
    setErr('');
    if (!staffId.trim()) { setErr('Staff ID required'); return; }
    if (!name.trim()) { setErr('Name required'); return; }
    if (!/^\d{4}$/.test(pin)) { setErr('PIN must be 4 digits'); return; }
    if (!region.trim()) { setErr('Region required'); return; }
    mutation.mutate();
  };
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60">
      <div className="bg-white rounded-t-3xl w-full max-w-lg p-5 shadow-2xl space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-slate-800 flex items-center gap-2"><UserPlus size={18} className="text-[#E4007C]" /> Add ASE</h2>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        {err && <p className="text-red-600 text-sm bg-red-50 rounded-xl px-3 py-2">{err}</p>}
        <input value={staffId} onChange={e => setStaffId(e.target.value.toUpperCase())} placeholder="Staff ID *"
          className="w-full border-2 border-slate-200 rounded-xl px-3 py-2.5 text-sm font-mono tracking-widest focus:outline-none focus:border-[#E4007C]" />
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Full Name *"
          className="w-full border-2 border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#E4007C]" />
        <div className="grid grid-cols-2 gap-3">
          <input type="password" inputMode="numeric" maxLength={4} value={pin}
            onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="PIN * (4 digits)"
            className="border-2 border-slate-200 rounded-xl px-3 py-2.5 text-sm text-center tracking-widest focus:outline-none focus:border-[#E4007C]" />
          <input value={region} onChange={e => setRegion(e.target.value)} placeholder="Region *"
            className="border-2 border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#E4007C]" />
        </div>
        <button onClick={submit} disabled={mutation.isPending}
          className="w-full bg-[#E4007C] text-white font-bold text-sm rounded-2xl py-3.5 disabled:opacity-50">
          {mutation.isPending ? 'Creating…' : 'Create ASE'}
        </button>
      </div>
    </div>
  );
}

// ── Add TL Modal ─────────────────────────────────────────────
function AddTLModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [staffId, setStaffId] = useState('');
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [region, setRegion] = useState('');
  const [aseId, setAseId] = useState('');
  const [target, setTarget] = useState('50');
  const [err, setErr] = useState('');
  const { data: asesRes } = useQuery({ queryKey: ['zbm-ases'], queryFn: async () => { const r = await zbmGetASEs(); return r.data ?? []; } });
  const ases = asesRes ?? [];
  const mutation = useMutation({
    mutationFn: () => zbmAddTeamLead({ staffId: staffId.trim().toUpperCase(), name: name.trim(), pin, region: region.trim(), aseId: aseId || undefined, allocatedTarget: Number(target) || 50 }),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['zbm-dashboard'] }); onClose(); },
    onError: (e: any) => setErr(e.response?.data?.error || 'Failed to add TL'),
  });
  const submit = () => {
    setErr('');
    if (!staffId.trim()) { setErr('Staff ID required'); return; }
    if (!name.trim()) { setErr('Name required'); return; }
    if (!/^\d{4}$/.test(pin)) { setErr('PIN must be 4 digits'); return; }
    if (!region.trim()) { setErr('Region required'); return; }
    mutation.mutate();
  };
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60">
      <div className="bg-white rounded-t-3xl w-full max-w-lg p-5 shadow-2xl space-y-3 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-slate-800 flex items-center gap-2"><UserPlus size={18} className="text-[#00843D]" /> Add Team Lead</h2>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        {err && <p className="text-red-600 text-sm bg-red-50 rounded-xl px-3 py-2">{err}</p>}
        <input value={staffId} onChange={e => setStaffId(e.target.value.toUpperCase())} placeholder="Staff ID *"
          className="w-full border-2 border-slate-200 rounded-xl px-3 py-2.5 text-sm font-mono tracking-widest focus:outline-none focus:border-[#00843D]" />
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Full Name *"
          className="w-full border-2 border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#00843D]" />
        <div className="grid grid-cols-2 gap-3">
          <input type="password" inputMode="numeric" maxLength={4} value={pin}
            onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="PIN * (4 digits)"
            className="border-2 border-slate-200 rounded-xl px-3 py-2.5 text-sm text-center tracking-widest focus:outline-none focus:border-[#00843D]" />
          <input type="number" value={target} onChange={e => setTarget(e.target.value)} min={1} placeholder="Target"
            className="border-2 border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#00843D]" />
        </div>
        <input value={region} onChange={e => setRegion(e.target.value)} placeholder="Region *"
          className="w-full border-2 border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#00843D]" />
        {ases.length > 0 && (
          <select value={aseId} onChange={e => setAseId(e.target.value)}
            className="w-full border-2 border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-[#00843D]">
            <option value="">— Assign to ASE (optional) —</option>
            {ases.map(a => <option key={a.id} value={a.id}>{a.name} ({a.staffId})</option>)}
          </select>
        )}
        <button onClick={submit} disabled={mutation.isPending}
          className="w-full bg-[#00843D] text-white font-bold text-sm rounded-2xl py-3.5 disabled:opacity-50">
          {mutation.isPending ? 'Creating…' : 'Create Team Lead'}
        </button>
      </div>
    </div>
  );
}

// ── Edit TL Modal ────────────────────────────────────────────
function ZBMEditTLModal({ tl, onClose, onSave }: {
  tl: any; onClose: () => void;
  onSave: (d: { name: string; zone: string; region: string; allocatedTarget: number; pin?: string }) => Promise<void>;
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
            {ZONES_ZBM.map(z => <option key={z}>{z}</option>)}
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
export default function ZBMDashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showAddTL, setShowAddTL] = useState(false);
  const [showAddASE, setShowAddASE] = useState(false);
  const [tab, setTab] = useState<'dashboard' | 'mtd' | 'leaderboard'>('dashboard');
  const [editTL, setEditTL] = useState<any | null>(null);
  const [expandedPerf, setExpandedPerf] = useState<string[]>([]);

  // ── All hooks before early return ──────────────────────────
  const editMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof zbmPatchTL>[1] }) => zbmPatchTL(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['zbm-dashboard'] }),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => zbmDeleteTL(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['zbm-dashboard'] }),
  });
  const togglePerf = (id: string) => setExpandedPerf(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const { data, isLoading } = useQuery({
    queryKey: ['zbm-dashboard'],
    queryFn: async () => { const res = await getZBMDashboard(); if (!res.success) throw new Error(res.error); return res.data; },
    refetchInterval: 60000,
  });
  const { data: mtdData, isLoading: mtdLoading } = useQuery({
    queryKey: ['zbm-mtd'],
    queryFn: async () => { const res = await getZBMMTD(); if (!res.success) throw new Error(res.error); return res; },
    refetchInterval: 300000,
  });

  if (isLoading) return <Layout title="ZBM Dashboard"><div className="flex items-center justify-center h-64"><div className="w-12 h-12 border-4 border-[#00843D] border-t-transparent rounded-full animate-spin" /></div></Layout>;

  const { summary, teamLeads = [], heatmap = [] } = data || {};
  const totalTarget = summary?.totalTargets ?? 0;

  const handleDeleteTL = (tl: any) => {
    if (!confirm(`Unlink "${tl.name}" from their ASE?\nHistory preserved.`)) return;
    deleteMutation.mutate(tl.id);
  };

  // Group TLs by region for display
  const byRegion = teamLeads.reduce<Record<string, any[]>>((acc, tl) => {
    const key = tl.region || 'Unassigned';
    if (!acc[key]) acc[key] = [];
    acc[key].push(tl);
    return acc;
  }, {});
  const regions = Object.keys(byRegion).sort((a, b) => {
    const failA = byRegion[a].filter((t: any) => t.attainment < 50).length;
    const failB = byRegion[b].filter((t: any) => t.attainment < 50).length;
    return failB - failA; // worst regions first
  });

  const failing = teamLeads.filter(t => t.attainment < 50).length;
  const onTrack = teamLeads.filter(t => t.attainment >= 80).length;

  const barData = [...teamLeads]
    .sort((a, b) => b.activations - a.activations)
    .slice(0, 12)
    .map(tl => ({ name: tl.name.split(' ').slice(-1)[0], activations: tl.activations, target: tl.target, attainment: tl.attainment }));

  const heatColor = (v: number) => v === 0 ? '#f1f5f9' : v < 3 ? '#bbf7d0' : v < 6 ? '#4ade80' : v < 10 ? '#16a34a' : '#14532d';
  const hourLabels = ['08','09','10','11','12','13','14','15','16','17'];
  const leaderboardEntries = [...teamLeads].sort((a, b) => b.activations - a.activations);

  return (
    <Layout title="ZBM Dashboard" subtitle={data?.zone ? `Zone: ${data.zone}` : undefined}>
      {showAddTL && <AddTLModal onClose={() => { setShowAddTL(false); queryClient.invalidateQueries({ queryKey: ['zbm-dashboard'] }); }} />}
      {showAddASE && <AddASEModal onClose={() => setShowAddASE(false)} />}
      {editTL && (
        <ZBMEditTLModal tl={editTL} onClose={() => setEditTL(null)}
          onSave={async (payload) => { await editMutation.mutateAsync({ id: editTL.id, payload }); setEditTL(null); }} />
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
          {/* Header banner */}
          {summary && (
            <div className="bg-gradient-to-br from-[#003366] to-[#00843D] rounded-2xl p-4 text-white shadow-lg">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-4xl font-black leading-none">{summary.totalActivations}</p>
                  <p className="text-blue-200 text-sm mt-1">activations today</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black">{summary.complianceRate}%</p>
                  <p className="text-blue-200 text-xs">compliance</p>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2 mt-4 pt-3 border-t border-white/20">
                {[
                  { label: 'Target', value: summary.totalTargets },
                  { label: 'Run/hr', value: summary.avgRunRate.toFixed(1) },
                  { label: '✅ On Track', value: onTrack },
                  { label: '🔴 Failing', value: failing },
                ].map(({ label, value }) => (
                  <div key={label} className="text-center">
                    <p className="font-bold text-base">{value}</p>
                    <p className="text-blue-200 text-[10px]">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <button onClick={() => navigate('/leaderboard')}
              className="flex-1 flex items-center justify-center gap-1.5 bg-gradient-to-r from-amber-400 to-yellow-400 text-white text-xs font-bold py-2.5 rounded-xl shadow">
              <Trophy size={14} /> Leaderboard
            </button>
            <button onClick={() => setShowAddASE(true)}
              className="flex items-center gap-1 bg-[#E4007C]/10 text-[#E4007C] text-xs font-bold py-2.5 px-3 rounded-xl border border-[#E4007C]/30">
              <UserPlus size={13} /> ASE
            </button>
            <button onClick={() => setShowAddTL(true)}
              className="flex items-center gap-1 bg-[#00843D]/10 text-[#00843D] text-xs font-bold py-2.5 px-3 rounded-xl border border-[#00843D]/30">
              <UserPlus size={13} /> TL
            </button>
          </div>

          {/* Bar chart */}
          {barData.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm p-4">
              <p className="text-sm font-bold text-slate-700 mb-3">Top Team Performance</p>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={barData} margin={{ top: 0, right: 0, bottom: 0, left: -10 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                  <YAxis tick={{ fontSize: 9 }} />
                  <Tooltip />
                  <Bar dataKey="activations" radius={[4, 4, 0, 0]}>
                    {barData.map((e, i) => <Cell key={i} fill={e.attainment >= 80 ? '#00843D' : e.attainment >= 50 ? '#F59E0B' : '#DC2626'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Heatmap */}
          {heatmap.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm p-4">
              <p className="text-sm font-bold text-slate-700 mb-2">Hourly Activity Heatmap</p>
              <div className="flex gap-0.5 mb-1 pl-16">
                {hourLabels.map(h => <div key={h} className="flex-1 text-center text-[9px] text-slate-400">{h}</div>)}
              </div>
              <div className="space-y-0.5">
                {heatmap.map(row => (
                  <div key={row.name} className="flex items-center gap-0.5">
                    <div className="w-16 text-[10px] text-slate-600 truncate font-medium">{row.name.split(' ').slice(-1)[0]}</div>
                    {row.slots.map((s, i) => <div key={i} className="flex-1 h-5 rounded-sm" style={{ backgroundColor: heatColor(s.activations) }} title={`${s.slot}: ${s.activations}`} />)}
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 mt-2 text-[10px] text-slate-400">
                <span>Low</span>
                {['#f1f5f9','#bbf7d0','#4ade80','#16a34a','#14532d'].map(c => <div key={c} className="w-4 h-2.5 rounded" style={{ backgroundColor: c }} />)}
                <span>High</span>
              </div>
            </div>
          )}

          {/* Region-grouped TLs */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-slate-700">Team Leads by Region</p>
              <span className="text-xs text-slate-400">{teamLeads.length} total · sorted by failing</span>
            </div>
            {regions.map(region => (
              <RegionGroup key={region} region={region} tls={byRegion[region]}
                onEdit={setEditTL} onDelete={handleDeleteTL} expandedPerf={expandedPerf} onTogglePerf={togglePerf} />
            ))}
            {teamLeads.length === 0 && (
              <div className="text-center py-10 text-slate-400">
                <Users size={36} className="mx-auto mb-2 opacity-20" />
                <p className="text-sm">No team leads in this zone yet</p>
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
            <p className="text-center text-slate-500 py-8">No MTD data</p>}
        </div>
      )}

      {/* ── Leaderboard Tab ──────────────────────────────────── */}
      {tab === 'leaderboard' && (
        <div className="px-4 py-4 space-y-2">
          {leaderboardEntries.map((tl, i) => {
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
            const pct = tl.attainment;
            return (
              <div key={tl.id} className="bg-white rounded-2xl p-3 flex items-center gap-3 shadow-sm">
                <span className="text-xl w-8 text-center flex-shrink-0">{medal}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-800 text-sm truncate">{tl.name}</p>
                  <p className="text-xs text-slate-500">{tl.region ?? tl.zone ?? ''}</p>
                  <AttainBar pct={pct} />
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-black text-[#00843D] text-lg leading-none">{tl.activations}</p>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${pct >= 80 ? 'bg-green-100 text-green-700' : pct >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{pct}%</span>
                </div>
                <div className="flex flex-col gap-0.5 flex-shrink-0">
                  <button onClick={() => setEditTL(tl)} className="p-1 rounded hover:bg-blue-50 text-blue-400"><Pencil size={11} /></button>
                  <button onClick={() => handleDeleteTL(tl)} className="p-1 rounded hover:bg-red-50 text-red-400"><Trash2 size={11} /></button>
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
