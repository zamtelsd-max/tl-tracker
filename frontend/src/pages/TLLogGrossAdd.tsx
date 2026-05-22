import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MapPin, CheckCircle, Phone, Wallet, ChevronDown,
  DollarSign, StickyNote, Clock, Calendar, AlertCircle,
} from 'lucide-react';
import Layout from '../components/Layout';
import { getDSAs, logGrossAdd, getGrossAdds } from '../api';
import type { GrossAdd } from '../api';
import { getCurrentHourSlot, getHourSlots, formatDate } from './LoginPage';

function formatMsisdn(raw: string) {
  return raw.replace(/\D/g, '').slice(0, 10);
}
function isValidMsisdn(n: string) {
  return /^(09[0-9]|07[0-9])\d{7}$/.test(n);
}

// ── Compact card showing one submitted gross add ─────────────────────────────
function GrossAddCard({ ga, idx }: { ga: GrossAdd; idx: number }) {
  return (
    <div className="flex items-start gap-3 bg-white rounded-xl px-3 py-2.5 shadow-sm border border-slate-100">
      <span className="text-xs text-slate-400 w-5 text-right flex-shrink-0 mt-0.5">{idx + 1}</span>
      <div className="flex-1 min-w-0">
        <p className="font-mono font-bold text-slate-800 text-sm">{ga.msisdn}</p>
        <div className="flex flex-wrap gap-2 mt-0.5">
          {ga.amountRecharged != null && (
            <span className="text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
              K{ga.amountRecharged.toFixed(0)} recharged
            </span>
          )}
          {ga.walletActivated && (
            <span className="text-xs text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full">
              💳 Wallet ✓{ga.firstDeposit ? ` · K${ga.firstDeposit.toFixed(0)} deposit` : ''}
            </span>
          )}
          {ga.latitude != null && (
            <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">📍 GPS</span>
          )}
        </div>
      </div>
      <span className="text-[10px] text-slate-400 flex-shrink-0 mt-0.5">
        {new Date(ga.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
      </span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
export default function TLLogGrossAdd() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // ── Form state ────────────────────────────────────────────────────────────
  const [dsaId, setDsaId]                     = useState('');
  const [msisdn, setMsisdn]                   = useState('');
  const [msisdnErr, setMsisdnErr]             = useState('');
  const [amountRecharged, setAmountRecharged] = useState('');
  const [walletActivated, setWalletActivated] = useState(false);
  const [firstDeposit, setFirstDeposit]       = useState('');
  const [notes, setNotes]                     = useState('');
  const [hourSlot, setHourSlot]               = useState(getCurrentHourSlot());
  const [date, setDate]                       = useState(formatDate());
  const [latitude, setLatitude]               = useState<number | undefined>();
  const [longitude, setLongitude]             = useState<number | undefined>();
  const [locStatus, setLocStatus]             = useState<'idle' | 'loading' | 'found' | 'error'>('idle');
  const [submitError, setSubmitError]         = useState('');
  const [success, setSuccess]                 = useState(false);

  // ── Queries (all before any conditional return) ────────────────────────────
  const { data: dsasRes } = useQuery({
    queryKey: ['dsas'],
    queryFn: async () => { const r = await getDSAs(); if (!r.success) throw new Error(r.error); return r.data; },
  });
  const dsas = (dsasRes ?? []).filter(d => d.status === 'ACTIVE');

  const { data: todayAddsRes, refetch: refetchAdds } = useQuery({
    queryKey: ['gross-adds-today', dsaId],
    queryFn: () => getGrossAdds(dsaId || undefined),
    enabled: true,
    refetchInterval: 30000,
  });
  const todayAdds: GrossAdd[] = todayAddsRes?.data ?? [];

  const mutation = useMutation({
    mutationFn: logGrossAdd,
    onSuccess: () => {
      setSuccess(true);
      void queryClient.invalidateQueries({ queryKey: ['tl-dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['gross-adds-today'] });
      // Reset form after 1.5 s
      setTimeout(() => {
        setSuccess(false);
        setMsisdn('');
        setAmountRecharged('');
        setWalletActivated(false);
        setFirstDeposit('');
        setNotes('');
        setLatitude(undefined);
        setLongitude(undefined);
        setLocStatus('idle');
        setSubmitError('');
        void refetchAdds();
      }, 1500);
    },
    onError: (e: unknown) => {
      const ax = e as { response?: { data?: { error?: string } } };
      setSubmitError(ax.response?.data?.error || 'Failed to log gross add');
    },
  });

  // Prefill first DSA
  useEffect(() => {
    if (dsas.length > 0 && !dsaId) setDsaId(dsas[0].id);
  }, [dsas, dsaId]);

  const captureLocation = () => {
    setLocStatus('loading');
    navigator.geolocation.getCurrentPosition(
      pos => { setLatitude(pos.coords.latitude); setLongitude(pos.coords.longitude); setLocStatus('found'); },
      () => setLocStatus('error'),
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const handleSubmit = () => {
    setSubmitError('');
    const cleaned = formatMsisdn(msisdn);
    if (!dsaId) { setSubmitError('Please select a DSA'); return; }
    if (!cleaned) { setMsisdnErr('Customer number required'); return; }
    if (!isValidMsisdn(cleaned)) { setMsisdnErr('Must be 10 digits starting with 09 or 07'); return; }
    setMsisdnErr('');
    mutation.mutate({
      dsaId,
      msisdn: cleaned,
      amountRecharged: amountRecharged ? Number(amountRecharged) : undefined,
      walletActivated,
      firstDeposit: walletActivated && firstDeposit ? Number(firstDeposit) : undefined,
      latitude, longitude,
      notes: notes || undefined,
      hourSlot,
      date,
    });
  };

  const dsaAdds = todayAdds.filter(a => !dsaId || a.dsaId === dsaId);
  const walletCount = dsaAdds.filter(a => a.walletActivated).length;
  const totalRecharge = dsaAdds.reduce((s, a) => s + (a.amountRecharged ?? 0), 0);

  return (
    <Layout title="Log Gross Add" showBack backTo="/tl">
      <div className="flex flex-col h-full">

        {/* ── DSA selector strip ────────────────────────────────────────── */}
        <div className="px-4 pt-3 pb-2 flex-shrink-0">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Select DSA *</label>
          <div className="relative">
            <select value={dsaId} onChange={e => { setDsaId(e.target.value); setSubmitError(''); }}
              className="w-full appearance-none bg-white border-2 border-[#00843D] rounded-2xl px-4 py-3 text-base font-bold text-slate-800 focus:outline-none pr-10 shadow-sm">
              <option value="">— Choose a DSA —</option>
              {dsas.map(d => (
                <option key={d.id} value={d.id}>{d.name}{d.dealerCode ? ` · ${d.dealerCode}` : ''}</option>
              ))}
            </select>
            <ChevronDown size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* ── Today's mini stats for selected DSA ──────────────────────── */}
        {dsaId && (
          <div className="px-4 pb-2 flex-shrink-0">
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-[#00843D]/10 rounded-xl py-2 text-center">
                <p className="text-lg font-black text-[#00843D]">{dsaAdds.length}</p>
                <p className="text-[10px] text-slate-500">Gross Adds</p>
              </div>
              <div className="bg-purple-50 rounded-xl py-2 text-center">
                <p className="text-lg font-black text-purple-700">{walletCount}</p>
                <p className="text-[10px] text-slate-500">Wallets</p>
              </div>
              <div className="bg-blue-50 rounded-xl py-2 text-center">
                <p className="text-base font-black text-blue-700">K{totalRecharge.toFixed(0)}</p>
                <p className="text-[10px] text-slate-500">Recharged</p>
              </div>
            </div>
          </div>
        )}

        {/* ── Scrollable form + list ────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-4 pb-32 space-y-3">

          {/* Customer MSISDN */}
          <div className="bg-white rounded-2xl shadow-sm p-4">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1 block">
              <Phone size={12} className="text-[#00843D]" /> Customer Number *
            </label>
            <input
              type="tel" inputMode="numeric" maxLength={10}
              value={msisdn} onChange={e => { setMsisdn(formatMsisdn(e.target.value)); setMsisdnErr(''); }}
              placeholder="09XXXXXXXX or 07XXXXXXXX"
              className={`w-full border-2 rounded-xl px-4 py-3 text-lg font-mono tracking-widest focus:outline-none transition-colors ${msisdnErr ? 'border-red-400 bg-red-50' : 'border-slate-200 focus:border-[#00843D]'}`}
            />
            {msisdnErr && (
              <div className="mt-1.5 flex items-center gap-1.5 text-red-600 text-xs">
                <AlertCircle size={12} /> {msisdnErr}
              </div>
            )}
          </div>

          {/* Amount Recharged */}
          <div className="bg-white rounded-2xl shadow-sm p-4">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1 block">
              <DollarSign size={12} className="text-[#00843D]" /> Amount Recharged (ZMW)
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">K</span>
              <input
                type="number" inputMode="decimal" min={0} step="0.50"
                value={amountRecharged} onChange={e => setAmountRecharged(e.target.value)}
                placeholder="e.g. 20.00"
                className="w-full border-2 border-slate-200 rounded-xl pl-9 pr-4 py-3 text-base focus:outline-none focus:border-[#00843D] transition-colors"
              />
            </div>
          </div>

          {/* Zamtel Money Wallet */}
          <div className="bg-white rounded-2xl shadow-sm p-4">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                <Wallet size={12} className="text-purple-600" /> Zamtel Money Wallet Activated?
              </label>
              <button
                onClick={() => { setWalletActivated(v => !v); if (walletActivated) setFirstDeposit(''); }}
                className={`relative w-12 h-6 rounded-full transition-colors duration-200 flex-shrink-0 ${walletActivated ? 'bg-purple-600' : 'bg-slate-200'}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${walletActivated ? 'translate-x-6' : 'translate-x-0.5'}`} />
              </button>
            </div>

            {walletActivated && (
              <div className="mt-3 pt-3 border-t border-slate-100">
                <label className="text-[10px] font-bold text-purple-600 uppercase tracking-widest mb-2 block">
                  First Deposit Amount (ZMW)
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">K</span>
                  <input
                    type="number" inputMode="decimal" min={0} step="0.50"
                    value={firstDeposit} onChange={e => setFirstDeposit(e.target.value)}
                    placeholder="e.g. 50.00"
                    className="w-full border-2 border-purple-200 bg-purple-50 rounded-xl pl-9 pr-4 py-3 text-base focus:outline-none focus:border-purple-400 transition-colors"
                  />
                </div>
              </div>
            )}
          </div>

          {/* GPS Location */}
          <div className="bg-white rounded-2xl shadow-sm p-4">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1 block">
              <MapPin size={12} className="text-blue-500" /> Gross Add Location *
            </label>
            <button
              onClick={captureLocation}
              disabled={locStatus === 'loading'}
              className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all border-2 ${
                locStatus === 'found'  ? 'bg-green-50 border-green-300 text-green-700' :
                locStatus === 'error' ? 'bg-red-50 border-red-200 text-red-600' :
                locStatus === 'loading' ? 'bg-blue-50 border-blue-200 text-blue-600' :
                'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <MapPin size={16} />
              {locStatus === 'idle'    && '📍 Capture Location'}
              {locStatus === 'loading' && 'Getting GPS…'}
              {locStatus === 'found'   && `✓ ${latitude?.toFixed(5)}, ${longitude?.toFixed(5)}`}
              {locStatus === 'error'   && 'Location unavailable — tap to retry'}
            </button>
            {locStatus === 'idle' && (
              <p className="text-[10px] text-amber-600 mt-1 text-center">⚠ Location is required for field verification</p>
            )}
          </div>

          {/* Hour slot + Date */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-2xl shadow-sm p-3">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 flex items-center gap-1 block">
                <Clock size={11} /> Hour Slot
              </label>
              <select value={hourSlot} onChange={e => setHourSlot(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-2 py-2 text-xs focus:outline-none focus:border-[#00843D] bg-white">
                {getHourSlots().map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="bg-white rounded-2xl shadow-sm p-3">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 flex items-center gap-1 block">
                <Calendar size={11} /> Date
              </label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-2 py-2 text-xs focus:outline-none focus:border-[#00843D]" />
            </div>
          </div>

          {/* Notes */}
          <div className="bg-white rounded-2xl shadow-sm p-4">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1 block">
              <StickyNote size={12} /> Notes (optional)
            </label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Observations, location name, etc."
              rows={2}
              className="w-full border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#00843D] resize-none" />
          </div>

          {submitError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 flex items-center gap-2">
              <AlertCircle size={15} /> {submitError}
            </div>
          )}

          {/* Today's gross adds for this DSA */}
          {dsaAdds.length > 0 && (
            <div>
              <p className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-2">
                Today's Gross Adds — {dsas.find(d => d.id === dsaId)?.name ?? 'All DSAs'} ({dsaAdds.length})
              </p>
              <div className="space-y-1.5">
                {dsaAdds.map((ga, i) => <GrossAddCard key={ga.id} ga={ga} idx={i} />)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Fixed Submit Button ─────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto px-4 pb-6 pt-3 bg-gradient-to-t from-slate-100 via-slate-100/90">
        {success ? (
          <div className="w-full bg-green-500 text-white font-bold text-base rounded-2xl py-4 flex items-center justify-center gap-2 shadow-xl">
            <CheckCircle size={20} /> Gross Add Logged!
          </div>
        ) : (
          <button onClick={handleSubmit} disabled={mutation.isPending}
            className="w-full bg-[#00843D] hover:bg-[#006B31] disabled:bg-slate-300 text-white font-bold text-base rounded-2xl py-4 shadow-xl transition-all active:scale-98 flex items-center justify-center gap-2">
            {mutation.isPending
              ? <><span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving…</>
              : <><Phone size={18} /> LOG GROSS ADD</>}
          </button>
        )}
      </div>
    </Layout>
  );
}
