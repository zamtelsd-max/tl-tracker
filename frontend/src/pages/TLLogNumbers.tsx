import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Phone, Plus, X, CheckCircle2, AlertCircle, ChevronDown } from 'lucide-react';
import { getTLDashboard, tlLogRegisteredNumbers, tlGetRegisteredNumbers } from '../api';

// Zamtel prefixes: 096, 076
const ZAMTEL_RE = /^(096|076)\d{7}$/;

function formatMsisdn(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 10);
}

function isValid(n: string) {
  return ZAMTEL_RE.test(n);
}

export default function TLLogNumbers() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [selectedDsaId, setSelectedDsaId] = useState('');
  const [input, setInput] = useState('');
  const [numbers, setNumbers] = useState<string[]>([]);
  const [inputErr, setInputErr] = useState('');
  const [success, setSuccess] = useState<{ saved: number; skipped: number } | null>(null);

  const { data: dashData } = useQuery({
    queryKey: ['tl-dashboard'],
    queryFn: async () => {
      
      const r = await getTLDashboard();
      if (!r.success) throw new Error(r.error);
      return r.data;
    },
  });

  const dsas = dashData?.dsas?.filter((d: { status: string }) => d.status === 'ACTIVE') ?? [];
  const selectedDsa = dsas.find((d: { id: string }) => d.id === selectedDsaId);

  // Today's logged numbers for selected DSA
  const { data: loggedNumbers = [] } = useQuery({
    queryKey: ['registered-numbers', selectedDsaId],
    queryFn: () => tlGetRegisteredNumbers(selectedDsaId),
    enabled: !!selectedDsaId,
    refetchInterval: 30000,
  });

  const mutation = useMutation({
    mutationFn: () => tlLogRegisteredNumbers(selectedDsaId, numbers),
    onSuccess: (data) => {
      setSuccess({ saved: data.saved, skipped: data.skipped });
      setNumbers([]);
      void queryClient.invalidateQueries({ queryKey: ['registered-numbers', selectedDsaId] });
    },
    onError: (e: unknown) => {
      const ax = e as { response?: { data?: { error?: string } } };
      setInputErr(ax.response?.data?.error || 'Failed to save numbers');
    },
  });

  const addNumber = () => {
    const n = formatMsisdn(input);
    setInputErr('');
    if (!n) return;
    if (!isValid(n)) {
      setInputErr('Invalid number — must be 096XXXXXXX or 076XXXXXXX (10 digits)');
      return;
    }
    if (numbers.includes(n)) {
      setInputErr('Already in list');
      return;
    }
    setNumbers(prev => [...prev, n]);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); addNumber(); }
  };

  const removeNumber = (n: string) => setNumbers(prev => prev.filter(x => x !== n));

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="zamtel-gradient px-4 pt-10 pb-6 relative">
        <button onClick={() => navigate('/tl')}
          className="absolute top-4 left-4 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
          <ArrowLeft size={18} className="text-white" />
        </button>
        <div className="text-center">
          <Phone size={28} className="text-white mx-auto mb-2" />
          <h1 className="text-white text-xl font-black">Log Registered Numbers</h1>
          <p className="text-green-200 text-xs mt-0.5">Enter Zamtel numbers registered by your DSAs</p>
        </div>
      </div>

      <div className="px-4 py-5 space-y-4 pb-10">

        {/* DSA Selector */}
        <div>
          <label className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-2 block">Select DSA *</label>
          <div className="relative">
            <select value={selectedDsaId} onChange={e => { setSelectedDsaId(e.target.value); setSuccess(null); setNumbers([]); }}
              className="w-full appearance-none bg-white border-2 border-slate-200 rounded-2xl px-4 py-4 text-base font-semibold text-slate-800 focus:outline-none focus:border-[#00843D] pr-10">
              <option value="">— Choose a DSA —</option>
              {dsas.map((d: { id: string; name: string; dealerCode?: string }) => (
                <option key={d.id} value={d.id}>{d.name}{d.dealerCode ? ` (${d.dealerCode})` : ''}</option>
              ))}
            </select>
            <ChevronDown size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {selectedDsaId && (
          <>
            {/* Number input */}
            <div>
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-2 block">
                Enter Number (096 or 076)
              </label>
              <div className="flex gap-2">
                <input
                  type="tel"
                  inputMode="numeric"
                  value={input}
                  onChange={e => { setInput(formatMsisdn(e.target.value)); setInputErr(''); setSuccess(null); }}
                  onKeyDown={handleKeyDown}
                  placeholder="0960000000"
                  maxLength={10}
                  className="flex-1 bg-white border-2 border-slate-200 rounded-2xl px-4 py-4 text-lg font-mono tracking-widest focus:outline-none focus:border-[#00843D] transition-colors"
                />
                <button onClick={addNumber}
                  className="w-14 h-14 rounded-2xl bg-[#00843D] flex items-center justify-center flex-shrink-0 active:scale-95 transition-all shadow">
                  <Plus size={24} className="text-white" />
                </button>
              </div>
              {inputErr && (
                <div className="mt-2 flex items-center gap-2 text-red-600 text-sm bg-red-50 rounded-xl px-3 py-2">
                  <AlertCircle size={14} /> {inputErr}
                </div>
              )}
              <p className="text-xs text-slate-400 mt-1.5">Type number and press + or Enter to add. Submit when all numbers are entered.</p>
            </div>

            {/* Queued numbers */}
            {numbers.length > 0 && (
              <div className="bg-white rounded-2xl border-2 border-[#00843D] p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-bold text-slate-700">Ready to submit — {numbers.length} number{numbers.length !== 1 ? 's' : ''}</p>
                  <button onClick={() => setNumbers([])} className="text-xs text-red-500 font-semibold">Clear all</button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {numbers.map(n => (
                    <div key={n} className="flex items-center gap-1.5 bg-green-50 border border-green-200 rounded-full px-3 py-1.5">
                      <span className="text-sm font-mono font-bold text-green-800">{n}</span>
                      <button onClick={() => removeNumber(n)} className="text-green-600 hover:text-red-500">
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => mutation.mutate()}
                  disabled={mutation.isPending}
                  className="w-full mt-4 bg-[#00843D] hover:bg-[#006B31] disabled:bg-slate-300 text-white font-bold py-4 rounded-2xl transition-all active:scale-98">
                  {mutation.isPending ? 'Saving...' : `Submit ${numbers.length} Number${numbers.length !== 1 ? 's' : ''}`}
                </button>
              </div>
            )}

            {/* Success */}
            {success && (
              <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-4 flex items-start gap-3">
                <CheckCircle2 size={20} className="text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-green-800">Saved successfully!</p>
                  <p className="text-sm text-green-700">{success.saved} number{success.saved !== 1 ? 's' : ''} saved{success.skipped > 0 ? `, ${success.skipped} skipped (already logged today)` : ''}</p>
                </div>
              </div>
            )}

            {/* Today's logged numbers */}
            {loggedNumbers.length > 0 && (
              <div>
                <p className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-2">
                  Today's Logged Numbers — {selectedDsa?.name} ({loggedNumbers.length})
                </p>
                <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
                  {loggedNumbers.map((n, i) => (
                    <div key={n.id} className="flex items-center justify-between px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-400 w-5 text-right">{i + 1}</span>
                        <span className="font-mono font-bold text-slate-800 text-sm">{n.msisdn}</span>
                      </div>
                      <span className="text-xs text-slate-400">{new Date(n.createdAt ?? n.date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
