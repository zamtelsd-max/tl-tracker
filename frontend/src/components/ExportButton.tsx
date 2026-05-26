import { useState } from 'react';

interface ExportButtonProps {
  onExport: () => Promise<void>;
  label?: string;
}

export default function ExportButton({ onExport, label = 'Export Excel' }: ExportButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleClick = async () => {
    setLoading(true);
    setError('');
    try {
      await onExport();
    } catch {
      setError('Export failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
      <button
        onClick={handleClick}
        disabled={loading}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 18px',
          background: loading ? '#aaa' : '#217346',
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          fontWeight: 700,
          fontSize: 14,
          cursor: loading ? 'not-allowed' : 'pointer',
          boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
          transition: 'background 0.2s',
          whiteSpace: 'nowrap',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        {loading ? 'Downloading...' : label}
      </button>
      {error && <span style={{ color: '#c0392b', fontSize: 12 }}>{error}</span>}
    </div>
  );
}
