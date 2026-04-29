import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, AlertTriangle, TrendingUp, Clock, Users, UserPlus, X, Phone } from 'lucide-react';
import Layout from '../components/Layout';
import ProgressRing from '../components/ProgressRing';
import { getTLDashboard, addDSA } from '../api';
import type { DSASummary } from '../types';

function DSACard({ dsa }: { dsa: DSASummary }) {
  const colorMap = {
    green: { bg: 'bg-green-50 border-green-200', dot: 'bg-green-500', text: 'text-green-700' },
    amber: { bg: 'bg-amber-50 border-amber-200', dot: 'bg-amber-500', text: 'text-amber-700' },
    red: { bg: 'bg-red-50 border-red-200', dot: 'bg-red-500', text: 'text-red-700' },
  };
  const c = colorMap[dsa.status];

  return (
    <div className={`border rounded-xl p-3 ${c.bg}`}>
      <div className="flex items-start justify-between mb-1">
        <p className="text-xs font-semibold text-slate-700 leading-tight">{dsa.name}</p>
        <span className={`w-2.5 h-2.5 rounded-full mt-0.5 ${c.dot} flex-shrink-0`} />
      </div>
      <div className="flex items-end justify-between">
        <div>
          <p className={`text-xl font-black ${c.text}`}>{dsa.total}</p>
          <p className="text-xs text-slate-500">of {dsa.target} target</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500">This hr</p>
          <p className="text-sm font-bold text-slate-700">{dsa.thisHour}</p>
        </div>
      </div>
      {/* Mini progress bar */}
      <div className="mt-2 h-1.5 bg-white/50 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            dsa.status === 'green' ? 'bg-green-500' : dsa.status === 'amber' ? 'bg-amber-500' : 'bg-red-500'
          }`}
          style={{ width: `${Math.min(100, dsa.pct)}%` }}
        />
      </div>
    </div>
  );
}

function AddDSAModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [dealerCode, setDealerCode] = useState('');
  const [err, setErr] = useState('');

  const mutation = useMutation({
    mutationFn: () => addDSA({
      name: name.trim(),
      phone: phone.trim() || undefined,
      dealerCode: dealerCode.trim() || undefined,
    }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tl-dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['dsas'] });
      onClose();
    },
    onError: (e: unknown) => {
      const ax = e as { response?: { data?: { error?: string } } };
      setErr(ax.response?.data?.error || 'Failed to add DSA');
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 px-0">
      <div className="bg-white rounded-t-3xl w-full max-w-lg p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-800">Add New DSA</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100">
            <X size={20} className="text-slate-500" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-1 block">
              Full Name *
            </label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Banda Mwanza" autoFocus
              className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-[#00843D] transition-colors" />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-1 block">
              Dealer Code
            </label>
            <input type="text" value={dealerCode} onChange={(e) => setDealerCode(e.target.value.toUpperCase())}
              placeholder="e.g. DLR-00123"
              className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-base font-mono tracking-widest focus:outline-none focus:border-[#00843D] transition-colors" />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-1 block">
              Phone Number (Optional)
            </label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. 0971234567"
              className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-[#00843D] transition-colors" />
          </div>

          {err && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{err}</div>
          )}

          <button
            onClick={() => { setErr(''); if (!name.trim()) { setErr('DSA name is required'); return; } mutation.mutate(); }}
            disabled={mutation.isPending}
            className="w-full bg-[#00843D] hover:bg-[#006B31] disabled:bg-slate-300 text-white font-bold text-base rounded-2xl py-4 transition-all active:scale-98 mt-2">
            {mutation.isPending ? 'Adding...' : 'Add DSA'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TLDashboard() {
  const navigate = useNavigate();
  const [showAddDSA, setShowAddDSA] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['tl-dashboard'],
    queryFn: async () => {
      const res = await getTLDashboard();
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    refetchInterval: 60000, // Refresh every minute
  });

  if (isLoading) {
    return (
      <Layout title="TL Tracker">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-[#00843D] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-slate-500 text-sm">Loading dashboard...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (error || !data) {
    return (
      <Layout title="TL Tracker">
        <div className="p-4">
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
            <p className="text-red-700 font-semibold">Failed to load dashboard</p>
            <p className="text-red-600 text-sm mt-1">{(error as Error)?.message}</p>
            <button
              onClick={() => void refetch()}
              className="mt-3 bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-semibold"
            >
              Retry
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  const { kpis, dsaSummary, hourlyActivations, alertCount, tl } = data;
  const dsaCount = dsaSummary.length;
  const noDSAs = dsaCount === 0;
  const progress = Math.min(100, kpis.teamTargetAttainment);
  const ringColor = progress >= 80 ? '#00843D' : progress >= 50 ? '#F59E0B' : '#DC2626';

  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  return (
    <Layout
      title="TL Tracker"
      subtitle={tl.name}
      alertCount={alertCount}
    >
      {showAddDSA && <AddDSAModal onClose={() => setShowAddDSA(false)} />}
      <div className="px-4 py-4 space-y-4">

        {/* ── No DSAs: full-page prompt ─────────────────────────────────── */}
        {noDSAs && (
          <div className="bg-white rounded-2xl shadow-sm p-6 text-center border-2 border-dashed border-[#00843D]/40">
            <div className="w-16 h-16 rounded-full bg-[#00843D]/10 flex items-center justify-center mx-auto mb-4">
              <UserPlus size={32} className="text-[#00843D]" />
            </div>
            <h2 className="text-lg font-bold text-slate-800 mb-1">No DSAs registered yet</h2>
            <p className="text-sm text-slate-500 mb-4">
              Add your Direct Sales Agents to start tracking<br />gross adds and hourly performance.
            </p>
            <button
              onClick={() => setShowAddDSA(true)}
              className="bg-[#00843D] hover:bg-[#006B31] text-white font-bold px-8 py-3 rounded-2xl shadow-lg flex items-center gap-2 mx-auto transition-all active:scale-95"
            >
              <UserPlus size={18} />
              Add Your First DSA
            </button>
          </div>
        )}

        {/* Big Progress Ring */}
        <div className="bg-white rounded-2xl shadow-sm p-5 text-center">
          <div className="flex justify-center mb-2">
            <ProgressRing radius={70} stroke={8} progress={progress} color={ringColor}>
              <div className="text-center">
                <p className="text-2xl font-black text-slate-800 leading-none">{kpis.totalActivations}</p>
                <p className="text-xs text-slate-500 font-medium">of 50</p>
              </div>
            </ProgressRing>
          </div>
          <p className="text-sm font-bold text-slate-700">Team Target Today</p>
          <div className="flex items-center justify-center gap-2 mt-1">
            <div className="h-2 flex-1 bg-slate-100 rounded-full overflow-hidden max-w-[200px]">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${progress}%`, backgroundColor: ringColor }}
              />
            </div>
            <span className="text-sm font-bold" style={{ color: ringColor }}>
              {Math.round(progress)}%
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">{timeStr} · {data.today}</p>
        </div>

        {/* Current Hour Status */}
        <div className="bg-white rounded-2xl shadow-sm p-4 space-y-2">
          <div className="flex items-center gap-2 text-slate-700">
            <Clock size={16} className="text-[#00843D]" />
            <span className="text-sm font-bold">Current Hour: {kpis.currentHour}</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-slate-50 rounded-xl py-2">
              <p className="text-lg font-black text-slate-800">{Math.ceil(dsaSummary.length * 0.5)}</p>
              <p className="text-xs text-slate-500">Hourly target</p>
            </div>
            <div className="bg-[#00843D]/10 rounded-xl py-2">
              <p className="text-lg font-black text-[#00843D]">{kpis.runRateForecast.toFixed(1)}</p>
              <p className="text-xs text-slate-500">Run rate/hr</p>
            </div>
            <div className="bg-slate-50 rounded-xl py-2">
              <p className="text-lg font-black text-slate-800">{kpis.hoursRemaining.toFixed(1)}</p>
              <p className="text-xs text-slate-500">Hrs left</p>
            </div>
          </div>
        </div>

        {/* Carry Forward Warning */}
        {kpis.carryForward > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-3">
            <AlertTriangle size={18} className="text-amber-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-amber-800">
                +{kpis.carryForward.toFixed(1)} carry-forward
              </p>
              <p className="text-xs text-amber-700">
                Required run rate: {kpis.requiredRunRate.toFixed(1)}/hr
              </p>
            </div>
          </div>
        )}

        {/* Hourly Active DSA Chart */}
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <TrendingUp size={16} className="text-[#00843D]" />
              <p className="text-sm font-bold text-slate-700">Active DSAs per Hour</p>
            </div>
            <p className="text-xs text-slate-400">vs {dsaCount} target</p>
          </div>
          <div className="flex items-end gap-1" style={{ height: '64px' }}>
            {hourlyActivations.map((slot, i) => {
              const isCurrentHour = slot.slot === kpis.currentHour;
              const target = (slot as { activeDSAs?: number; dsaTarget?: number }).dsaTarget ?? dsaCount;
              const active = (slot as { activeDSAs?: number }).activeDSAs ?? 0;
              const pct = target > 0 ? (active / target) * 100 : 0;
              const metTarget = active >= target && target > 0;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                  {/* Count label */}
                  <p className={`text-[9px] font-bold leading-none ${active > 0 ? (metTarget ? 'text-[#00843D]' : isCurrentHour ? 'text-[#E4007C]' : 'text-amber-600') : 'text-slate-300'}`}>
                    {active > 0 ? `${active}/${target}` : ''}
                  </p>
                  <div className="w-full flex flex-col justify-end" style={{ height: '44px' }}>
                    {/* Target line marker */}
                    <div className="relative w-full" style={{ height: '44px' }}>
                      {/* Target dashed line at 100% */}
                      <div className="absolute w-full border-t border-dashed border-slate-300" style={{ top: '0px' }} />
                      {/* Bar */}
                      <div
                        className={`absolute bottom-0 w-full rounded-t transition-all duration-500 ${
                          metTarget ? 'bg-[#00843D]' : isCurrentHour ? 'bg-[#E4007C]' : active > 0 ? 'bg-amber-400' : 'bg-slate-100'
                        }`}
                        style={{ height: `${Math.max(active > 0 ? 12 : 3, pct)}%` }}
                      />
                    </div>
                  </div>
                  <p className="text-[8px] text-slate-400 w-full text-center leading-none">
                    {slot.slot.split(':')[0]}
                  </p>
                </div>
              );
            })}
          </div>
          {/* Legend */}
          <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-[#00843D] inline-block" />Met target</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-amber-400 inline-block" />Partial</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-[#E4007C] inline-block" />Current hr</span>
          </div>
        </div>

        {/* DSA Grid */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Users size={16} className="text-[#00843D]" />
              <p className="text-sm font-bold text-slate-700">
                DSA Performance
                <span className="ml-1 text-xs font-normal text-slate-400">({dsaCount}/10)</span>
              </p>
            </div>
            <button
              onClick={() => setShowAddDSA(true)}
              className="flex items-center gap-1 bg-[#00843D]/10 hover:bg-[#00843D]/20 text-[#00843D] text-xs font-bold px-3 py-1.5 rounded-lg transition-all"
            >
              <UserPlus size={13} />
              Add DSA
            </button>
          </div>
          {dsaCount === 0 && (
            <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl p-6 text-center">
              <UserPlus size={32} className="text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-500">No DSAs yet</p>
              <p className="text-xs text-slate-400 mt-1">Tap "Add DSA" to register your team members</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            {dsaSummary.map((dsa) => (
              <DSACard key={dsa.id} dsa={dsa} />
            ))}
          </div>
        </div>
      </div>

      {/* FAB */}
      <div className="fixed bottom-6 right-4 max-w-lg w-full" style={{ maxWidth: 'calc(100% - 2rem)' }}>
        <div className="flex justify-end gap-3">
          {noDSAs ? (
            <button
              onClick={() => setShowAddDSA(true)}
              className="bg-[#00843D] hover:bg-[#006B31] active:bg-[#005528] text-white font-bold rounded-full px-6 py-4 shadow-2xl flex items-center gap-2 transition-all duration-150 active:scale-95"
            >
              <UserPlus size={20} />
              ADD DSA
            </button>
          ) : (
            <div className="flex flex-col gap-2 items-end">
              <button
                onClick={() => navigate('/tl/log')}
                className="bg-[#00843D] hover:bg-[#006B31] active:bg-[#005528] text-white font-bold rounded-full px-6 py-4 shadow-2xl flex items-center gap-2 transition-all duration-150 active:scale-95"
              >
                <Plus size={20} />
                LOG ACTIVATION
              </button>
              <button
                onClick={() => navigate('/tl/log-numbers')}
                className="bg-[#E4007C] hover:bg-[#b8005f] active:bg-[#8c0048] text-white font-bold rounded-full px-5 py-3 shadow-xl flex items-center gap-2 transition-all duration-150 active:scale-95 text-sm"
              >
                <Phone size={16} />
                LOG NUMBERS
              </button>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
