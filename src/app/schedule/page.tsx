'use client';

import { useEffect, useState, useCallback } from 'react';
import NavBar from '@/components/NavBar';

interface Post {
  id: string;
  bad_prompt: string;
  category: string;
  format: string;
  status: string;
  scheduled_at: string | null;
}

const SLOT_SCHEDULE: Record<number, string[]> = {
  0: ['11:00'], 1: ['08:00','12:00'], 2: ['08:00','18:00'],
  3: ['08:00','12:00'], 4: ['08:00','18:00'], 5: ['08:00','12:00'], 6: ['10:00'],
};
const DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const DOW_FULL = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

const CAT_COLORS: Record<string,string> = {
  career:'#818CF8', job_search:'#60A5FA', communication:'#34D399',
  writing:'#FBBF24', thinking:'#F472B6',
};

function getETOffset(): number {
  const now = new Date();
  const jan = new Date(now.getFullYear(),0,1).getTimezoneOffset();
  const jul = new Date(now.getFullYear(),6,1).getTimezoneOffset();
  return now.getTimezoneOffset() < Math.max(jan,jul) ? -4 : -5;
}

interface SlotEntry { utc: Date; key: string; label: string; timeLabel: string; }

function generateSlots(daysAhead = 35): SlotEntry[] {
  const et = getETOffset();
  const now = new Date();
  const slots: SlotEntry[] = [];
  for (let d = 0; d < daysAhead; d++) {
    const base = new Date(now); base.setUTCDate(base.getUTCDate() + d);
    const etMs = base.getTime() + et * 3600000;
    const etDate = new Date(etMs);
    const dow = etDate.getUTCDay();
    for (const t of SLOT_SCHEDULE[dow] || []) {
      const [h,m] = t.split(':').map(Number);
      const utc = new Date(Date.UTC(etDate.getUTCFullYear(),etDate.getUTCMonth(),etDate.getUTCDate(),h-et,m,0));
      if (utc <= now) continue;
      const mo = etDate.getUTCMonth()+1, dy = etDate.getUTCDate();
      const hDisp = h > 12 ? h-12 : h===0 ? 12 : h;
      const ampm = h >= 12 ? 'pm' : 'am';
      slots.push({ utc, key: utc.toISOString(), label: `${DOW[dow]} ${mo}/${dy}`, timeLabel: `${hDisp}${ampm}` });
    }
  }
  return slots;
}

// Group slots into weeks (Mon–Sun)
function groupByWeek(slots: SlotEntry[]): SlotEntry[][][] {
  if (!slots.length) return [];
  // Find Monday of first slot's week
  const getMonday = (d: Date) => {
    const et = getETOffset();
    const etMs = d.getTime() + et * 3600000;
    const etDate = new Date(etMs);
    const dow = etDate.getUTCDay();
    const diff = (dow === 0 ? -6 : 1 - dow);
    const mon = new Date(etDate); mon.setUTCDate(etDate.getUTCDate() + diff);
    return mon;
  };
  const weeks: SlotEntry[][][] = [];
  let weekStart = getMonday(slots[0].utc);
  let week: SlotEntry[][] = Array.from({length:7}, () => []);
  for (const slot of slots) {
    const etMs = slot.utc.getTime() + getETOffset() * 3600000;
    const etDate = new Date(etMs);
    const diffDays = Math.floor((etDate.getTime() - weekStart.getTime()) / 86400000);
    if (diffDays >= 7) {
      weeks.push(week);
      week = Array.from({length:7}, () => []);
      weekStart = getMonday(slot.utc);
    }
    const dow = etDate.getUTCDay();
    const col = dow === 0 ? 6 : dow - 1; // Mon=0 … Sun=6
    week[col].push(slot);
  }
  weeks.push(week);
  return weeks;
}

export default function SchedulePage() {
  const [pending, setPending] = useState<Post[]>([]);
  const [scheduled, setScheduled] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoLoading, setAutoLoading] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    const [pRes, sRes] = await Promise.all([
      fetch('/api/posts?status=pending_schedule').then(r => r.json()),
      fetch('/api/posts?status=scheduled').then(r => r.json()),
    ]);
    setPending(Array.isArray(pRes) ? pRes : []);
    setScheduled(Array.isArray(sRes) ? sRes : []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const assign = async (postId: string, slotKey: string | null) => {
    await fetch('/api/schedule/assign', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: postId, scheduled_at: slotKey }),
    });
    await fetchAll();
  };

  const autoSchedule = async () => {
    setAutoLoading(true);
    await fetch('/api/schedule/auto', { method: 'POST' });
    await fetchAll();
    setAutoLoading(false);
  };

  const slots = generateSlots(35);
  const slotMap = new Map<string, Post | null>();
  for (const s of slots) slotMap.set(s.key, null);
  for (const p of scheduled) {
    if (p.scheduled_at) {
      const key = new Date(p.scheduled_at).toISOString();
      if (slotMap.has(key)) slotMap.set(key, p);
    }
  }

  const weeks = groupByWeek(slots);

  // Get week label
  const getWeekLabel = (week: SlotEntry[][]) => {
    const first = week.find(col => col.length)?.find(Boolean);
    if (!first) return '';
    const et = getETOffset();
    const etDate = new Date(first.utc.getTime() + et*3600000);
    return `Week of ${DOW_FULL[new Date(etDate.getTime() - (etDate.getUTCDay()===0?6:etDate.getUTCDay()-1)*86400000).getUTCDay()]}`; // simplified
  };

  const handleDrop = (slotKey: string) => {
    if (!draggingId) return;
    setDragOver(null);
    // If slot is occupied, swap — move existing post back to pending
    const existing = slotMap.get(slotKey);
    if (existing && existing.id !== draggingId) {
      assign(existing.id, null).then(() => assign(draggingId, slotKey));
    } else {
      assign(draggingId, slotKey);
    }
    setDraggingId(null);
  };

  const handleDropToSidebar = () => {
    if (!draggingId) return;
    const post = scheduled.find(p => p.id === draggingId);
    if (post) assign(draggingId, null);
    setDraggingId(null);
    setDragOver(null);
  };

  const catColor = (cat: string) => CAT_COLORS[cat] || '#5A7090';

  if (loading) return (
    <div style={{ minHeight:'100vh', background:'#080B14', color:'#5A7090', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'sans-serif' }}>
      <NavBar /><div style={{marginTop:80}}>Loading...</div>
    </div>
  );

  return (
    <div style={{ minHeight:'100vh', background:'#080B14', color:'#E2E8F0' }}>
      <NavBar />
      <div style={{ maxWidth:1100, margin:'0 auto', padding:'28px 24px' }}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
          <div>
            <h1 style={{ fontSize:20, fontWeight:800, margin:0, fontFamily:'sans-serif' }}>Schedule</h1>
            <p style={{ fontSize:12, color:'#5A7090', fontFamily:'sans-serif', margin:'4px 0 0' }}>
              Drag posts onto calendar slots · 12 slots/week
            </p>
          </div>
          <button
            onClick={autoSchedule}
            disabled={autoLoading || pending.length === 0}
            style={{ background: pending.length === 0 ? '#1A2540' : '#0085FF', color: pending.length === 0 ? '#3A5070' : '#fff', border:'none', padding:'10px 22px', borderRadius:10, fontSize:13, fontWeight:700, fontFamily:'sans-serif', cursor: pending.length === 0 ? 'default' : 'pointer' }}
          >
            {autoLoading ? '⏳ Scheduling...' : `⚡ Auto-Schedule${pending.length > 0 ? ` (${pending.length})` : ''}`}
          </button>
        </div>

        <div style={{ display:'flex', gap:20, alignItems:'flex-start' }}>

          {/* Sidebar — unscheduled posts */}
          <div
            style={{ width:220, flexShrink:0 }}
            onDragOver={e => { e.preventDefault(); setDragOver('sidebar'); }}
            onDragLeave={() => setDragOver(null)}
            onDrop={handleDropToSidebar}
          >
            <div style={{ fontSize:11, fontWeight:700, color:'#5A7090', fontFamily:'sans-serif', letterSpacing:2, marginBottom:10, textTransform:'uppercase' }}>
              Ready to Schedule ({pending.length})
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:8, minHeight:80, background: dragOver==='sidebar' ? '#0B1A2C' : 'transparent', borderRadius:10, padding: dragOver==='sidebar' ? 8 : 0, border: dragOver==='sidebar' ? '2px dashed #0085FF50' : '2px solid transparent', transition:'all 0.15s' }}>
              {pending.length === 0 && (
                <div style={{ fontSize:12, color:'#3A5070', fontFamily:'sans-serif', padding:'16px 8px', textAlign:'center' }}>
                  No posts waiting
                </div>
              )}
              {pending.map(post => (
                <PostChip
                  key={post.id}
                  post={post}
                  dragging={draggingId === post.id}
                  onDragStart={() => setDraggingId(post.id)}
                  onDragEnd={() => setDraggingId(null)}
                  catColor={catColor(post.category)}
                />
              ))}
            </div>
          </div>

          {/* Calendar */}
          <div style={{ flex:1, overflowX:'auto' }}>
            {weeks.map((week, wi) => {
              // Find any slot in this week
              const firstSlot = week.find(col => col.length > 0)?.[0];
              if (!firstSlot) return null;
              const et = getETOffset();
              const etDate = new Date(firstSlot.utc.getTime() + et*3600000);
              const dow = etDate.getUTCDay();
              const monDate = new Date(etDate); monDate.setUTCDate(etDate.getUTCDate() - (dow===0?6:dow-1));
              const mo = monDate.getUTCMonth()+1, dy = monDate.getUTCDate();
              return (
                <div key={wi} style={{ marginBottom:24 }}>
                  <div style={{ fontSize:11, color:'#3A5070', fontFamily:'sans-serif', letterSpacing:2, marginBottom:8, fontWeight:700 }}>
                    WEEK OF {['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'][mo-1]} {dy}
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:6 }}>
                    {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((dayName, col) => {
                      const dayCols = week[col];
                      const dayDate = new Date(monDate); dayDate.setUTCDate(monDate.getUTCDate() + col);
                      const isToday = new Date().toDateString() === new Date(dayDate.getTime() - et*3600000).toDateString();
                      return (
                        <div key={col}>
                          <div style={{ fontSize:11, fontWeight:700, fontFamily:'sans-serif', color: isToday ? '#0085FF' : '#3A5070', marginBottom:4, textAlign:'center' }}>
                            {dayName} {dayDate.getUTCMonth()+1}/{dayDate.getUTCDate()}
                          </div>
                          <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                            {dayCols.length === 0 ? (
                              <div style={{ height:52, borderRadius:8, border:'1px dashed #1A2540' }} />
                            ) : dayCols.map(slot => {
                              const post = slotMap.get(slot.key) || null;
                              const isOver = dragOver === slot.key;
                              return (
                                <SlotCell
                                  key={slot.key}
                                  slot={slot}
                                  post={post}
                                  isOver={isOver}
                                  draggingId={draggingId}
                                  catColor={post ? catColor(post.category) : '#1A2540'}
                                  onDragOver={e => { e.preventDefault(); setDragOver(slot.key); }}
                                  onDragLeave={() => setDragOver(null)}
                                  onDrop={() => handleDrop(slot.key)}
                                  onDragStart={() => { if (post) setDraggingId(post.id); }}
                                  onDragEnd={() => setDraggingId(null)}
                                  onUnschedule={() => { if (post) assign(post.id, null); }}
                                />
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function PostChip({ post, dragging, onDragStart, onDragEnd, catColor }: {
  post: Post; dragging: boolean;
  onDragStart: () => void; onDragEnd: () => void; catColor: string;
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      style={{
        background: dragging ? '#1A2540' : '#0B1220',
        border: `1px solid ${catColor}40`,
        borderLeft: `3px solid ${catColor}`,
        borderRadius:8, padding:'8px 10px', cursor:'grab', opacity: dragging ? 0.5 : 1,
        transition:'opacity 0.15s',
      }}
    >
      <div style={{ fontSize:10, color:catColor, fontFamily:'sans-serif', textTransform:'uppercase', letterSpacing:1, marginBottom:3 }}>
        {post.category.replace(/_/g,' ')}
      </div>
      <div style={{ fontSize:11, color:'#C8D8E8', fontFamily:'sans-serif', lineHeight:1.4, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
        {post.bad_prompt}
      </div>
    </div>
  );
}

function SlotCell({ slot, post, isOver, draggingId, catColor, onDragOver, onDragLeave, onDrop, onDragStart, onDragEnd, onUnschedule }: {
  slot: { key: string; timeLabel: string };
  post: Post | null; isOver: boolean; draggingId: string | null; catColor: string;
  onDragOver: (e: React.DragEvent) => void; onDragLeave: () => void; onDrop: () => void;
  onDragStart: () => void; onDragEnd: () => void; onUnschedule: () => void;
}) {
  const isPast = new Date(slot.key) < new Date();
  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      style={{
        minHeight:52, borderRadius:8, position:'relative', overflow:'hidden',
        border: isOver ? `2px dashed #0085FF` : `1px solid ${post ? catColor+'40' : '#1A2540'}`,
        background: isOver ? '#0B1A2C' : post ? `${catColor}08` : '#080B14',
        transition:'all 0.15s', opacity: isPast ? 0.4 : 1,
      }}
    >
      <div style={{ fontSize:10, color:'#3A5070', fontFamily:'sans-serif', position:'absolute', top:4, left:6 }}>
        {slot.timeLabel}
      </div>
      {post ? (
        <div
          draggable
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          style={{ padding:'18px 6px 6px', cursor:'grab' }}
        >
          <div style={{ fontSize:10, color:catColor, fontFamily:'sans-serif', lineHeight:1.3, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
            {post.bad_prompt?.slice(0,50)}
          </div>
          <button
            onClick={e => { e.stopPropagation(); onUnschedule(); }}
            style={{ position:'absolute', top:2, right:4, background:'transparent', border:'none', color:'#3A5070', fontSize:12, cursor:'pointer', padding:2, lineHeight:1 }}
            title="Unschedule"
          >×</button>
        </div>
      ) : (
        <div style={{ height:52, display:'flex', alignItems:'center', justifyContent:'center' }}>
          {isOver && <span style={{ fontSize:18, color:'#0085FF', opacity:0.7 }}>+</span>}
        </div>
      )}
    </div>
  );
}
