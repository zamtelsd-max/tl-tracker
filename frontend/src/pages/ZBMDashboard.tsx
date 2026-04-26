import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import Layout from '../components/Layout';
import StatCard from '../components/StatCard';
import { getZBMDashboard } from '../api';
import { Map, TrendingUp, Users, Target } from 'lucide-react';

export default function ZBMDashboard() {
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
          <p className="text-sm font-bold text-slate-700">Team Lead Details</p>
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
