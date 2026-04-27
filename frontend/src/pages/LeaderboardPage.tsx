import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { api } from '../api/client';
import type { ApiResponse } from '../types';
import { ArrowLeft, Trophy, RefreshCw, TrendingUp, Users, Target } from 'lucide-react';

interface LeaderboardEntry {
  id: string;
  name: string;
  staffId: string;
  zone: string;
  region?: string;
  aseName?: string | null;
  tlCount?: number;
  dsaCount?: number;
  activations: number;
  target: number;
  attainment: number;
}

interface LeaderboardData {
  level: string;
  entries: LeaderboardEntry[];
}

const MEDAL = ['🥇', '🥈', '🥉'];
const RANK_COLORS = [
  { bg: 'bg-yellow-50 border-yellow-300', ring: 'bg-yellow-100 text-yellow-700', bar: '#F59E0B' },
  { bg: 'bg-slate-50 border-slate-300',   ring: 'bg-slate-200 text-slate-600',   bar: '#94A3B8' },
  { bg: 'bg-orange-50 border-orange-300', ring: 'bg-orange-100 text-orange-600', bar: '#F97316' },
];

function Podium({ entries }: { entries: LeaderboardEntry[] }) {
  if (entries.length === 0) return null;
  const [first, second, third] = entries;
  return (
    <div className="flex items-end justify-center gap-3 mb-6 pt-4">
      {/* 2nd */}
      {second && (
        <div className="flex flex-col items-center w-24">
          <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center text-2xl mb-1">🥈</div>
          <div className="text-center mb-1">
            <p className="text-xs font-bold text-slate-700 truncate w-24 text-center leading-tight">{second.name}</p>
            <p className="text-xs text-slate-500">{second.zone}</p>
          </div>
          <div className="w-full bg-slate-200 rounded-t-xl flex flex-col items-center py-3" style={{ height: '72px' }}>
            <p className="text-lg font-black text-slate-700">{second.activations}</p>
            <p className="text-xs text-slate-500">{second.attainment}%</p>
          </div>
        </div>
      )}
      {/* 1st */}
      {first && (
        <div className="flex flex-col items-center w-28">
          <div className="w-14 h-14 rounded-full bg-yellow-100 flex items-center justify-center text-3xl mb-1 shadow-lg ring-4 ring-yellow-300">🥇</div>
          <div className="text-center mb-1">
            <p className="text-xs font-bold text-slate-800 truncate w-28 text-center leading-tight">{first.name}</p>
            <p className="text-xs text-slate-500">{first.zone}</p>
          </div>
          <div className="w-full bg-gradient-to-b from-yellow-400 to-yellow-500 rounded-t-xl flex flex-col items-center py-4 shadow-md" style={{ height: '96px' }}>
            <p className="text-2xl font-black text-white">{first.activations}</p>
            <p className="text-xs text-yellow-100 font-semibold">{first.attainment}%</p>
          </div>
        </div>
      )}
      {/* 3rd */}
      {third && (
        <div className="flex flex-col items-center w-24">
          <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center text-2xl mb-1">🥉</div>
          <div className="text-center mb-1">
            <p className="text-xs font-bold text-slate-700 truncate w-24 text-center leading-tight">{third.name}</p>
            <p className="text-xs text-slate-500">{third.zone}</p>
          </div>
          <div className="w-full bg-orange-200 rounded-t-xl flex flex-col items-center py-2" style={{ height: '56px' }}>
            <p className="text-lg font-black text-orange-700">{third.activations}</p>
            <p className="text-xs text-orange-500">{third.attainment}%</p>
          </div>
        </div>
      )}
    </div>
  );
}

function RankRow({ entry, rank, maxActivations }: { entry: LeaderboardEntry; rank: number; maxActivations: number }) {
  const isTop3 = rank < 3;
  const colors = isTop3 ? RANK_COLORS[rank] : null;
  const pct = maxActivations > 0 ? (entry.activations / maxActivations) * 100 : 0;
  const attColor = entry.attainment >= 80 ? '#00843D' : entry.attainment >= 50 ? '#F59E0B' : '#DC2626';

  return (
    <div className={`flex items-center gap-3 p-3 rounded-2xl border transition-all ${isTop3 ? `${colors!.bg} border` : 'bg-white border-slate-100'}`}>
      {/* Rank badge */}
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 font-black text-sm ${isTop3 ? colors!.ring : 'bg-slate-100 text-slate-500 text-xs'}`}>
        {isTop3 ? MEDAL[rank] : rank + 1}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-800 truncate leading-tight">{entry.name}</p>
            <p className="text-xs text-slate-500 truncate">{entry.zone}{entry.region ? ` · ${entry.region}` : ''}</p>
          </div>
          <div className="text-right ml-2 flex-shrink-0">
            <p className="text-lg font-black text-slate-800 leading-none">{entry.activations}</p>
            <p className="text-xs font-bold" style={{ color: attColor }}>{entry.attainment}%</p>
          </div>
        </div>
        {/* Bar */}
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700"
            style={{ width: `${Math.max(pct, entry.activations > 0 ? 4 : 1)}%`, backgroundColor: isTop3 ? (colors!.bar) : attColor }} />
        </div>
        {/* Sub info */}
        <div className="flex gap-3 mt-1 text-xs text-slate-400">
          {entry.dsaCount !== undefined && <span><Users size={9} className="inline mr-0.5" />{entry.dsaCount} DSAs</span>}
          {entry.tlCount !== undefined && <span><Users size={9} className="inline mr-0.5" />{entry.tlCount} TLs</span>}
          {entry.aseName && <span>ASE: {entry.aseName}</span>}
          <span><Target size={9} className="inline mr-0.5" />Target: {entry.target}</span>
        </div>
      </div>
    </div>
  );
}

export default function LeaderboardPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const role = user?.role ?? 'HSD';

  // For HSD: can switch between TL / ASE / ZBM levels
  // For ZBM: TL or ASE (zone-scoped)
  // For ASE: TL only (their TLs)
  const levelOptions =
    role === 'HSD' || role === 'ADMIN' ? ['TL', 'ASE', 'ZBM'] :
    role === 'ZBM' ? ['TL', 'ASE'] :
    ['TL'];

  const [level, setLevel] = useState<'TL' | 'ASE' | 'ZBM'>(levelOptions[0] as 'TL' | 'ASE' | 'ZBM');

  const apiBase = role === 'ASE' ? '/ase/leaderboard' :
                  role === 'ZBM' ? `/zbm/leaderboard?level=${level.toLowerCase()}` :
                  `/hsd/leaderboard?level=${level.toLowerCase()}`;

  const { data, isLoading, refetch, isFetching } = useQuery<LeaderboardData>({
    queryKey: ['leaderboard', role, level],
    queryFn: async () => {
      const res = await api.get<ApiResponse<LeaderboardData>>(apiBase);
      if (!res.data.success) throw new Error(res.data.error);
      return res.data.data!;
    },
    refetchInterval: 60000,
  });

  const entries = data?.entries ?? [];
  const maxActs = entries.length > 0 ? entries[0].activations : 1;

  // Stats
  const totalActs = entries.reduce((s, e) => s + e.activations, 0);
  const avgAtt = entries.length > 0
    ? Math.round(entries.reduce((s, e) => s + e.attainment, 0) / entries.length) : 0;
  const onTrack = entries.filter(e => e.attainment >= 80).length;

  const backPath = role === 'ASE' ? '/ase' : role === 'ZBM' ? '/zbm' : '/hsd';

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="zamtel-gradient px-4 pt-10 pb-6 relative">
        <button onClick={() => navigate(backPath)}
          className="absolute top-4 left-4 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
          <ArrowLeft size={18} className="text-white" />
        </button>
        <button onClick={() => void refetch()}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
          <RefreshCw size={16} className={`text-white ${isFetching ? 'animate-spin' : ''}`} />
        </button>

        <div className="text-center">
          <Trophy size={32} className="text-yellow-300 mx-auto mb-2" />
          <h1 className="text-white text-xl font-black tracking-tight">Leaderboard</h1>
          <p className="text-green-200 text-xs mt-0.5">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>

        {/* Level tabs */}
        {levelOptions.length > 1 && (
          <div className="flex gap-1 bg-white/10 p-1 rounded-xl mt-4">
            {levelOptions.map(l => (
              <button key={l} onClick={() => setLevel(l as 'TL' | 'ASE' | 'ZBM')}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${level === l ? 'bg-white text-[#00843D] shadow' : 'text-white/80'}`}>
                {l} Level
              </button>
            ))}
          </div>
        )}

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-2 mt-4">
          <div className="bg-white/15 rounded-xl py-2 text-center">
            <p className="text-white font-black text-lg leading-none">{totalActs.toLocaleString()}</p>
            <p className="text-green-200 text-xs mt-0.5">Total GAs</p>
          </div>
          <div className="bg-white/15 rounded-xl py-2 text-center">
            <p className="text-white font-black text-lg leading-none">{avgAtt}%</p>
            <p className="text-green-200 text-xs mt-0.5">Avg Att.</p>
          </div>
          <div className="bg-white/15 rounded-xl py-2 text-center">
            <p className="text-white font-black text-lg leading-none">{onTrack}</p>
            <p className="text-green-200 text-xs mt-0.5">On Track</p>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 pb-8">
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-10 h-10 border-4 border-[#00843D] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-16">
            <TrendingUp size={40} className="text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-semibold">No data yet today</p>
            <p className="text-slate-400 text-sm mt-1">Leaderboard updates as activations are logged</p>
          </div>
        ) : (
          <>
            {/* Podium */}
            <Podium entries={entries.slice(0, 3)} />

            {/* Full ranked list */}
            <div className="space-y-2">
              {entries.map((entry, i) => (
                <RankRow key={entry.id} entry={entry} rank={i} maxActivations={maxActs} />
              ))}
            </div>

            {/* Bottom note */}
            <p className="text-center text-xs text-slate-400 mt-6">
              Ranked by today's gross adds · Updates every 60s
            </p>
          </>
        )}
      </div>
    </div>
  );
}
