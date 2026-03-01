'use client';
import { useEffect, useState } from 'react';
import { Post } from '@/types';

interface Slot {
  slot_time: string;
  day: number;
  hour: number;
  minute: number;
}

interface ScheduleData {
  slots: Slot[];
  scheduled: Post[];
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const FORMAT_LABELS: Record<string, string> = {
  before_after: 'Before/After',
  tip_list: 'Tip List',
  myth_bust: 'Myth Bust',
  model_vs_model: 'Model vs Model',
};

export default function SchedulePage() {
  const [data, setData] = useState<ScheduleData | null>(null);
  const [approved, setApproved] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [filling, setFilling] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    const [schedRes, approvedRes] = await Promise.all([
      fetch('/api/schedule?weeks=2'),
      fetch('/api/posts?status=approved'),
    ]);
    const schedData = await schedRes.json();
    const approvedData = approvedRes.ok ? await approvedRes.json() : [];
    setData(schedData);
    setApproved(approvedData);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const autoFill = async () => {
    setFilling(true);
    await fetch('/api/schedule', { method: 'PATCH' });
    await fetchData();
    setFilling(false);
  };

  const assignToSlot = async (postId: string, slotTime: string) => {
    await fetch('/api/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ post_id: postId, slot_time: slotTime }),
    });
    await fetchData();
    setDragging(null);
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/New_York' });
  };

  const getScheduledPost = (slotTime: string) => {
    const slotDate = new Date(slotTime);
    return data?.scheduled.find(p => {
      if (!p.scheduled_at) return false;
      const postDate = new Date(p.scheduled_at);
      return Math.abs(postDate.getTime() - slotDate.getTime()) < 60 * 60 * 1000;
    });
  };

  if (loading) return (
    <div className="min-h-screen bg-[#080B14] flex items-center justify-center">
      <div className="text-[#4D9EFF] text-lg animate-pulse">Loading schedule...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#080B14] text-white">
      <div className="max-w-4xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">
              <span className="text-white">well</span>
              <span className="text-[#4D9EFF]">.prompted</span>
              <span className="text-gray-600 ml-3 text-lg font-normal">/ schedule</span>
            </h1>
            <p className="text-gray-500 text-sm mt-1">2-week posting calendar · ET timezone</p>
          </div>
          <div className="flex gap-3">
            <a href="/queue" className="px-4 py-2 text-sm text-gray-400 border border-[#1A2540] rounded-lg hover:border-[#4D9EFF] transition-colors">
              ← Queue
            </a>
            <button
              onClick={autoFill}
              disabled={filling}
              className="px-4 py-2 text-sm bg-[#4D9EFF] text-white font-semibold rounded-lg hover:bg-[#3D8EEF] disabled:opacity-50 transition-colors"
            >
              {filling ? 'Filling...' : '⚡ Auto-fill Slots'}
            </button>
          </div>
        </div>

        {/* Unscheduled posts */}
        {approved.filter(p => !p.scheduled_at).length > 0 && (
          <div className="mb-8">
            <div className="text-xs text-gray-500 uppercase tracking-widest mb-3">Ready to schedule ({approved.filter(p => !p.scheduled_at).length})</div>
            <div className="flex gap-3 flex-wrap">
              {approved.filter(p => !p.scheduled_at).map(post => (
                <div
                  key={post.id}
                  draggable
                  onDragStart={() => setDragging(post.id)}
                  className={`px-3 py-2 rounded-lg border cursor-grab text-sm transition-all ${
                    dragging === post.id
                      ? 'border-[#4D9EFF] bg-[#4D9EFF15] text-[#4D9EFF]'
                      : 'border-[#1A2540] bg-[#0F1520] text-gray-300 hover:border-[#2A3550]'
                  }`}
                >
                  <span className="text-xs text-gray-500 mr-2">{FORMAT_LABELS[post.format] || post.format}</span>
                  {post.bad_prompt?.slice(0, 40)}…
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Calendar slots */}
        <div className="space-y-2">
          {data?.slots.map((slot, i) => {
            const scheduledPost = getScheduledPost(slot.slot_time);
            const isToday = new Date(slot.slot_time).toDateString() === new Date().toDateString();

            return (
              <div
                key={i}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => dragging && assignToSlot(dragging, slot.slot_time)}
                className={`flex items-center gap-4 p-4 rounded-lg border transition-all ${
                  scheduledPost
                    ? 'border-[#1A2540] bg-[#0A0F1A]'
                    : dragging
                    ? 'border-[#4D9EFF40] bg-[#4D9EFF08] border-dashed'
                    : 'border-[#1A2540] bg-[#080B14] hover:border-[#2A3550]'
                } ${isToday ? 'border-l-2 border-l-[#4D9EFF]' : ''}`}
              >
                {/* Time */}
                <div className="w-44 shrink-0">
                  <div className="text-sm text-gray-300 font-mono">{formatTime(slot.slot_time)}</div>
                  {isToday && <div className="text-xs text-[#4D9EFF] mt-0.5">today</div>}
                </div>

                {/* Content */}
                <div className="flex-1">
                  {scheduledPost ? (
                    <div className="flex items-center gap-3">
                      <span className={`text-xs px-2 py-0.5 rounded font-semibold ${
                        scheduledPost.format === 'tip_list' ? 'bg-purple-900/50 text-purple-400' : 'bg-blue-900/50 text-blue-400'
                      }`}>
                        {FORMAT_LABELS[scheduledPost.format] || scheduledPost.format}
                      </span>
                      <span className="text-sm text-gray-300">{scheduledPost.bad_prompt?.slice(0, 60)}…</span>
                      <span className={`ml-auto text-xs px-2 py-0.5 rounded ${
                        scheduledPost.status === 'published' ? 'bg-green-900/50 text-green-400' : 'bg-yellow-900/50 text-yellow-500'
                      }`}>
                        {scheduledPost.status}
                      </span>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-600 italic">
                      {dragging ? 'Drop to schedule here' : 'Empty slot'}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {data?.slots.length === 0 && (
          <div className="text-center py-16 text-gray-600">No upcoming slots found.</div>
        )}
      </div>
    </div>
  );
}
