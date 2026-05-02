import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import type { MTDDay } from '../types';

interface Props {
  days: MTDDay[];
  totalTarget: number;
}

export default function MTDReport({ days, totalTarget }: Props) {
  const today = days[days.length - 1];
  const attainment = today && totalTarget > 0 ? Math.round((today.cumActivations / totalTarget) * 100) : 0;
  const daysElapsed = days.length;
  // project EOM
  const projected = daysElapsed > 0 ? Math.round(((today?.cumActivations ?? 0) / daysElapsed) * 30) : 0;

  // format date labels — just show day number
  const chartData = days.map((d) => ({
    ...d,
    day: parseInt(d.date.split('-')[2]),
  }));

  return (
    <div className="space-y-4">
      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white rounded-2xl p-3 text-center shadow-sm">
          <p className="text-xs text-slate-500 font-medium">MTD Activations</p>
          <p className="text-xl font-black text-[#00843D]">{today?.cumActivations?.toLocaleString() ?? 0}</p>
        </div>
        <div className="bg-white rounded-2xl p-3 text-center shadow-sm">
          <p className="text-xs text-slate-500 font-medium">MTD Target</p>
          <p className="text-xl font-black text-slate-700">{today?.cumTarget?.toLocaleString() ?? 0}</p>
        </div>
        <div className="bg-white rounded-2xl p-3 text-center shadow-sm">
          <p className="text-xs text-slate-500 font-medium">Attainment</p>
          <p className={`text-xl font-black ${attainment >= 80 ? 'text-[#00843D]' : attainment >= 50 ? 'text-amber-500' : 'text-[#E4007C]'}`}>
            {attainment}%
          </p>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <p className="text-sm font-bold text-slate-700 mb-3">Daily Performance vs Target</p>
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="day" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip
              formatter={(value: number, name: string) => [value.toLocaleString(), name === 'activations' ? 'Activations' : 'Target']}
              labelFormatter={(label) => `Day ${label}`}
            />
            <Bar dataKey="activations" name="activations" radius={[3, 3, 0, 0]}>
              {chartData.map((d, i) => (
                <Cell key={i} fill={d.activations >= d.target ? '#00843D' : '#E4007C'} fillOpacity={0.85} />
              ))}
            </Bar>
            <Line type="monotone" dataKey="target" name="target" stroke="#F59E0B" strokeWidth={2} strokeDasharray="5 5" dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Projected */}
      <div className="bg-slate-50 rounded-2xl p-4 shadow-sm">
        <p className="text-sm font-bold text-slate-700 mb-2">Month Projection</p>
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">
            Days elapsed: <strong>{daysElapsed}</strong>
          </span>
          <span className="text-slate-500">
            Projected EOM:{' '}
            <strong className={projected >= totalTarget ? 'text-[#00843D]' : 'text-[#E4007C]'}>
              {projected.toLocaleString()}
            </strong>
          </span>
        </div>
        <div className="mt-2 h-2 bg-slate-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#00843D] rounded-full transition-all"
            style={{ width: `${Math.min(attainment, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}
