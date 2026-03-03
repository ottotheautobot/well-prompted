'use client';

import { useEffect, useState, useCallback } from 'react';
import NavBar from '@/components/NavBar';

type LogLevel = 'info' | 'warn' | 'error';
type LogCategory = 'generate' | 'audio' | 'render' | 'render-check' | 'publish' | 'approve' | 'regen' | 'schedule' | 'system';

interface LogEntry {
  id: string;
  created_at: string;
  level: LogLevel;
  category: LogCategory;
  message: string;
  post_id: string | null;
  details: Record<string, unknown> | null;
}

const LEVEL_COLORS: Record<LogLevel, { text: string; bg: string; border: string }> = {
  info:  { text: '#34D399', bg: '#05200F30', border: '#14532D50' },
  warn:  { text: '#FBBF24', bg: '#30200030', border: '#78400050' },
  error: { text: '#F87171', bg: '#3F0A0A30', border: '#7F1D1D50' },
};

const CAT_COLORS: Record<string, string> = {
  generate:     '#818CF8',
  audio:        '#C084FC',
  render:       '#60A5FA',
  'render-check': '#38BDF8',
  publish:      '#34D399',
  approve:      '#0085FF',
  regen:        '#FF2D78',
  schedule:     '#FBBF24',
  system:       '#5A7090',
};

const CATEGORIES: LogCategory[] = ['generate', 'audio', 'render', 'render-check', 'publish', 'approve', 'regen', 'schedule', 'system'];

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60)  return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function LogsPage() {
  const [logs, setLogs]           = useState<LogEntry[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [levelFilter, setLevel]   = useState<string>('all');
  const [catFilter, setCat]       = useState<string>('all');
  const [expanded, setExpanded]   = useState<string | null>(null);
  const [autoRefresh, setAuto]    = useState(true);

  const fetchLogs = useCallback(async () => {
    const params = new URLSearchParams({ limit: '200' });
    if (levelFilter !== 'all') params.set('level', levelFilter);
    if (catFilter !== 'all')   params.set('category', catFilter);
    if (search.trim())         params.set('search', search.trim());
    const res = await fetch(`/api/logs?${params}`);
    if (res.ok) setLogs(await res.json());
    setLoading(false);
  }, [levelFilter, catFilter, search]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  useEffect(() => {
    if (!autoRefresh) return;
    const t = setInterval(fetchLogs, 10000);
    return () => clearInterval(t);
  }, [autoRefresh, fetchLogs]);

  const errorCount = logs.filter(l => l.level === 'error').length;

  return (
    <div style={{ minHeight: '100vh', background: '#080B14', color: '#E2E8F0' }}>
      <NavBar />
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '28px 24px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0, fontFamily: 'sans-serif' }}>Logs</h1>
            {errorCount > 0 && (
              <span style={{ fontSize: 11, color: '#F87171', background: '#3F0A0A40', border: '1px solid #7F1D1D50', padding: '2px 10px', borderRadius: 20, fontFamily: 'sans-serif' }}>
                {errorCount} error{errorCount > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <label style={{ fontSize: 12, color: '#5A7090', fontFamily: 'sans-serif', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input type="checkbox" checked={autoRefresh} onChange={e => setAuto(e.target.checked)} />
              Auto-refresh
            </label>
            <button onClick={fetchLogs} style={{ background: '#0B1220', border: '1px solid #1A2540', color: '#5A7090', padding: '6px 14px', borderRadius: 8, fontSize: 12, fontFamily: 'sans-serif', cursor: 'pointer' }}>
              ↻ Refresh
            </button>
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Search messages..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ flex: 1, minWidth: 200, background: '#0B1220', border: '1px solid #1A2540', borderRadius: 8, padding: '8px 14px', fontSize: 13, color: '#E2E8F0', fontFamily: 'sans-serif', outline: 'none' }}
          />
          <select value={levelFilter} onChange={e => setLevel(e.target.value)} style={selectStyle}>
            <option value="all">All levels</option>
            <option value="info">Info</option>
            <option value="warn">Warn</option>
            <option value="error">Errors only</option>
          </select>
          <select value={catFilter} onChange={e => setCat(e.target.value)} style={selectStyle}>
            <option value="all">All categories</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Log list */}
        {loading ? (
          <div style={{ color: '#5A7090', fontFamily: 'sans-serif', fontSize: 13, textAlign: 'center', padding: 40 }}>Loading...</div>
        ) : logs.length === 0 ? (
          <div style={{ color: '#5A7090', fontFamily: 'sans-serif', fontSize: 13, textAlign: 'center', padding: 40 }}>
            No logs yet — they'll appear here as workflows run.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {logs.map(log => {
              const lc = LEVEL_COLORS[log.level] || LEVEL_COLORS.info;
              const isExpanded = expanded === log.id;
              const hasDetails = log.details && Object.keys(log.details).length > 0;
              return (
                <div
                  key={log.id}
                  onClick={() => hasDetails ? setExpanded(isExpanded ? null : log.id) : undefined}
                  style={{
                    background: isExpanded ? '#0B1220' : '#080B14',
                    border: `1px solid ${isExpanded ? '#1A2540' : '#0F1828'}`,
                    borderLeft: `3px solid ${lc.border}`,
                    borderRadius: 8,
                    padding: '10px 14px',
                    cursor: hasDetails ? 'pointer' : 'default',
                    transition: 'background 0.1s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    {/* Level badge */}
                    <span style={{ fontSize: 10, fontWeight: 700, fontFamily: 'sans-serif', color: lc.text, background: lc.bg, border: `1px solid ${lc.border}`, padding: '2px 8px', borderRadius: 4, minWidth: 38, textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {log.level}
                    </span>
                    {/* Category badge */}
                    <span style={{ fontSize: 10, fontFamily: 'sans-serif', color: CAT_COLORS[log.category] || '#5A7090', background: `${CAT_COLORS[log.category]}18` || '#1A2540', border: `1px solid ${CAT_COLORS[log.category]}30`, padding: '2px 8px', borderRadius: 4, minWidth: 60, textAlign: 'center' }}>
                      {log.category}
                    </span>
                    {/* Message */}
                    <span style={{ flex: 1, fontSize: 13, fontFamily: 'sans-serif', color: '#C8D8E8' }}>{log.message}</span>
                    {/* Post ID */}
                    {log.post_id && (
                      <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#3A5070', background: '#0B1220', border: '1px solid #1A2540', padding: '2px 8px', borderRadius: 4 }} title={log.post_id}>
                        {log.post_id.slice(0, 8)}
                      </span>
                    )}
                    {/* Time */}
                    <span style={{ fontSize: 11, color: '#3A5070', fontFamily: 'sans-serif', whiteSpace: 'nowrap' }}>{timeAgo(log.created_at)}</span>
                    {/* Expand arrow */}
                    {hasDetails && (
                      <span style={{ fontSize: 11, color: '#3A5070' }}>{isExpanded ? '▲' : '▼'}</span>
                    )}
                  </div>

                  {/* Expanded details */}
                  {isExpanded && hasDetails && (
                    <pre style={{ marginTop: 10, padding: 12, background: '#060910', border: '1px solid #1A2540', borderRadius: 6, fontSize: 11, color: '#5A7090', fontFamily: 'monospace', overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {JSON.stringify(log.details, null, 2)}
                    </pre>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  background: '#0B1220', border: '1px solid #1A2540', borderRadius: 8,
  padding: '8px 12px', fontSize: 12, color: '#E2E8F0', fontFamily: 'sans-serif',
  outline: 'none', cursor: 'pointer',
};
