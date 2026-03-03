'use client';

import { useEffect, useState } from 'react';
import NavBar from '@/components/NavBar';

const SCHEDULE_SLOTS = [
  { days: 'Monday',    times: ['8:00 AM ET', '12:00 PM ET'] },
  { days: 'Tuesday',   times: ['8:00 AM ET', '6:00 PM ET'] },
  { days: 'Wednesday', times: ['8:00 AM ET', '12:00 PM ET'] },
  { days: 'Thursday',  times: ['8:00 AM ET', '6:00 PM ET'] },
  { days: 'Friday',    times: ['8:00 AM ET', '12:00 PM ET'] },
  { days: 'Saturday',  times: ['10:00 AM ET'] },
  { days: 'Sunday',    times: ['11:00 AM ET'] },
];

export default function SettingsPage() {
  const [publisherEnabled, setPublisherEnabled] = useState<boolean | null>(null);
  const [publisherLoading, setPublisherLoading] = useState(false);
  const [igToken] = useState(process.env.NEXT_PUBLIC_IG_ACCOUNT_ID || '35158877633711262');

  useEffect(() => {
    fetch('/api/settings/publisher')
      .then(r => r.json())
      .then(d => { if (d.enabled !== undefined) setPublisherEnabled(d.enabled); })
      .catch(() => {});
  }, []);

  const togglePublisher = async () => {
    setPublisherLoading(true);
    const action = publisherEnabled ? 'disable' : 'enable';
    const res = await fetch('/api/settings/publisher', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    const data = await res.json();
    if (data.success) setPublisherEnabled(data.enabled);
    else alert(data.error || 'Failed');
    setPublisherLoading(false);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#080B14', color: '#E2E8F0' }}>
      <NavBar />
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px' }}>

        <h1 style={{ fontSize: 22, fontWeight: 800, fontFamily: 'sans-serif', margin: '0 0 28px' }}>Settings</h1>

        {/* Instagram Connection */}
        <Card title="Instagram Connection" icon="📸">
          <Row label="Account">
            <span style={valueStyle}>@well.prompted</span>
          </Row>
          <Row label="Account ID">
            <span style={monoStyle}>35158877633711262</span>
          </Row>
          <Row label="Token Status">
            <span style={{ fontSize: 12, color: '#34D399', fontFamily: 'sans-serif', background: '#05200F30', border: '1px solid #14532D50', padding: '3px 10px', borderRadius: 6 }}>
              ● Active (long-lived)
            </span>
          </Row>
          <Row label="Access Token">
            <span style={{ ...monoStyle, color: '#4A6080' }}>IGAAR••••••••••••••••</span>
          </Row>
          <div style={{ marginTop: 12 }}>
            <button style={btnOutline('#5A7090')} disabled>🔄 Refresh Token (manual — expires every 60 days)</button>
          </div>
        </Card>

        {/* Publisher */}
        <Card title="Auto-Publisher" icon="🚀">
          <Row label="Publisher Cron">
            {publisherEnabled === null ? (
              <span style={{ ...valueStyle, color: '#4A6080' }}>Loading...</span>
            ) : (
              <span style={{ fontSize: 12, color: publisherEnabled ? '#34D399' : '#F87171', fontFamily: 'sans-serif', background: publisherEnabled ? '#05200F30' : '#3F0A0A30', border: `1px solid ${publisherEnabled ? '#14532D50' : '#7F1D1D50'}`, padding: '3px 10px', borderRadius: 6 }}>
                {publisherEnabled ? '● Active' : '○ Paused'}
              </span>
            )}
          </Row>
          <Row label="Job ID">
            <span style={monoStyle}>18915557-b0f0-44f0-9d65-3e8ff1907657</span>
          </Row>
          <div style={{ marginTop: 14, display: 'flex', gap: 10 }}>
            <button
              onClick={togglePublisher}
              disabled={publisherLoading || publisherEnabled === null}
              style={publisherEnabled ? btnOutline('#F87171') : btn('#059669')}
            >
              {publisherLoading ? '⏳ Updating...' : publisherEnabled ? '⏸ Pause Publisher' : '▶ Enable Publisher'}
            </button>
          </div>
          <p style={{ fontSize: 11, color: '#4A6080', fontFamily: 'sans-serif', marginTop: 10 }}>
            When active, posts with status "scheduled" are automatically published at their scheduled time.
            Only enable when you have approved posts in the queue.
          </p>
        </Card>

        {/* Publishing Schedule */}
        <Card title="Publishing Schedule" icon="📅">
          <p style={{ fontSize: 12, color: '#5A7090', fontFamily: 'sans-serif', marginBottom: 14 }}>
            12 slots per week · All times Eastern
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {SCHEDULE_SLOTS.map(row => (
              <div key={row.days} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#080B14', border: '1px solid #1A2540', borderRadius: 8, padding: '10px 14px' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#E2E8F0', fontFamily: 'sans-serif', width: 110 }}>{row.days}</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  {row.times.map(t => (
                    <span key={t} style={{ fontSize: 12, color: '#5A7090', fontFamily: 'sans-serif', background: '#0B1220', border: '1px solid #1A2540', padding: '2px 10px', borderRadius: 6 }}>{t}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Danger Zone */}
        <Card title="Danger Zone" icon="⚠️" borderColor="#7F1D1D">
          <p style={{ fontSize: 12, color: '#5A7090', fontFamily: 'sans-serif', marginBottom: 12 }}>
            Irreversible actions. Use with caution.
          </p>
          <button style={btnOutline('#F87171')} disabled>🗑 Clear All Draft Posts (coming soon)</button>
        </Card>

      </div>
    </div>
  );
}

function Card({ title, icon, children, borderColor = '#1A2540' }: { title: string; icon: string; children: React.ReactNode; borderColor?: string }) {
  return (
    <div style={{ background: '#0B1220', border: `1px solid ${borderColor}`, borderRadius: 14, padding: '22px 24px', marginBottom: 20 }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: '#E2E8F0', fontFamily: 'sans-serif', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>{icon}</span> {title}
      </div>
      {children}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
      <span style={{ fontSize: 12, color: '#5A7090', fontFamily: 'sans-serif', width: 140 }}>{label}</span>
      {children}
    </div>
  );
}

const valueStyle: React.CSSProperties = { fontSize: 13, color: '#E2E8F0', fontFamily: 'sans-serif' };
const monoStyle:  React.CSSProperties = { fontSize: 11, color: '#8A9AB0', fontFamily: 'monospace' };
const btn = (bg: string): React.CSSProperties => ({
  background: bg, color: '#fff', border: 'none', padding: '9px 20px',
  borderRadius: 8, fontSize: 13, fontWeight: 600, fontFamily: 'sans-serif', cursor: 'pointer',
});
const btnOutline = (color: string): React.CSSProperties => ({
  background: 'transparent', color, border: `1px solid ${color}55`,
  padding: '9px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600,
  fontFamily: 'sans-serif', cursor: 'pointer',
});
