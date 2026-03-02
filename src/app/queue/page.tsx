'use client';

import { useEffect, useState } from 'react';
import { Post, PostStatus } from '@/types';

const STATUSES = ['pending_review', 'approved', 'rendering', 'pending_video_review', 'scheduled', 'published', 'rejected'];

const STATUS_COLORS: Record<string, string> = {
  pending_review: 'bg-yellow-900/50 text-yellow-400 border-yellow-800',
  approved: 'bg-emerald-900/50 text-emerald-400 border-emerald-800',
  rendering: 'bg-blue-900/50 text-blue-400 border-blue-800',
  pending_video_review: 'bg-purple-900/50 text-purple-400 border-purple-800',
  scheduled: 'bg-cyan-900/50 text-cyan-400 border-cyan-800',
  published: 'bg-green-900/50 text-green-400 border-green-800',
  rejected: 'bg-red-900/50 text-red-400 border-red-800',
};

const STATUS_LABELS: Record<string, string> = {
  pending_review: 'Pending Review',
  approved: 'Approved',
  rendering: 'Rendering',
  pending_video_review: 'Video Review',
  scheduled: 'Scheduled',
  published: 'Published',
  rejected: 'Rejected',
};

export default function QueuePage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('pending_review');
  const [generating, setGenerating] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchPosts = async (status: string) => {
    setLoading(true);
    const data = await fetch(`/api/posts?status=${status}`).then(r => r.json());
    setPosts(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  useEffect(() => { fetchPosts(filter); }, [filter]);

  // On load: auto-resume any posts stuck in 'rendering' that have render_ids saved
  useEffect(() => {
    const resumeStuckRenders = async () => {
      const res = await fetch('/api/posts?status=rendering');
      if (!res.ok) return;
      const stuck = await res.json();
      for (const post of stuck) {
        const ids = (post as any).render_ids;
        if (ids?.render_id) {
          pollRenderStatus(post.id, ids.render_id, ids.bucket);
        } else if (ids?.bad_render_id) {
          // legacy two-video format
          pollRenderStatus(post.id, ids.bad_render_id, ids.bucket);
        }
      }
    };
    resumeStuckRenders();
  }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        setFilter('pending_review');
        await fetchPosts('pending_review');
      } else {
        const err = await res.json().catch(() => ({}));
        alert('Generation failed: ' + (err.error || 'Unknown error'));
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this post permanently?')) return;
    setActionLoading(id + '-delete');
    const res = await fetch('/api/delete', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    const data = await res.json();
    if (data.success) setPosts(posts.filter(p => p.id !== id));
    else alert(data.error || 'Delete failed');
    setActionLoading(null);
  };

  const handleGenerateFormat = async (endpoint: string) => {
    setGenerating(true);
    try {
      const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      if (res.ok) { setFilter('pending_review'); await fetchPosts('pending_review'); }
      else { const err = await res.json().catch(() => ({})); alert('Generation failed: ' + (err.error || 'Unknown')); }
    } finally { setGenerating(false); }
  };
  const handleGenerateTips = () => handleGenerateFormat('/api/generate-tips');
  const handleGenerateMyth = () => handleGenerateFormat('/api/generate-myth');

  const handleApprove = async (id: string) => {
    setActionLoading(id + '-approve');
    await fetch('/api/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action: 'approve' }),
    });
    setPosts(posts.filter(p => p.id !== id));
    setActionLoading(null);
  };

  const handlePublishNow = async (id: string) => {
    setActionLoading(id + '-publish');
    try {
      // Step 1: create containers
      let res = await fetch('/api/publish', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, step: 'create' }) });
      let data = await res.json();
      if (data.error) throw new Error(data.error);

      // Poll until published
      let attempts = 0;
      while (data.step !== undefined && !data.success && attempts < 40) {
        await new Promise(r => setTimeout(r, 8000));
        res = await fetch('/api/publish', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, step: data.step, ...data }) });
        data = await res.json();
        if (data.error) throw new Error(data.error);
        attempts++;
      }

      if (data.success) { setPosts(posts.filter(p => p.id !== id)); alert('Published to Instagram! ✅'); }
      else alert('Timed out — check queue for status');
    } catch (e: any) {
      alert('Publish failed: ' + e.message);
    }
    setActionLoading(null);
  };

  const handleReject = async (id: string) => {
    setActionLoading(id + '-reject');
    await fetch('/api/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action: 'reject' }),
    });
    setPosts(posts.filter(p => p.id !== id));
    setActionLoading(null);
  };

  const pollRenderStatus = async (id: string, render_id: string, bucket: string, bad_render_id?: string, good_render_id?: string) => {
    const pollRes = await fetch('/api/render-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, render_id: render_id || bad_render_id, bucket }),
    });
    const pollData = await pollRes.json();
    if (pollData.done) {
      setFilter('pending_video_review');
      await fetchPosts('pending_video_review');
    } else if (!pollData.error) {
      setTimeout(() => pollRenderStatus(id, render_id, bucket), 10000);
    }
  };

  const handleRender = async (id: string) => {
    setActionLoading(id + '-render');
    setPosts(posts.map(p => p.id === id ? { ...p, status: 'rendering' as PostStatus, render_status: 'rendering' } : p));

    const res = await fetch('/api/render', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });

    const data = await res.json().catch(() => ({}));
    setActionLoading(null);

    if (!res.ok) {
      alert('Render failed: ' + (data.error || 'Unknown'));
      setPosts(posts.map(p => p.id === id ? { ...p, render_status: 'failed', status: 'approved' as PostStatus } : p));
    } else {
      const { render_id, bucket } = data;
      setTimeout(() => pollRenderStatus(id, render_id, bucket), 15000);
    }
  };

  const handleVideoApprove = async (id: string, action: 'approve' | 'reject') => {
    setActionLoading(id + '-video-' + action);
    await fetch('/api/video-approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action }),
    });
    setPosts(posts.filter(p => p.id !== id));
    setActionLoading(null);
  };

  return (
    <div className="min-h-screen bg-[#080B14] text-white">
      {/* Header */}
      <div className="border-b border-[#1A2540] px-8 py-4 flex items-center justify-between sticky top-0 bg-[#080B14] z-10">
        <div className="flex items-center gap-8">
          <div>
            <span className="text-white font-bold text-xl">well</span>
            <span className="text-[#0085FF] font-bold text-xl">.prompted</span>
          </div>
          <nav className="flex gap-4 text-sm">
            <a href="/queue" className="text-white font-medium border-b border-[#0085FF] pb-1">Queue</a>
            <a href="/schedule" className="text-gray-400 hover:text-white transition">Schedule</a>
            <a href="/settings" className="text-gray-400 hover:text-white transition">Settings</a>
          </nav>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="bg-[#0085FF] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-400 transition disabled:opacity-50 flex items-center gap-2"
          >
            {generating ? '⏳' : '+'} Before/After
          </button>
          <button
            onClick={handleGenerateTips}
            disabled={generating}
            className="bg-[#0085FF22] border border-[#0085FF55] text-[#0085FF] px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#0085FF33] transition disabled:opacity-50"
          >
            + Tip List
          </button>
          <button
            onClick={handleGenerateMyth}
            disabled={generating}
            className="bg-[#FF2D7822] border border-[#FF2D7855] text-[#FF2D78] px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#FF2D7833] transition disabled:opacity-50"
          >
            + Myth Bust
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-8 py-6">
        {/* Pipeline status bar */}
        <div className="flex items-center gap-1 mb-8 overflow-x-auto pb-2">
          {STATUSES.map((s, i) => (
            <div key={s} className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => setFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                  filter === s
                    ? STATUS_COLORS[s]
                    : 'bg-transparent text-gray-500 border-[#1A2540] hover:text-gray-300'
                }`}
              >
                {STATUS_LABELS[s]}
              </button>
              {i < STATUSES.length - 2 && <span className="text-[#1A2540] text-xs">→</span>}
            </div>
          ))}
        </div>

        {/* Posts */}
        {loading ? (
          <div className="text-gray-500 text-center py-20">Loading...</div>
        ) : posts.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-gray-500 mb-2">No posts in {STATUS_LABELS[filter]}.</div>
            {filter === 'pending_review' && (
              <button onClick={handleGenerate} disabled={generating} className="text-[#0085FF] text-sm hover:underline mt-2">
                Generate your first post →
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {posts.map(post => (
              <div key={post.id} className="bg-[#0F1520] border border-[#1A2540] rounded-xl overflow-hidden">
                {/* Collapsed header */}
                <div
                  className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-[#111827] transition"
                  onClick={() => setExpanded(expanded === post.id ? null : post.id)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium border shrink-0 ${STATUS_COLORS[post.status] || 'bg-gray-800 text-gray-400 border-gray-700'}`}>
                      {STATUS_LABELS[post.status] || post.status}
                    </span>
                    <span className={`text-xs px-2 py-1 rounded border shrink-0 ${
                      post.format === 'tip_list' ? 'bg-purple-900/40 text-purple-400 border-purple-800' :
                      post.format === 'myth_bust' ? 'bg-orange-900/40 text-orange-400 border-orange-800' :
                      'bg-[#0085FF15] text-[#0085FF] border-[#0085FF25]'
                    }`}>
                      {post.format === 'tip_list' ? '📋 Tip List' : post.format === 'myth_bust' ? '💥 Myth Bust' : '↕ Before/After'}
                    </span>
                    <span className="text-gray-500 text-xs font-mono truncate hidden md:block">
                      "{post.bad_prompt?.slice(0, 60)}..."
                    </span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {post.render_status === 'rendering' && (
                      <span className="text-blue-400 text-xs animate-pulse">● rendering</span>
                    )}
                    {post.render_status === 'failed' && (
                      <span className="text-red-400 text-xs">● render failed</span>
                    )}
                    <span className="text-gray-600 text-sm">{expanded === post.id ? '▲' : '▼'}</span>
                  </div>
                </div>

                {/* Expanded */}
                {expanded === post.id && (
                  <div className="px-6 pb-6 border-t border-[#1A2540]">

                    {/* Content — format-aware */}
                    <div className="mt-6">
                    {post.format === 'tip_list' ? (
                      /* Tip list display */
                      <div className="space-y-3">
                        <div className="text-xs text-purple-400 font-bold uppercase tracking-widest">📋 {post.bad_prompt}</div>
                        <div className="grid gap-2">
                          {(() => { try { return JSON.parse(post.bad_output); } catch { return []; } })().map((tip: string, i: number) => (
                            <div key={i} className="bg-[#080B14] border border-[#1A2540] rounded-lg px-4 py-3 text-sm text-gray-300 flex gap-3">
                              <span className="text-purple-500 font-mono shrink-0">{i + 1}.</span>
                              {tip}
                            </div>
                          ))}
                        </div>
                        <div className="text-xs text-gray-500 uppercase tracking-wider mt-4">Caption</div>
                        <div className="text-sm text-gray-300 italic leading-relaxed whitespace-pre-line">{post.caption_bad}</div>
                      </div>
                    ) : post.format === 'myth_bust' ? (
                      /* Myth bust display */
                      <div className="space-y-3">
                        {(() => { try { return JSON.parse(post.bad_output); } catch { return null; } })() && (() => {
                          const d = JSON.parse(post.bad_output);
                          return (
                            <div className="space-y-3">
                              <div className="bg-[#1A0A0A] border border-[#FF2D7840] rounded-lg p-4">
                                <div className="text-xs text-[#FF2D78] font-bold uppercase tracking-widest mb-2">❌ Myth</div>
                                <div className="text-gray-300 text-sm">{d.myth_statement}</div>
                              </div>
                              <div className="bg-[#0A1A0A] border border-[#0085FF40] rounded-lg p-4">
                                <div className="text-xs text-[#0085FF] font-bold uppercase tracking-widest mb-2">✅ Reality</div>
                                <div className="text-gray-300 text-sm">{d.reality}</div>
                              </div>
                              <div className="bg-[#080B14] border border-[#1A2540] rounded-lg p-4">
                                <div className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-2">Proof</div>
                                <div className="text-gray-400 text-sm">{d.proof}</div>
                              </div>
                              <div className="bg-[#080B14] border border-[#0085FF25] rounded-lg p-4">
                                <div className="text-xs text-[#0085FF] font-bold uppercase tracking-widest mb-2">Fix</div>
                                <div className="text-gray-300 text-sm">{d.fix}</div>
                              </div>
                            </div>
                          );
                        })()}
                        <div className="text-xs text-gray-500 uppercase tracking-wider mt-2">Caption</div>
                        <div className="text-sm text-gray-300 italic leading-relaxed whitespace-pre-line">{post.caption_bad}</div>
                      </div>
                    ) : (
                      /* Before/after — 3-page video format */
                      <div className="space-y-6">
                        {/* Page 1 — Okay Prompt */}
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-1 h-5 rounded-full bg-[#FF2D78]" />
                            <span className="text-xs text-[#FF2D78] font-bold uppercase tracking-widest">Page 1 — Okay Prompt</span>
                          </div>
                          <div className="bg-[#0B1220] border border-[#FF2D7828] border-l-4 border-l-[#FF2D78] rounded-xl p-5 font-mono text-sm text-[#A8B8CC] leading-relaxed">{post.bad_prompt}</div>
                        </div>

                        {/* Page 2 — Well Prompted */}
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-1 h-5 rounded-full bg-[#0085FF]" />
                            <span className="text-xs text-[#0085FF] font-bold uppercase tracking-widest">Page 2 — Well Prompted</span>
                          </div>
                          <div className="bg-[#091525] border border-[#0085FF40] border-l-4 border-l-[#0085FF] rounded-xl p-5 font-mono text-sm text-[#C8D8F0] leading-relaxed">{post.good_prompt}</div>
                        </div>

                        {/* Page 3 — Why This Works */}
                        {(() => { try { return JSON.parse(post.good_output); } catch { return null; } })() && (() => {
                          const items = JSON.parse(post.good_output) as {title:string;description:string}[];
                          return (
                            <div>
                              <div className="flex items-center gap-3 mb-3">
                                <div className="w-1 h-5 rounded-full bg-[#0085FF]" />
                                <span className="text-xs text-[#2C3D5C] font-bold uppercase tracking-widest">Page 3 — Why This Works</span>
                                <div className="flex-1 h-px bg-[#1A2540]" />
                              </div>
                              <div className="space-y-3">
                                {items.map((item, i) => (
                                  <div key={i} className="flex gap-4 bg-[#0B1220] border border-[#1A2540] rounded-xl px-5 py-4">
                                    <div className="w-9 h-9 rounded-lg bg-[#0085FF18] border border-[#0085FF30] flex items-center justify-center text-[#0085FF] font-bold text-sm shrink-0 mt-0.5">
                                      {i + 1}
                                    </div>
                                    <div>
                                      <div className="text-white text-sm font-semibold leading-snug">{item.title}</div>
                                      <div className="text-[#5A6880] text-xs mt-1 leading-relaxed">{item.description}</div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })()}

                        {/* Caption */}
                        <div>
                          <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Caption</div>
                          <div className="text-sm text-gray-300 leading-relaxed whitespace-pre-line bg-[#080B14] border border-[#1A2540] rounded-xl p-5">{post.caption_bad}</div>
                        </div>
                      </div>
                    )}
                    </div>

                    {/* Video preview (single video) */}
                    {((post as any).video_url || post.video_bad_url) && (
                      <div className="mt-6 pt-4 border-t border-[#1A2540]">
                        <div className="text-xs text-gray-500 uppercase tracking-wider mb-3">Video Preview</div>
                        <video
                          src={(post as any).video_url || post.video_bad_url}
                          controls
                          className="w-full max-w-sm rounded-lg border border-[#1A2540] mx-auto block"
                          style={{ maxHeight: 500 }}
                        />
                      </div>
                    )}

                    {/* Techniques */}
                    {post.techniques?.length > 0 && (
                      <div className="flex gap-2 mt-4 flex-wrap">
                        {post.techniques.map(t => (
                          <span key={t} className="text-xs bg-[#FFFFFF08] text-gray-500 px-2 py-1 rounded border border-[#1A2540]">{t}</span>
                        ))}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3 mt-6 pt-4 border-t border-[#1A2540] items-center justify-between">
                      {post.status === 'pending_review' && (
                        <>
                          <button
                            onClick={() => handleApprove(post.id)}
                            disabled={actionLoading === post.id + '-approve'}
                            className="bg-[#0085FF] text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-400 transition disabled:opacity-50"
                          >
                            ✓ Approve Content
                          </button>
                          <button
                            onClick={() => handleReject(post.id)}
                            disabled={actionLoading === post.id + '-reject'}
                            className="text-[#FF2D78] border border-[#FF2D7855] px-5 py-2 rounded-lg text-sm font-medium hover:bg-[#FF2D7815] transition disabled:opacity-50"
                          >
                            ✗ Reject
                          </button>
                        </>
                      )}

                      {post.status === 'approved' && (
                        <button
                          onClick={() => handleRender(post.id)}
                          disabled={actionLoading === post.id + '-render'}
                          className="bg-purple-700 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-purple-600 transition disabled:opacity-50"
                        >
                          {actionLoading === post.id + '-render' ? '⏳ Starting...' : '🎬 Render Videos'}
                        </button>
                      )}

                      {post.status === 'pending_video_review' && (
                        <>
                          <button
                            onClick={() => handleVideoApprove(post.id, 'approve')}
                            disabled={actionLoading === post.id + '-video-approve'}
                            className="bg-[#0085FF] text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-400 transition disabled:opacity-50"
                          >
                            ✓ Approve & Schedule
                          </button>
                          <button
                            onClick={() => handleVideoApprove(post.id, 'reject')}
                            disabled={actionLoading === post.id + '-video-reject'}
                            className="text-[#FF2D78] border border-[#FF2D7855] px-5 py-2 rounded-lg text-sm font-medium hover:bg-[#FF2D7815] transition disabled:opacity-50"
                          >
                            ✗ Reject Video
                          </button>
                        </>
                      )}

                      {post.status === 'scheduled' && (
                        <div className="flex items-center gap-3">
                          <div className="text-sm text-gray-400">
                            {post.scheduled_at
                              ? (new Date(post.scheduled_at) < new Date()
                                ? <span className="text-yellow-400">⏰ Past due — {new Date(post.scheduled_at).toLocaleString('en-US', { timeZone: 'America/New_York' })} ET</span>
                                : `Scheduled for ${new Date(post.scheduled_at).toLocaleString('en-US', { timeZone: 'America/New_York' })} ET`)
                              : 'TBD'}
                          </div>
                          <button
                            onClick={() => handlePublishNow(post.id)}
                            disabled={actionLoading === post.id + '-publish'}
                            className="bg-green-700 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-green-600 transition disabled:opacity-50"
                          >
                            {actionLoading === post.id + '-publish' ? '⏳ Publishing...' : '🚀 Publish Now'}
                          </button>
                        </div>
                      )}

                      {/* Delete — available on all non-limbo statuses */}
                      {!['rendering','publishing'].includes(post.status) && (
                        <button
                          onClick={() => handleDelete(post.id)}
                          disabled={actionLoading === post.id + '-delete'}
                          className="ml-auto text-red-500 border border-red-900 px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-950 transition disabled:opacity-50"
                        >
                          {actionLoading === post.id + '-delete' ? '⏳' : '🗑 Delete'}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
