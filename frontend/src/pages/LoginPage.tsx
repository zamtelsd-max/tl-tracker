import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { login } from '../api';
import type { User } from '../types';

const HOUR_SLOTS = [
  '08:00-09:00', '09:00-10:00', '10:00-11:00', '11:00-12:00',
  '12:00-13:00', '13:00-14:00', '14:00-15:00', '15:00-16:00',
  '16:00-17:00', '17:00-18:00',
];

export function getCurrentHourSlot(): string {
  const hour = new Date().getHours();
  if (hour < 8) return '08:00-09:00';
  if (hour >= 18) return '17:00-18:00';
  return `${String(hour).padStart(2, '0')}:00-${String(hour + 1).padStart(2, '0')}:00`;
}

export function getHourSlots(): string[] {
  return HOUR_SLOTS;
}

export function formatDate(d?: Date): string {
  const date = d || new Date();
  return date.toISOString().split('T')[0];
}

export default function LoginPage() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [staffId, setStaffId] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleDigit = (d: string) => {
    if (pin.length < 4) setPin((p) => p + d);
  };

  const handleBackspace = () => setPin((p) => p.slice(0, -1));

  const handleSubmit = async () => {
    if (!staffId.trim()) { setError('Enter your Staff ID'); return; }
    if (pin.length < 4) { setError('Enter 4-digit PIN'); return; }

    setLoading(true);
    setError('');
    try {
      const res = await login(staffId.trim().toUpperCase(), pin);
      if (res.success) {
        setAuth(res.data.user as User, res.data.token);
        const roleMap: Record<string, string> = {
          TL: '/tl', ASE: '/ase', ZBM: '/zbm', HSD: '/hsd', ADMIN: '/admin',
        };
        navigate(roleMap[res.data.user.role] || '/login');
      } else {
        setError(res.error || 'Login failed');
        setPin('');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network error';
      const axiosError = err as { response?: { data?: { error?: string } } };
      setError(axiosError.response?.data?.error || msg);
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  const PinDot = ({ filled }: { filled: boolean }) => (
    <div
      className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${
        filled ? 'bg-white border-white scale-110' : 'border-white/50'
      }`}
    />
  );

  return (
    <div className="min-h-screen flex flex-col items-center justify-center zamtel-gradient px-6">
      {/* Logo area */}
      <div className="text-center mb-8">
        <div className="w-20 h-20 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center mx-auto mb-4 shadow-xl">
          <span className="text-white font-black text-2xl tracking-tight">ZT</span>
        </div>
        <h1 className="text-white text-2xl font-bold tracking-tight">TL Tracker</h1>
        <p className="text-[#E4007C] text-sm font-semibold mt-1 drop-shadow">Create Your World</p>
        <p className="text-green-200 text-xs mt-1">Zamtel Sales Performance</p>
      </div>

      {/* Login card */}
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        {/* Staff ID */}
        <div className="mb-4">
          <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1 block">
            Staff ID
          </label>
          <input
            type="text"
            value={staffId}
            onChange={(e) => setStaffId(e.target.value.toUpperCase())}
            placeholder="e.g. TL-LUS01"
            className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-center text-lg font-bold tracking-widest focus:outline-none focus:border-[#00843D] transition-colors"
            autoComplete="off"
            autoCapitalize="characters"
          />
        </div>

        {/* PIN display + text input */}
        <div className="mb-4">
          <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2 block">
            4-Digit PIN
          </label>
          <input
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={4}
            value={pin}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, '').slice(0, 4);
              setPin(v);
            }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
            placeholder="● ● ● ●"
            className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-center text-2xl font-bold tracking-widest focus:outline-none focus:border-[#00843D] transition-colors"
          />
          <p className="text-center text-xs text-slate-400 mt-1">Type or use keypad below</p>
          <div className="flex justify-center gap-4 py-2">
            {[0, 1, 2, 3].map((i) => (
              <PinDot key={i} filled={i < pin.length} />
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2 mb-3 text-center">
            {error}
          </div>
        )}

        {/* PIN keypad */}
        <div className="grid grid-cols-3 gap-3">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
            <button
              key={d}
              onClick={() => handleDigit(d)}
              className="bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 font-bold text-xl rounded-xl py-4 transition-all duration-100 active:scale-95"
            >
              {d}
            </button>
          ))}
          {/* Bottom row: empty, 0, backspace */}
          <button
            onClick={() => { setPin(''); setStaffId(''); setError(''); }}
            className="bg-slate-50 hover:bg-slate-100 text-slate-500 text-xs font-semibold rounded-xl py-4 transition-all duration-100 active:scale-95"
          >
            CLR
          </button>
          <button
            onClick={() => handleDigit('0')}
            className="bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 font-bold text-xl rounded-xl py-4 transition-all duration-100 active:scale-95"
          >
            0
          </button>
          <button
            onClick={handleBackspace}
            className="bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl py-4 flex items-center justify-center transition-all duration-100 active:scale-95"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22 3H7c-.69 0-1.23.35-1.59.88L0 12l5.41 8.11c.36.53.9.89 1.59.89h15c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-3 12.59L17.59 17 14 13.41 10.41 17 9 15.59 12.59 12 9 8.41 10.41 7 14 10.59 17.59 7 19 8.41 15.41 12 19 15.59z"/>
            </svg>
          </button>
        </div>

        {/* Login button */}
        <button
          onClick={handleSubmit}
          disabled={loading || pin.length < 4 || !staffId.trim()}
          className="w-full mt-4 bg-[#00843D] hover:bg-[#006B31] disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold text-base rounded-xl py-4 transition-all duration-150 active:scale-98 shadow-lg"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              Signing in...
            </span>
          ) : (
            'Login'
          )}
        </button>

        <p className="text-center text-xs text-slate-400 mt-3">
          Zamtel · Secure Portal
        </p>
      </div>
    </div>
  );
}
