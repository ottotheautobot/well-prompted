'use client';

import { useEffect, useState } from 'react';
import NavBar from '@/components/NavBar';

// Schedule slots: Mon/Wed/Fri 8am+12pm, Tue/Thu 8am+6pm, Sat 10am, Sun 11am (all ET)
const WEEKLY_SLOTS: Record<number, { label: string; hour: number; minute: number }[]> = {
  0: [{ label: '11:00 AM', hour: 11, minute: 0 }],                                        // Sun
  1: [{ label: '8:00 AM',  hour: 8,  minute: 0 }, { label: '12:00 PM', hour: 12, minute: 0 }], // Mon
  2: [{ label: '8:00 AM',  hour: 8,  minute: 0 }, { label: '6:00 PM',  hour: 18, minute: 0 }], // Tue
  3: [{ label: '8:00 AM',  hour: 8,  minute: 0 }, { label: '12:00 PM', hour: 12, minute: 0 }], // Wed
  4: [{ label: '8:00 AM',  hour: 8,  minute: 0 }, { label: '6:00 PM',  hour: 18, minute: 0 }], // Thu
  5: [{ label: '8:00 AM',  hour: 8,  minute: 0 }, { label: '12:00 PM', hour: 12, minute: 0 }], // Fri
  6: [{ label: '10:00 AM', hour: 10, minute: 0 }],                                        // Sat
};
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const CATEGORY_COLORS: Record<string, string> = {
  career: '#60A5FA', job_search: '#F472B6',
  communication: '#C084FC', writing: '#FBB040', thinking: '#34D399',
};
const CATEGORY_LABELS: Record<string, string> = {
  career: 'Career', job_search: 'Job Search',
  communication: 'Communication', writing: 'Writing', thinking: 'Thinking',
};
const STATUS_COLORS: Record<string, string> = {
  scheduled: '#22D3EE', pending_video_review: '#C084FC', approved: '#34D399', published: '#4ADE80',
};

interface ScheduledPost {
  id: string;
  bad_prompt: string;
  category: string;
  status: string;
  scheduled_at: string;
  video_url?: string;
}

// Get the ET date/time for a UTC ISO string
function toET(iso: string) {
  const d = new Date(iso);
  const etStr = d.toLocaleString('en-US', { timeZone: 'America/New_York' });
  return new Date(etStr);
}

// Given a year/month/day, get all slots for that day of week + match scheduled posts
function getDaySlots(year: number, month: number, day: number, posts: ScheduledPost[]) {
  const d = new Date(year, month, day);
  const dow = d.getDay();
  const slots = WEEKLY_SLOTS[dow] || [];
  return slots.map(slot => {
    // Find a post scheduled in this slot (within ±30 min of slot time, same ET date)
    const post = posts.find(p => {
      if (!p.scheduled_at) return false;
      const et = toET(p.scheduled_at);
      return (
        et.getFullYear() === year &&
        et.getMonth() === month &&
        et.getDate() === day &&
        et.getHours() === slot.hour
      );
    });
    return { ...slot, post: post || null };
  });
}

export default function SchedulePage() {
  const [today] = useState(new Date());
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSlot, setSelectedSlot] = useState<{ day: number; slotLabel: string; post: ScheduledPost | null } | null>(null);

  useEffect(() => {
    fetch('/api/schedule').then(r => r.json()).then(data => {
      setPosts(Array.isArray(data) ? data : (data.posts || []));
      setLoading(false);
    });
  }, []);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };

  // Build calendar grid (Sun-Sat weeks)
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // Pad to complete last week
  while (cells.length % 7 !== 0) cells.push(null);

  const isToday = (d: number) =>
    d === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();

  return (
    <div style={{ minHeight: '100vh', background: '#080B14', color: '#E2E8F0' }}>
      <NavBar />
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          <button onClick={prevMonth} style={navBtn}>‹</button>
          <h1 style={{ fontSize: 22, fontWeight: 800, fontFamily: 'sans-serif', margin: 0, minWidth: 220, textAlign: 'center' }}>
            {MONTH_NAMES[viewMonth]} {viewYear}
          </h1>
          <button onClick={nextMonth} style={navBtn}>›</button>
          <div style={{ flex: 1 }} />
          <div style={{ fontSize: 12, color: '#5A7090', fontFamily: 'sans-serif' }}>
            12 slots/week · All times ET
          </div>
        </div>

        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
          {/* Calendar */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Day headers */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 4 }}>
              {DAY_NAMES.map(d => (
                <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#4A6080', fontFamily: 'sans-serif', padding: '6px 0' }}>
                  {d}
                </div>
              ))}
            </div>

            {/* Weeks */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
              {cells.map((day, i) => {
                if (!day) return <div key={i} style={{ minHeight: 90 }} />;
                const daySlots = getDaySlots(viewYear, viewMonth, day, posts);
                const hasPost = daySlots.some(s => s.post);
                const todayDay = isToday(day);

                return (
                  <div key={i} style={{
                    background: todayDay ? '#0D1F30' : '#0B1220',
                    border: `1px solid ${todayDay ? '#0085FF50' : '#1A2540'}`,
                    borderRadius: 10, padding: 8, minHeight: 90,
                    cursor: hasPost ? 'pointer' : 'default',
                  }}
                    onClick={() => {
                      if (hasPost) {
                        const s = daySlots.find(s => s.post);
                        if (s) setSelectedSlot({ day, slotLabel: s.label, post: s.post });
                      }
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: todayDay ? 800 : 400, color: todayDay ? '#0085FF' : '#8A9AB0', marginBottom: 6, fontFamily: 'sans-serif' }}>
                      {day}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {daySlots.map((slot, si) => (
                        <div
                          key={si}
                          onClick={e => { e.stopPropagation(); setSelectedSlot({ day, slotLabel: slot.label, post: slot.post }); }}
                          style={{
                            borderRadius: 5, padding: '2px 6px', fontSize: 9, fontWeight: 600, fontFamily: 'sans-serif',
                            cursor: 'pointer',
                            background: slot.post
                              ? (CATEGORY_COLORS[slot.post.category] || '#0085FF') + '25'
                              : '#1A2540',
                            color: slot.post
                              ? (CATEGORY_COLORS[slot.post.category] || '#0085FF')
                              : '#2A3550',
                            border: `1px solid ${slot.post ? (CATEGORY_COLORS[slot.post.category] || '#0085FF') + '40' : '#1E2A40'}`,
                          }}
                        >
                          {slot.label} {slot.post ? '●' : '·'}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Side panel */}
          <div style={{ width: 280, flexShrink: 0 }}>
            {selectedSlot ? (
              <div style={{ background: '#0B1220', border: '1px solid #1A2540', borderRadius: 14, padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#E2E8F0', fontFamily: 'sans-serif' }}>
                      {MONTH_NAMES[viewMonth].slice(0, 3)} {selectedSlot.day}
                    </div>
                    <div style={{ fontSize: 12, color: '#5A7090', fontFamily: 'sans-serif' }}>{selectedSlot.slotLabel} ET</div>
                  </div>
                  <button onClick={() => setSelectedSlot(null)} style={{ background: 'none', border: 'none', color: '#4A6080', fontSize: 18, cursor: 'pointer' }}>✕</button>
                </div>

                {selectedSlot.post ? (
                  <div>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: CATEGORY_COLORS[selectedSlot.post.category] || '#9CA3AF', fontFamily: 'sans-serif', letterSpacing: 0.5 }}>
                        {CATEGORY_LABELS[selectedSlot.post.category] || selectedSlot.post.category}
                      </span>
                      <span style={{ fontSize: 10, fontWeight: 600, color: STATUS_COLORS[selectedSlot.post.status] || '#9CA3AF', fontFamily: 'sans-serif' }}>
                        {selectedSlot.post.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    {selectedSlot.post.video_url && (
                      <video src={selectedSlot.post.video_url} muted loop autoPlay playsInline style={{ width: '100%', borderRadius: 10, marginBottom: 12, border: '1px solid #1A2540' }} />
                    )}
                    <p style={{ fontSize: 12, color: '#8A9AB0', fontFamily: 'sans-serif', lineHeight: 1.5, margin: '0 0 16px' }}>
                      {selectedSlot.post.bad_prompt?.slice(0, 100)}
                    </p>
                    <a href="/queue" style={{ display: 'block', textAlign: 'center', fontSize: 12, color: '#0085FF', fontFamily: 'sans-serif', textDecoration: 'none', padding: '8px 0', border: '1px solid #0085FF30', borderRadius: 8 }}>
                      View in Queue →
                    </a>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '20px 0' }}>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>📭</div>
                    <div style={{ fontSize: 12, color: '#4A6080', fontFamily: 'sans-serif' }}>No post scheduled for this slot</div>
                    <a href="/queue" style={{ display: 'inline-block', marginTop: 14, fontSize: 12, color: '#0085FF', fontFamily: 'sans-serif', textDecoration: 'none' }}>
                      + Queue a post →
                    </a>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ background: '#0B1220', border: '1px solid #1A2540', borderRadius: 14, padding: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#E2E8F0', fontFamily: 'sans-serif', marginBottom: 16 }}>Weekly Slots</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    { days: 'Mon / Wed / Fri', times: '8:00 AM · 12:00 PM' },
                    { days: 'Tue / Thu', times: '8:00 AM · 6:00 PM' },
                    { days: 'Saturday', times: '10:00 AM' },
                    { days: 'Sunday', times: '11:00 AM' },
                  ].map(row => (
                    <div key={row.days} style={{ background: '#080B14', border: '1px solid #1A2540', borderRadius: 8, padding: '10px 12px' }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#E2E8F0', fontFamily: 'sans-serif' }}>{row.days}</div>
                      <div style={{ fontSize: 11, color: '#5A7090', fontFamily: 'sans-serif', marginTop: 2 }}>{row.times} ET</div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 16, fontSize: 11, color: '#4A6080', fontFamily: 'sans-serif', textAlign: 'center' }}>
                  Click a slot on the calendar to see details
                </div>

                {/* Upcoming posts */}
                {!loading && posts.filter(p => new Date(p.scheduled_at) > new Date()).length > 0 && (
                  <div style={{ marginTop: 20, borderTop: '1px solid #1A2540', paddingTop: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#5A7090', fontFamily: 'sans-serif', letterSpacing: 1, marginBottom: 10 }}>UPCOMING</div>
                    {posts
                      .filter(p => new Date(p.scheduled_at) > new Date())
                      .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
                      .slice(0, 4)
                      .map(p => (
                        <div key={p.id} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                          <div style={{ width: 8, height: 8, borderRadius: 2, background: CATEGORY_COLORS[p.category] || '#0085FF', flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 11, color: '#E2E8F0', fontFamily: 'sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {p.bad_prompt?.slice(0, 40)}
                            </div>
                            <div style={{ fontSize: 10, color: '#4A6080', fontFamily: 'sans-serif' }}>
                              {toET(p.scheduled_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {toET(p.scheduled_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const navBtn: React.CSSProperties = {
  background: '#0B1220', border: '1px solid #1A2540', color: '#E2E8F0',
  width: 36, height: 36, borderRadius: 8, fontSize: 20, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
