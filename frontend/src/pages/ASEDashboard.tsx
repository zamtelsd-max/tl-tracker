import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Users, TrendingUp, AlertTriangle, Activity } from 'lucide-react';
import Layout from '../components/Layout';
import StatCard from '../components/StatCard';
import { getASEDashboard, getASEAlerts } from '../api';
import type { TLSummary } from '../types';

function StatusBadge({ status }: { status: TLSummary['status'] }) {
  const map = {
    'on-track': 'bg-green-100 text-green-700',
    'at-risk': 'bg-amber-100 text-amber-700',
    'critical': 'bg-red-100 text-red-700',
  };
  const labels = { 'on-track': 'On Track', 'at-risk': 'At Risk', 'critical': 'Critical' };
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${map[status]}`}>
      {labels[status]}
    </span>
  );
}

export default function ASEDashboard() {
  const [activeTab, setActiveTab] = useState<'teams' | 'alerts'>('teams');

  const { data, isLoading } = useQuery({
    queryKey: ['ase-dashboard'],
    queryFn: async () => {
      const res = await getASEDashboard();
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    refetchInterval: 60000,
  });

  const { data: alertsRes } = useQuery({
    queryKey: ['ase-alerts'],
    queryFn: async () => {
      const res = await getASEAlerts();
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
  });

  if (isLoading) {
    return (
      <Layout title="ASE Dashboard">
        <div className="flex items-center justify-center h-64">
          <div className="w-12 h-12 border-4 border-[#00843D] border-t-transparent rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  const summary = data?.summary;
  const teamLeads = data?.teamLeads || [];
  const alerts = alertsRes || [];

  const alertTypeMap: Record<string, string> = {
    ZERO_ACTIVITY: '⚠️',
    MISSED_TARGET: '📉',
    END_OF_DAY: '📋',
    ESCALATION: '🚨',
  };

  return (
    <Layout title="ASE Dashboard">
      <div className="px-4 py-4 space-y-4">

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label="Total Activations"
              value={summary.totalActivations}
              color="green"
              icon={<Activity size={16} />}
            />
            <StatCard
              label="Teams Active"
              value={`${summary.teamsWithActivity}/${summary.totalTeams}`}
              color="blue"
              icon={<Users size={16} />}
            />
            <StatCard
              label="Avg Run Rate"
              value={summary.avgRunRate.toFixed(1)}
              sub="per hour"
              color="amber"
              icon={<TrendingUp size={16} />}
            />
            <StatCard
              label="Exceptions"
              value={summary.exceptions}
              sub="alerts today"
              color={summary.exceptions > 0 ? 'pink' : 'slate'}
              icon={<AlertTriangle size={16} />}
            />
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-slate-200 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('teams')}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'teams' ? 'bg-white text-[#00843D] shadow' : 'text-slate-600'
            }`}
          >
            Team Leads ({teamLeads.length})
          </button>
          <button
            onClick={() => setActiveTab('alerts')}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'alerts' ? 'bg-white text-[#E4007C] shadow' : 'text-slate-600'
            }`}
          >
            Alerts {alerts.length > 0 && `(${alerts.length})`}
          </button>
        </div>

        {/* Team Leads Table */}
        {activeTab === 'teams' && (
          <div className="space-y-3">
            {teamLeads.map((tl) => (
              <div key={tl.id} className="bg-white rounded-xl shadow-sm p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-bold text-slate-800 text-sm">{tl.name}</p>
                    <p className="text-xs text-slate-500">{tl.zone} · {tl.region}</p>
                  </div>
                  <StatusBadge status={tl.status} />
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-lg font-black text-slate-800">{tl.activations}</p>
                    <p className="text-xs text-slate-500">Acts</p>
                  </div>
                  <div>
                    <p className="text-lg font-black text-[#00843D]">{tl.runRate}</p>
                    <p className="text-xs text-slate-500">Run rate</p>
                  </div>
                  <div>
                    <p className="text-lg font-black text-slate-800">{tl.attainment}%</p>
                    <p className="text-xs text-slate-500">Attainment</p>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(100, tl.attainment)}%`,
                      backgroundColor: tl.status === 'on-track' ? '#00843D' : tl.status === 'at-risk' ? '#F59E0B' : '#DC2626',
                    }}
                  />
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-xs text-slate-400">{tl.dsaCount} DSAs</span>
                  <span className="text-xs text-slate-400">Target: {tl.target}</span>
                </div>
              </div>
            ))}
            {teamLeads.length === 0 && (
              <div className="text-center py-8 text-slate-500">
                <Users size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">No team leads assigned</p>
              </div>
            )}
          </div>
        )}

        {/* Alerts */}
        {activeTab === 'alerts' && (
          <div className="space-y-3">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={`bg-white rounded-xl shadow-sm p-4 border-l-4 ${
                  alert.type === 'ESCALATION' ? 'border-red-500' :
                  alert.type === 'MISSED_TARGET' ? 'border-amber-500' :
                  alert.type === 'ZERO_ACTIVITY' ? 'border-orange-400' :
                  'border-blue-400'
                }`}
              >
                <div className="flex items-start gap-2">
                  <span className="text-lg">{alertTypeMap[alert.type] || '📌'}</span>
                  <div className="flex-1">
                    <p className="text-sm text-slate-700">{alert.message}</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {new Date(alert.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                    alert.status === 'SENT' ? 'bg-blue-100 text-blue-700' :
                    alert.status === 'READ' ? 'bg-slate-100 text-slate-600' :
                    'bg-green-100 text-green-700'
                  }`}>
                    {alert.status}
                  </span>
                </div>
              </div>
            ))}
            {alerts.length === 0 && (
              <div className="text-center py-8 text-slate-500">
                <Activity size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">No alerts</p>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
