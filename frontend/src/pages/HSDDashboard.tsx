import { useQuery } from '@tanstack/react-query';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend } from 'recharts';
import Layout from '../components/Layout';
import StatCard from '../components/StatCard';
import { getHSDDashboard } from '../api';
import { Globe, Trophy, TrendingDown, Target } from 'lucide-react';

const ZONE_COLORS = ['#00843D', '#E4007C', '#F59E0B', '#3B82F6', '#8B5CF6', '#EF4444'];

export default function HSDDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['hsd-dashboard'],
    queryFn: async () => {
      const res = await getHSDDashboard();
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    refetchInterval: 60000,
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

  return (
    <Layout title="HSD Dashboard" subtitle="National Overview">
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

        {/* Leaderboard */}
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

        {/* Export Button */}
        <a
          href={`${import.meta.env.VITE_API_URL || '/api'}/v1/hsd/export?format=xlsx`}
          className="block w-full bg-[#00843D] hover:bg-[#006B31] text-white font-bold text-center py-4 rounded-2xl shadow-lg transition-all active:scale-98"
          download
        >
          ↓ Export to Excel
        </a>
      </div>
    </Layout>
  );
}
