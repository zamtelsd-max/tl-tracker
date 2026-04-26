import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, AlertTriangle, TrendingUp, Clock, Users } from 'lucide-react';
import Layout from '../components/Layout';
import ProgressRing from '../components/ProgressRing';
import { getTLDashboard } from '../api';
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

export default function TLDashboard() {
  const navigate = useNavigate();

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
      <div className="px-4 py-4 space-y-4">

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

        {/* Hourly Bar Chart */}
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={16} className="text-[#00843D]" />
            <p className="text-sm font-bold text-slate-700">Hourly Activity</p>
          </div>
          <div className="flex items-end gap-1 h-16">
            {hourlyActivations.map((slot, i) => {
              const isCurrentHour = slot.slot === kpis.currentHour;
              const maxVal = Math.max(...hourlyActivations.map((s) => s.activations), 1);
              const pct = (slot.activations / maxVal) * 100;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex flex-col justify-end" style={{ height: '48px' }}>
                    <div
                      className={`w-full rounded-t transition-all duration-500 ${
                        isCurrentHour ? 'bg-[#E4007C]' : slot.activations > 0 ? 'bg-[#00843D]' : 'bg-slate-200'
                      }`}
                      style={{ height: `${Math.max(pct, slot.activations > 0 ? 15 : 5)}%` }}
                    />
                  </div>
                  <p className="text-[8px] text-slate-400 w-full text-center">
                    {slot.slot.split(':')[0]}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* DSA Grid */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Users size={16} className="text-[#00843D]" />
              <p className="text-sm font-bold text-slate-700">DSA Performance</p>
            </div>
            <div className="flex gap-2 text-xs">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" />&gt;80%</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />50-79%</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />&lt;50%</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {dsaSummary.map((dsa) => (
              <DSACard key={dsa.id} dsa={dsa} />
            ))}
          </div>
        </div>
      </div>

      {/* FAB */}
      <div className="fixed bottom-6 right-4 max-w-lg w-full" style={{ maxWidth: 'calc(100% - 2rem)' }}>
        <div className="flex justify-end">
          <button
            onClick={() => navigate('/tl/log')}
            className="bg-[#00843D] hover:bg-[#006B31] active:bg-[#005528] text-white font-bold rounded-full px-6 py-4 shadow-2xl flex items-center gap-2 transition-all duration-150 active:scale-95"
          >
            <Plus size={20} />
            LOG ACTIVATION
          </button>
        </div>
      </div>
    </Layout>
  );
}
