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
        if (ids?.bad_render_id && ids?.good_render_id) {
          pollRenderStatus(post.id, ids.bad_render_id, ids.good_render_id, ids.bucket);
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

  const pollRenderStatus = async (id: string, bad_render_id: string, good_render_id: string, bucket: string) => {
    const pollRes = await fetch('/api/render-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, bad_render_id, good_render_id, bucket }),
    });
    const pollData = await pollRes.json();
    if (pollData.done) {
      setFilter('pending_video_review');
      await fetchPosts('pending_video_review');
    } else if (!pollData.error) {
      setTimeout(() => pollRenderStatus(id, bad_render_id, good_render_id, bucket), 10000);
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
      // Start polling — renders take 2-4 min on Lambda
      const { bad_render_id, good_render_id, bucket } = data;
      setTimeout(() => pollRenderStatus(id, bad_render_id, good_render_id, bucket), 15000);
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
            <span className="text-[#4D9EFF] font-bold text-xl">.prompted</span>
          </div>
          <nav className="flex gap-4 text-sm">
            <a href="/queue" className="text-white font-medium border-b border-[#4D9EFF] pb-1">Queue</a>
            <a href="/schedule" className="text-gray-400 hover:text-white transition">Schedule</a>
            <a href="/settings" className="text-gray-400 hover:text-white transition">Settings</a>
          </nav>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="bg-[#4D9EFF] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-400 transition disabled:opacity-50 flex items-center gap-2"
          >
            {generating ? '⏳' : '+'} Before/After
          </button>
          <button
            onClick={handleGenerateTips}
            disabled={generating}
            className="bg-[#4D9EFF22] border border-[#4D9EFF55] text-[#4D9EFF] px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#4D9EFF33] transition disabled:opacity-50"
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
              <button onClick={handleGenerate} disabled={generating} className="text-[#4D9EFF] text-sm hover:underline mt-2">
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
                      'bg-[#4D9EFF15] text-[#4D9EFF] border-[#4D9EFF25]'
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
                              <div className="bg-[#0A1A0A] border border-[#4D9EFF40] rounded-lg p-4">
                                <div className="text-xs text-[#4D9EFF] font-bold uppercase tracking-widest mb-2">✅ Reality</div>
                                <div className="text-gray-300 text-sm">{d.reality}</div>
                              </div>
                              <div className="bg-[#080B14] border border-[#1A2540] rounded-lg p-4">
                                <div className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-2">Proof</div>
                                <div className="text-gray-400 text-sm">{d.proof}</div>
                              </div>
                              <div className="bg-[#080B14] border border-[#4D9EFF25] rounded-lg p-4">
                                <div className="text-xs text-[#4D9EFF] font-bold uppercase tracking-widest mb-2">Fix</div>
                                <div className="text-gray-300 text-sm">{d.fix}</div>
                              </div>
                            </div>
                          );
                        })()}
                        <div className="text-xs text-gray-500 uppercase tracking-wider mt-2">Caption</div>
                        <div className="text-sm text-gray-300 italic leading-relaxed whitespace-pre-line">{post.caption_bad}</div>
                      </div>
                    ) : (
                      /* Before/after display */
                      <div className="grid grid-cols-2 gap-6">
                      {/* BAD */}
                      <div className="space-y-3">
                        <div className="text-xs text-[#FF2D78] font-bold uppercase tracking-widest flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-[#FF2D78]" />Bad Prompt
                        </div>
                        <div className="bg-[#080B14] border border-[#FF2D7830] rounded-lg p-4 font-mono text-sm text-gray-300">{post.bad_prompt}</div>
                        <div className="text-xs text-gray-500 uppercase tracking-wider">Video Snippet</div>
                        <div className="bg-[#080B14] border border-[#FF2D7820] rounded-lg p-4 text-sm text-gray-400 italic leading-relaxed">
                          {(post as any).bad_output_snippet || post.bad_output.slice(0, 120) + '…'}
                        </div>
                        <details className="text-xs text-gray-600 cursor-pointer">
                          <summary className="hover:text-gray-400">Full output</summary>
                          <div className="mt-2 bg-[#080B14] border border-[#1A2540] rounded-lg p-3 text-gray-500 max-h-36 overflow-y-auto leading-relaxed whitespace-pre-wrap">{post.bad_output}</div>
                        </details>
                        <div className="text-xs text-gray-500 uppercase tracking-wider">Caption</div>
                        <div className="text-sm text-gray-300 italic leading-relaxed whitespace-pre-line">{post.caption_bad}</div>
                      </div>
                      {/* GOOD */}
                      <div className="space-y-3">
                        <div className="text-xs text-[#4D9EFF] font-bold uppercase tracking-widest flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-[#4D9EFF]" />Well Prompted
                        </div>
                        <div className="bg-[#080B14] border border-[#4D9EFF30] rounded-lg p-4 font-mono text-sm text-gray-300">{post.good_prompt}</div>
                        <div className="text-xs text-gray-500 uppercase tracking-wider">Video Snippet</div>
                        <div className="bg-[#080B14] border border-[#4D9EFF20] rounded-lg p-4 text-sm text-gray-400 italic leading-relaxed">
                          {(post as any).good_output_snippet || post.good_output.slice(0, 120) + '…'}
                        </div>
                        <details className="text-xs text-gray-600 cursor-pointer">
                          <summary className="hover:text-gray-400">Full output</summary>
                          <div className="mt-2 bg-[#080B14] border border-[#1A2540] rounded-lg p-3 text-gray-500 max-h-36 overflow-y-auto leading-relaxed whitespace-pre-wrap">{post.good_output}</div>
                        </details>
                        <div className="text-xs text-gray-500 uppercase tracking-wider">Caption</div>
                        <div className="text-sm text-gray-300 italic leading-relaxed whitespace-pre-line">{post.caption_good}</div>
                      </div>
                      </div>
                    )}
                    </div>

                    {/* Video preview (if available) */}
                    {(post.video_bad_url || post.video_good_url) && (
                      <div className="mt-6 pt-4 border-t border-[#1A2540]">
                        <div className="text-xs text-gray-500 uppercase tracking-wider mb-3">Videos</div>
                        <div className="grid grid-cols-2 gap-4">
                          {post.video_bad_url && (
                            <div>
                              <div className="text-xs text-[#FF2D78] mb-2">Bad Prompt Video</div>
                              <video
                                src={post.video_bad_url}
                                controls
                                className="w-full rounded-lg border border-[#FF2D7830]"
                                style={{ maxHeight: 300 }}
                              />
                            </div>
                          )}
                          {post.video_good_url && (
                            <div>
                              <div className="text-xs text-[#4D9EFF] mb-2">Well Prompted Video</div>
                              <video
                                src={post.video_good_url}
                                controls
                                className="w-full rounded-lg border border-[#4D9EFF30]"
                                style={{ maxHeight: 300 }}
                              />
                            </div>
                          )}
                        </div>
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
                    <div className="flex gap-3 mt-6 pt-4 border-t border-[#1A2540]">
                      {post.status === 'pending_review' && (
                        <>
                          <button
                            onClick={() => handleApprove(post.id)}
                            disabled={actionLoading === post.id + '-approve'}
                            className="bg-[#4D9EFF] text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-400 transition disabled:opacity-50"
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
                            className="bg-[#4D9EFF] text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-400 transition disabled:opacity-50"
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
                        <div className="text-sm text-gray-400">
                          Scheduled for {post.scheduled_at ? new Date(post.scheduled_at).toLocaleString('en-US', { timeZone: 'America/New_York' }) : 'TBD'} ET
                        </div>
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
