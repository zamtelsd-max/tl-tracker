import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MapPin, CheckCircle } from 'lucide-react';
import Layout from '../components/Layout';
import { getDSAs, logActivation } from '../api';
import { getCurrentHourSlot, getHourSlots, formatDate } from './LoginPage';

export default function TLLogActivation() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [dsaId, setDsaId] = useState('');
  const [count, setCount] = useState(1);
  const [hourSlot, setHourSlot] = useState(getCurrentHourSlot());
  const [date, setDate] = useState(formatDate());
  const [latitude, setLatitude] = useState<number | undefined>();
  const [longitude, setLongitude] = useState<number | undefined>();
  const [notes, setNotes] = useState('');
  const [locationStatus, setLocationStatus] = useState<'idle' | 'loading' | 'found' | 'error'>('idle');
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const { data: dsasRes } = useQuery({
    queryKey: ['dsas'],
    queryFn: async () => {
      const res = await getDSAs();
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
  });

  const dsas = dsasRes?.filter((d) => d.status === 'ACTIVE') || [];

  useEffect(() => {
    if (dsas.length > 0 && !dsaId) setDsaId(dsas[0].id);
  }, [dsas, dsaId]);

  const mutation = useMutation({
    mutationFn: logActivation,
    onSuccess: () => {
      setSuccess(true);
      void queryClient.invalidateQueries({ queryKey: ['tl-dashboard'] });
      setTimeout(() => navigate('/tl'), 1500);
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e.response?.data?.error || 'Failed to log activation');
    },
  });

  const captureLocation = () => {
    setLocationStatus('loading');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude);
        setLongitude(pos.coords.longitude);
        setLocationStatus('found');
      },
      () => setLocationStatus('error'),
      { timeout: 10000 }
    );
  };

  const handleSubmit = () => {
    setError('');
    if (!dsaId) { setError('Select a DSA'); return; }
    mutation.mutate({ dsaId, count, hourSlot, date, latitude, longitude, notes: notes || undefined });
  };

  if (success) {
    return (
      <Layout title="Log Activation" showBack backTo="/tl">
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <CheckCircle size={64} className="text-[#00843D]" />
          <p className="text-xl font-bold text-slate-800">Activation Logged!</p>
          <p className="text-slate-500 text-sm">Redirecting to dashboard...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Log Activation" showBack backTo="/tl">
      <div className="px-4 py-4 space-y-4 pb-24">

        {/* Select DSA */}
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <label className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-2 block">
            Select DSA *
          </label>
          <div className="grid grid-cols-1 gap-2">
            {dsas.map((dsa) => (
              <button
                key={dsa.id}
                onClick={() => setDsaId(dsa.id)}
                className={`px-4 py-3 rounded-xl text-left font-semibold text-sm transition-all ${
                  dsaId === dsa.id
                    ? 'bg-[#00843D] text-white shadow-md'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {dsa.name}
              </button>
            ))}
          </div>
        </div>

        {/* Count */}
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <label className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-2 block">
            Count
          </label>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setCount((c) => Math.max(1, c - 1))}
              className="w-12 h-12 rounded-full bg-slate-100 text-slate-700 text-2xl font-bold flex items-center justify-center hover:bg-slate-200 active:scale-95 transition-all"
            >
              −
            </button>
            <span className="text-3xl font-black text-slate-800 w-16 text-center">{count}</span>
            <button
              onClick={() => setCount((c) => c + 1)}
              className="w-12 h-12 rounded-full bg-[#00843D] text-white text-2xl font-bold flex items-center justify-center hover:bg-[#006B31] active:scale-95 transition-all"
            >
              +
            </button>
          </div>
        </div>

        {/* Hour Slot */}
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <label className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-2 block">
            Hour Slot
          </label>
          <select
            value={hourSlot}
            onChange={(e) => setHourSlot(e.target.value)}
            className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-[#00843D] bg-white transition-colors"
          >
            {getHourSlots().map((slot) => (
              <option key={slot} value={slot}>{slot}</option>
            ))}
          </select>
        </div>

        {/* Date */}
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <label className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-2 block">
            Date
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-[#00843D] transition-colors"
          />
        </div>

        {/* GPS Location */}
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <label className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-2 block">
            GPS Location (Optional)
          </label>
          <button
            onClick={captureLocation}
            disabled={locationStatus === 'loading'}
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all ${
              locationStatus === 'found'
                ? 'bg-green-50 border-2 border-green-300 text-green-700'
                : locationStatus === 'error'
                ? 'bg-red-50 border-2 border-red-200 text-red-600'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border-2 border-transparent'
            }`}
          >
            <MapPin size={16} />
            {locationStatus === 'idle' && '📍 Capture Location'}
            {locationStatus === 'loading' && 'Getting location...'}
            {locationStatus === 'found' && `✓ ${latitude?.toFixed(4)}, ${longitude?.toFixed(4)}`}
            {locationStatus === 'error' && 'Location unavailable'}
          </button>
        </div>

        {/* Notes */}
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <label className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-2 block">
            Notes (Optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any additional notes..."
            rows={3}
            className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-[#00843D] resize-none transition-colors"
          />
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
            {error}
          </div>
        )}
      </div>

      {/* Submit Button - Fixed */}
      <div className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto px-4 pb-6 pt-3 bg-gradient-to-t from-slate-100">
        <button
          onClick={handleSubmit}
          disabled={mutation.isPending}
          className="w-full bg-[#00843D] hover:bg-[#006B31] disabled:bg-slate-300 text-white font-bold text-lg rounded-2xl py-4 shadow-xl transition-all active:scale-98"
        >
          {mutation.isPending ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              Logging...
            </span>
          ) : (
            '⊕ LOG ACTIVATION'
          )}
        </button>
      </div>
    </Layout>
  );
}
