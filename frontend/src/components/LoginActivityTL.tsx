import { useEffect, useState } from 'react';
import { getLoginReport, loginReportExport } from '../api';

export default function LoginActivityTL() {
  const [role, setRole] = useState('ZBM');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dl, setDl] = useState(false);

  useEffect(() => {
    setLoading(true);
    getLoginReport(role).then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  }, [role]);

  const download = async () => { setDl(true); try { await loginReportExport(role); } finally { setDl(false); } };
  const s = data?.summary;

  return (
    <div className="px-4 py-4 space-y-3 overflow-y-auto flex-1">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-black text-slate-800">🔐 Login Activity</h2>
          <p className="text-[11px] text-slate-400">{role} logins into the TL Tool</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={role} onChange={e => setRole(e.target.value)} className="text-xs border border-slate-200 rounded-lg px-2 py-1.5">
            {['ZBM', 'ASE', 'TL', 'LISTER', 'HSD'].map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <button onClick={download} disabled={dl} className="text-xs font-bold text-white px-3 py-2 rounded-xl bg-[#00843D] disabled:opacity-50">{dl ? '…' : '⬇ Excel'}</button>
        </div>
      </div>

      {loading ? <p className="text-center text-slate-400 py-8 text-sm">Loading…</p> : !s ? <p className="text-center text-slate-400 py-8 text-sm">No data</p> : (
        <>
          <div className="grid grid-cols-3 gap-2">
            {[['Today', s.today, '#00843D'], ['Week', s.weekly, '#2563EB'], ['Month', s.monthly, '#E4007C']].map(([l, v, c]: any) => (
              <div key={l} className="bg-white rounded-2xl border border-slate-100 p-3 text-center shadow-sm">
                <p className="text-[10px] uppercase tracking-wide text-slate-400 font-bold">{l}</p>
                <p className="text-xl font-black mt-1" style={{ color: c }}>{v.uniqueUsers}<span className="text-xs text-slate-400">/{s.totalUsers}</span></p>
                <p className="text-[10px] text-slate-400">{v.logins} logins</p>
              </div>
            ))}
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
            <div className="px-4 py-2 bg-slate-50 flex text-[10px] font-bold text-slate-400 uppercase">
              <span className="flex-1">{role}</span><span className="w-10 text-center">Today</span><span className="w-8 text-center">7d</span><span className="w-12 text-center">Month</span>
            </div>
            <div className="divide-y divide-slate-50">
              {data.byUser.map((u: any) => (
                <div key={u.userId} className="px-4 py-2.5 flex items-center text-sm">
                  <div className="flex-1 min-w-0"><p className="font-semibold text-slate-800 truncate">{u.name}</p><p className="text-[10px] text-slate-400">{u.zone || ''}</p></div>
                  <span className="w-10 text-center font-bold text-slate-700">{u.today}</span>
                  <span className="w-8 text-center text-slate-600">{u.week}</span>
                  <span className="w-12 text-center text-slate-600">{u.month}</span>
                </div>
              ))}
              {!data.byUser.length && <p className="px-4 py-6 text-center text-slate-400 text-xs">No logins recorded yet this month</p>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
