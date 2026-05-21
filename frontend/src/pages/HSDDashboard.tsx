import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend } from 'recharts';
import Layout from '../components/Layout';
import StatCard from '../components/StatCard';
import MTDReport from '../components/MTDReport';
import { getHSDDashboard, getHSDMTD, getHSDEscalationSummary, type EscalationZone } from '../api';
import { Globe, Trophy, TrendingDown, Target, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';

const ZONE_COLORS = ['#00843D', '#E4007C', '#F59E0B', '#3B82F6', '#8B5CF6', '#EF4444'];

function EscalationTab() {
  const [expanded, setExpanded] = useState<string[]>([]);
  const { data, isLoading } = useQuery({
    queryKey: ['hsd-escalation'],
    queryFn: getHSDEscalationSummary,
    refetchInterval: 300000,
  });

  const toggle = (zone: string) => {
    setExpanded(prev =>
      prev.includes(zone) ? prev.filter(z => z !== zone) : [...prev, zone]
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="w-10 h-10 border-4 border-red-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const zones: EscalationZone[] = data?.data?.summary ?? [];
  const totalFailingTLs = zones.reduce((s, z) => s + z.failingTLs, 0);
  const totalZeroTLs = zones.reduce((s, z) => s + z.zeroTLs, 0);
  const totalFailingASEs = zones.reduce((s, z) => s + z.failingASECount, 0);
  const generatedAt = data?.data?.generatedAt
    ? new Date(data.data.generatedAt).toLocaleString('en-ZM', { timeZone: 'Africa/Lusaka', hour12: false })
    : '';

  return (
    <div className="px-4 py-4 space-y-4">
      {/* Summary cards */}
      <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle size={18} className="text-red-600" />
          <p className="text-sm font-bold text-red-700">National Non-Compliance Summary</p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white rounded-xl p-3 text-center">
            <p className="text-2xl font-black text-red-600">{totalFailingTLs}</p>
            <p className="text-xs text-slate-500 leading-tight">Failing TLs<br/>(&lt;50%)</p>
          </div>
          <div className="bg-white rounded-xl p-3 text-center">
            <p className="text-2xl font-black text-red-800">{totalZeroTLs}</p>
            <p className="text-xs text-slate-500 leading-tight">Zero Activity<br/>TLs</p>
          </div>
          <div className="bg-white rounded-xl p-3 text-center">
            <p className="text-2xl font-black text-orange-600">{totalFailingASEs}</p>
            <p className="text-xs text-slate-500 leading-tight">Non-Compliant<br/>ASEs</p>
          </div>
        </div>
        {generatedAt && <p className="text-xs text-slate-400 mt-2 text-right">Updated: {generatedAt}</p>}
      </div>

      {/* Per-zone breakdown */}
      {zones.map((z) => {
        const isOpen = expanded.includes(z.zone);
        const severity = z.failingTLs > 20 ? 'bg-red-50 border-red-200' : z.failingTLs > 5 ? 'bg-orange-50 border-orange-200' : 'bg-yellow-50 border-yellow-200';
        const badge = z.failingTLs > 20 ? 'bg-red-100 text-red-700' : z.failingTLs > 5 ? 'bg-orange-100 text-orange-700' : 'bg-yellow-100 text-yellow-700';

        return (
          <div key={z.zone} className={`border rounded-2xl overflow-hidden ${severity}`}>
            <button
              onClick={() => toggle(z.zone)}
              className="w-full px-4 py-3 flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-800 text-sm">{z.zone}</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${badge}`}>
                  {z.failingTLs} failing
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500">{z.zeroTLs} zero · {z.failingASECount} ASEs</span>
                {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>
            </button>

            {isOpen && (
              <div className="px-4 pb-4 space-y-3">
                {/* Non-compliant ASEs */}
                {z.ases.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-orange-700 mb-1">⚠️ Non-Compliant ASEs</p>
                    <div className="space-y-1.5">
                      {z.ases.map((ase) => (
                        <div key={ase.staffId} className="bg-white rounded-xl px-3 py-2 flex items-center justify-between">
                          <div>
                            <p className="text-sm font-semibold text-slate-800">{ase.name}</p>
                            <p className="text-xs text-slate-500">{ase.staffId} · {ase.failingTlCount}/{ase.tlCount} TLs failing</p>
                          </div>
                          <span className={`text-sm font-black px-2 py-0.5 rounded-lg ${
                            ase.attain < 10 ? 'bg-red-100 text-red-700' :
                            ase.attain < 35 ? 'bg-orange-100 text-orange-700' :
                            'bg-yellow-100 text-yellow-700'
                          }`}>{ase.attain}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Failing TLs sample */}
                {z.tls.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-red-700 mb-1">🚨 Failing Team Leads (top 10)</p>
                    <div className="space-y-1">
                      {z.tls.slice(0, 10).map((tl) => (
                        <div key={tl.tlStaffId} className="bg-white rounded-xl px-3 py-1.5 flex items-center justify-between">
                          <div className="min-w-0 flex-1 pr-2">
                            <p className="text-xs font-semibold text-slate-800 truncate">{tl.tlName}</p>
                            <p className="text-xs text-slate-400">{tl.aseStaffId === 'UNASSIGNED' ? '⚠️ No ASE' : tl.aseName}</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <span className={`text-xs font-black ${tl.attain === 0 ? 'text-red-700' : 'text-orange-600'}`}>{tl.mtd} acts</span>
                            {tl.noYday && <p className="text-xs text-slate-400">No yday</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      <p className="text-xs text-center text-slate-400 pb-2">
        Reports sent automatically to CSDO, HSD & Head-Ops at 08:00, 11:00, 14:00 & 17:00 hrs daily.
        ZBMs notified per zone.
      </p>
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex items-center justify-center h-32">
      <div className="w-10 h-10 border-4 border-[#00843D] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function HSDDashboard() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'dashboard' | 'mtd' | 'leaderboard' | 'escalations'>('dashboard');

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

  const pieData = zoneRankings.slice(0, 6).map((z) => ({
    name: z.zone,
    value: z.activations,
  }));

  const totalTarget = national?.totalTarget ?? 0;

  return (
    <Layout title="HSD Dashboard" subtitle="National Overview">
      {/* Tab bar */}
      <div className="flex gap-1.5 px-3 pt-3 pb-1">
        {(['dashboard', 'mtd', 'leaderboard', 'escalations'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-xl text-xs font-bold uppercase tracking-wide transition-all ${
              tab === t
                ? t === 'escalations' ? 'bg-red-600 text-white shadow' : 'bg-[#00843D] text-white shadow'
                : 'bg-white text-slate-500 border border-slate-200'
            }`}
          >
            {t === 'dashboard' ? '📊 Today' : t === 'mtd' ? '📅 MTD' : t === 'leaderboard' ? '🏆 Ranks' : '🚨 Issues'}
          </button>
        ))}
      </div>

      {/* Dashboard tab */}
      {tab === 'dashboard' && (
        <div className="px-4 py-4 space-y-4">
          {/* National KPIs */}
          {national && (
            <div className="grid grid-cols-2 gap-3">
              <StatCard
                label="National Activations"
                value={national.totalActivations.toLocaleString()}
                sub={`Target: ${national.totalTarget}`}
                color="green"
                icon={<Globe size={16} />}
              />
              <StatCard
                label="National Attainment"
                value={`${national.attainment}%`}
                color={national.attainment >= 80 ? 'green' : national.attainment >= 50 ? 'amber' : 'pink'}
                icon={<Target size={16} />}
              />
              <div className="col-span-2">
                <StatCard
                  label="Total Teams"
                  value={national.totalTeams}
                  sub="active team leads"
                  color="blue"
                  icon={<Globe size={16} />}
                />
              </div>
            </div>
          )}

          {/* Zone Distribution Pie */}
          {pieData.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm p-4">
              <p className="text-sm font-bold text-slate-700 mb-3">Zone Distribution</p>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value">
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={ZONE_COLORS[i % ZONE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend iconType="circle" iconSize={8} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Zone Rankings */}
          <div className="bg-white rounded-2xl shadow-sm p-4">
            <div className="flex items-center gap-2 mb-3">
              <Trophy size={16} className="text-[#00843D]" />
              <p className="text-sm font-bold text-slate-700">Zone Rankings</p>
            </div>
            <div className="space-y-2">
              {zoneRankings.map((zone, i) => (
                <div key={zone.zone} className="flex items-center gap-3">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${
                    i === 0 ? 'bg-yellow-100 text-yellow-700' :
                    i === 1 ? 'bg-slate-200 text-slate-600' :
                    i === 2 ? 'bg-orange-100 text-orange-600' :
                    'bg-slate-100 text-slate-500'
                  }`}>
                    {i + 1}
                  </span>
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-0.5">
                      <span className="text-sm font-semibold text-slate-700">{zone.zone}</span>
                      <span className="text-sm font-bold text-[#00843D]">{zone.attainment}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(100, zone.attainment)}%`,
                          backgroundColor: zone.attainment >= 80 ? '#00843D' : zone.attainment >= 50 ? '#F59E0B' : '#DC2626',
                        }}
                      />
                    </div>
                  </div>
                  <span className="text-xs text-slate-500">{zone.activations}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Leaderboard preview */}
          {leaderboard.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm p-4">
              <div className="flex items-center gap-2 mb-3">
                <Trophy size={16} className="text-amber-500" />
                <p className="text-sm font-bold text-slate-700">Top Performers</p>
              </div>
              <div className="space-y-2">
                {leaderboard.slice(0, 5).map((tl, i) => (
                  <div key={tl.id} className="flex items-center gap-3 py-1.5 border-b border-slate-50 last:border-0">
                    <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-black flex-shrink-0 ${
                      i === 0 ? 'bg-yellow-100 text-yellow-700 text-base' :
                      i === 1 ? 'bg-slate-200 text-slate-600' :
                      i === 2 ? 'bg-orange-100 text-orange-600' :
                      'bg-slate-100 text-slate-500 text-xs'
                    }`}>
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{tl.name}</p>
                      <p className="text-xs text-slate-500">{tl.zone}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-base font-black text-[#00843D]">{tl.activations}</p>
                      <p className="text-xs text-slate-500">{tl.attainment}%</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Underperformers */}
          {underperformers.length > 0 && (
            <div className="bg-red-50 border border-red-100 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <TrendingDown size={16} className="text-red-500" />
                <p className="text-sm font-bold text-red-700">Underperformers (&lt;50%)</p>
              </div>
              <div className="space-y-2">
                {underperformers.map((tl) => (
                  <div key={tl.id} className="flex items-center justify-between bg-white rounded-xl px-3 py-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{tl.name}</p>
                      <p className="text-xs text-slate-500">{tl.zone}</p>
                    </div>
                    <span className="text-sm font-black text-red-600">{tl.attainment}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Leaderboard Button */}
          <button
            onClick={() => navigate('/leaderboard')}
            className="w-full bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-white font-bold text-center py-4 rounded-2xl shadow-lg transition-all active:scale-98 flex items-center justify-center gap-2"
          >
            <Trophy size={20} /> View Full Leaderboard
          </button>

          {/* Export Button */}
          <a
            href={`${import.meta.env.VITE_API_URL || '/api'}/hsd/export?format=xlsx`}
            className="block w-full bg-[#00843D] hover:bg-[#006B31] text-white font-bold text-center py-4 rounded-2xl shadow-lg transition-all active:scale-98"
            download
          >
            ↓ Export to Excel
          </a>
        </div>
      )}

      {/* MTD tab */}
      {tab === 'mtd' && (
        <div className="px-4 py-4">
          {mtdLoading ? (
            <Spinner />
          ) : mtdData?.data ? (
            <MTDReport days={mtdData.data} totalTarget={totalTarget} />
          ) : (
            <p className="text-center text-slate-500 py-8">No MTD data available</p>
          )}
        </div>
      )}

      {/* Escalations tab */}
      {tab === 'escalations' && <EscalationTab />}

      {/* Leaderboard tab */}
      {tab === 'leaderboard' && (
        <div className="px-4 py-4 space-y-2">
          {leaderboard.length === 0 ? (
            <p className="text-center text-slate-500 py-8">No data available</p>
          ) : (
            leaderboard.map((tl, i) => {
              const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
              const badgeColor =
                tl.attainment >= 80
                  ? 'bg-green-100 text-green-700'
                  : tl.attainment >= 50
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-red-100 text-red-700';
              return (
                <div key={tl.id} className="bg-white rounded-2xl p-3 flex items-center gap-3 shadow-sm">
                  <span className="text-xl w-8 text-center">{medal}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-800 text-sm truncate">{tl.name}</p>
                    <p className="text-xs text-slate-500">{tl.zone ?? ''}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-[#00843D] text-base">{tl.activations}</p>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${badgeColor}`}>
                      {tl.attainment}%
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </Layout>
  );
}
