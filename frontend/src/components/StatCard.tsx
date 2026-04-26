interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  color?: 'green' | 'pink' | 'amber' | 'blue' | 'slate';
  icon?: React.ReactNode;
}

const colorMap = {
  green: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', val: 'text-green-800' },
  pink: { bg: 'bg-pink-50', border: 'border-pink-200', text: 'text-pink-700', val: 'text-pink-800' },
  amber: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', val: 'text-amber-800' },
  blue: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', val: 'text-blue-800' },
  slate: { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-600', val: 'text-slate-800' },
};

export default function StatCard({ label, value, sub, color = 'slate', icon }: StatCardProps) {
  const c = colorMap[color];
  return (
    <div className={`${c.bg} ${c.border} border rounded-xl p-3`}>
      <div className="flex items-start justify-between">
        <p className={`text-xs font-medium ${c.text} leading-tight`}>{label}</p>
        {icon && <span className={c.text}>{icon}</span>}
      </div>
      <p className={`text-2xl font-bold ${c.val} mt-1`}>{value}</p>
      {sub && <p className={`text-xs ${c.text} mt-0.5`}>{sub}</p>}
    </div>
  );
}
