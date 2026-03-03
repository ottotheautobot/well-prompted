'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { Post, PostStatus } from '@/types';
import NavBar from '@/components/NavBar';

const STATUS_COLORS: Record<string, string> = {
  pending_review:      'bg-yellow-900/50 text-yellow-400 border-yellow-800',
  approved:            'bg-emerald-900/50 text-emerald-400 border-emerald-800',
  rendering:           'bg-blue-900/50 text-blue-400 border-blue-800',
  pending_video_review:'bg-purple-900/50 text-purple-400 border-purple-800',
  pending_schedule:    'bg-orange-900/50 text-orange-400 border-orange-800',
  scheduled:           'bg-cyan-900/50 text-cyan-400 border-cyan-800',
  rejected:            'bg-red-900/50 text-red-400 border-red-800',
};
const STATUS_LABELS: Record<string, string> = {
  pending_review:       'Pending Review',
  approved:             'Approved',
  rendering:            'Rendering',
  pending_video_review: 'Video Review',
  pending_schedule:     'Ready to Schedule',
  scheduled:            'Scheduled',
  rejected:             'Rejected',
};
const QUEUE_STATUSES = ['pending_review','approved','rendering','pending_video_review','pending_schedule','scheduled','rejected'];

const CATEGORY_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
  career:        { label: 'Career',        color: '#60A5FA', bg: '#1E3A5F', border: '#2563EB40' },
  job_search:    { label: 'Job Search',    color: '#F472B6', bg: '#5F1E3A', border: '#DB277740' },
  communication: { label: 'Communication', color: '#C084FC', bg: '#3A1E5F', border: '#9333EA40' },
  writing:       { label: 'Writing',       color: '#FBB040', bg: '#5F3A1E', border: '#D9770040' },
  thinking:      { label: 'Thinking',      color: '#34D399', bg: '#1E4A3A', border: '#10B98140' },
};

function CategoryBadge({ category }: { category: string }) {
  const meta = CATEGORY_META[category] || { label: category, color: '#9CA3AF', bg: '#1A2540', border: '#2A354040' };
  return (
    <span style={{
      background: meta.bg, color: meta.color, border: `1px solid ${meta.border}`,
      fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
      fontFamily: 'sans-serif', letterSpacing: 0.5, textTransform: 'uppercase',
    }}>
      {meta.label}
    </span>
  );
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return 'just now';
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function QueuePage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');
  const [generating, setGenerating] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [renderProgress, setRenderProgress] = useState<Record<string, number>>({}); // postId → 0-1

  const fetchPosts = async (silent = false) => {
    if (!silent) setLoading(true);
    const results = await Promise.all(
      QUEUE_STATUSES.map(s => fetch(`/api/posts?status=${s}`).then(r => r.json()))
    );
    const all: Post[] = results.flat().filter((p: any) => p && p.id);
    setPosts(all);
    if (!silent) setLoading(false);
  };

  useEffect(() => { fetchPosts(); }, []);

  // While any post is rendering, silently refresh every 5s to pick up status changes
  useEffect(() => {
    const hasRendering = posts.some(p => p.status === 'rendering');
    if (!hasRendering) return;
    const t = setInterval(() => fetchPosts(true), 5000);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posts]);

  // On load: server resolves any stuck renders, then re-fetch + resume client polling
  useEffect(() => {
    const resume = async () => {
      await fetch('/api/render-check'); // server-side resolution (handles expired/done)
      const res = await fetch('/api/posts?status=rendering');
      if (!res.ok) return;
      const still = await res.json();
      // Any still actually rendering → resume client poll
      for (const post of still) {
        const ids = (post as any).render_ids;
        if (ids?.render_id) pollRenderStatus(post.id, ids.render_id, ids.bucket);
      }
      if (still.length !== posts.length) fetchPosts(); // refresh if anything changed
    };
    resume();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    let list = posts;
    if (statusFilter !== 'all') list = list.filter(p => p.status === statusFilter);
    if (categoryFilter !== 'all') list = list.filter(p => p.category === categoryFilter);
    list = [...list].sort((a, b) => {
      const ta = new Date(a.created_at || 0).getTime();
      const tb = new Date(b.created_at || 0).getTime();
      return sortDir === 'desc' ? tb - ta : ta - tb;
    });
    return list;
  }, [posts, statusFilter, categoryFilter, sortDir]);

  // ── Actions ──────────────────────────────────────────────
  const handleGenerate = async (endpoint = '/api/generate') => {
    setGenerating(true);
    try {
      const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      if (res.ok) { await fetchPosts(); setStatusFilter('pending_review'); }
      else { const e = await res.json().catch(() => ({})); alert('Failed: ' + (e.error || 'Unknown')); }
    } finally { setGenerating(false); }
  };

  const handleApprove = async (id: string) => {
    setActionLoading(id + '-approve');
    await fetch('/api/approve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action: 'approve' }) });
    await fetchPosts();
    setActionLoading(null);
  };

  const handleReject = async (id: string) => {
    setActionLoading(id + '-reject');
    await fetch('/api/approve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action: 'reject' }) });
    await fetchPosts();
    setActionLoading(null);
  };

  const pollRenderStatus = useCallback(async (id: string, render_id: string, bucket: string) => {
    const res = await fetch('/api/render-status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, render_id, bucket }) });
    const data = await res.json();
    if (data.done) {
      setRenderProgress(p => { const n = { ...p }; delete n[id]; return n; });
      await fetchPosts(true); // silent refresh from DB — no loading flash, gets ground truth
    } else if (!data.error) {
      setRenderProgress(p => ({ ...p, [id]: data.progress ?? 0 }));
      setTimeout(() => pollRenderStatus(id, render_id, bucket), 5000);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRender = async (id: string) => {
    setActionLoading(id + '-render');
    setPosts(posts.map(p => p.id === id ? { ...p, status: 'rendering' as PostStatus } : p));
    const res = await fetch('/api/render', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    const data = await res.json().catch(() => ({}));
    setActionLoading(null);
    if (!res.ok) { alert('Render failed: ' + (data.error || 'Unknown')); await fetchPosts(); }
    else { setTimeout(() => pollRenderStatus(id, data.render_id, data.bucket), 15000); }
  };

  const handleVideoApprove = async (id: string, action: 'approve' | 'reject') => {
    setActionLoading(id + '-video-' + action);
    await fetch('/api/video-approve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action }) });
    await fetchPosts();
    setActionLoading(null);
  };

  const handlePublishNow = async (id: string) => {
    setActionLoading(id + '-publish');
    try {
      let res = await fetch('/api/publish', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, step: 'create' }) });
      let data = await res.json();
      if (data.error) throw new Error(data.error);
      let attempts = 0;
      while (data.step !== undefined && !data.success && attempts < 40) {
        await new Promise(r => setTimeout(r, 8000));
        res = await fetch('/api/publish', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, step: data.step, ...data }) });
        data = await res.json();
        if (data.error) throw new Error(data.error);
        attempts++;
      }
      if (data.success) { await fetchPosts(); alert('Published ✅'); }
      else alert('Timed out — check queue');
    } catch (e: any) { alert('Publish failed: ' + e.message); }
    setActionLoading(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this post?')) return;
    setActionLoading(id + '-delete');
    const res = await fetch('/api/delete', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    const data = await res.json();
    if (data.success) setPosts(posts.filter(p => p.id !== id));
    else alert(data.error || 'Delete failed');
    setActionLoading(null);
  };

  // ── Render ─────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#080B14', color: '#E2E8F0' }}>
      <NavBar />

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>

        {/* Filter + actions bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28, flexWrap: 'wrap' }}>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={selectStyle}
          >
            <option value="all">All Statuses ({posts.length})</option>
            {QUEUE_STATUSES.map(s => (
              <option key={s} value={s}>{STATUS_LABELS[s]} ({posts.filter(p => p.status === s).length})</option>
            ))}
          </select>

          {/* Category filter */}
          <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} style={selectStyle}>
            <option value="all">All Categories</option>
            {Object.entries(CATEGORY_META).map(([k, v]) => (
              <option key={k} value={k}>{v.label} ({posts.filter(p => p.category === k).length})</option>
            ))}
          </select>

          {/* Sort */}
          <select value={sortDir} onChange={e => setSortDir(e.target.value as 'desc'|'asc')} style={selectStyle}>
            <option value="desc">Newest first</option>
            <option value="asc">Oldest first</option>
          </select>

          <div style={{ flex: 1 }} />

          {/* Generate buttons */}
          <button onClick={() => handleGenerate('/api/generate')} disabled={generating} style={btnStyle('#0085FF')}>
            {generating ? '⏳' : '+'} Before/After
          </button>
          <button onClick={() => handleGenerate('/api/generate-tips')} disabled={generating} style={btnOutlineStyle('#60A5FA')}>
            + Tip List
          </button>
          <button onClick={() => handleGenerate('/api/generate-myth')} disabled={generating} style={btnOutlineStyle('#FF2D78')}>
            + Myth Bust
          </button>
        </div>

        {/* Results count */}
        <div style={{ fontSize: 12, color: '#4A6080', marginBottom: 16, fontFamily: 'sans-serif' }}>
          {loading ? 'Loading...' : `${filtered.length} post${filtered.length !== 1 ? 's' : ''}`}
        </div>

        {/* Post list */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 80, color: '#4A6080' }}>Loading...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 80, color: '#4A6080' }}>
            No posts match these filters.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map(post => (
              <PostCard
                key={post.id}
                post={post}
                expanded={expanded === post.id}
                onToggle={() => setExpanded(expanded === post.id ? null : post.id)}
                actionLoading={actionLoading}
                renderProgress={renderProgress[post.id]}
                onApprove={handleApprove}
                onReject={handleReject}
                onRender={handleRender}
                onVideoApprove={handleVideoApprove}
                onPublishNow={handlePublishNow}
                onDelete={handleDelete}
                onGenerateAudio={async (id) => {
                  setActionLoading(id + '-audio');
                  await fetch('/api/generate-audio', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
                  setActionLoading(null);
                  await fetchPosts();
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────
const selectStyle: React.CSSProperties = {
  background: '#0B1220', border: '1px solid #1A2540', color: '#E2E8F0',
  padding: '8px 12px', borderRadius: 8, fontSize: 13, fontFamily: 'sans-serif', cursor: 'pointer',
};
const btnStyle = (bg: string): React.CSSProperties => ({
  background: bg, color: '#fff', border: 'none', padding: '8px 16px',
  borderRadius: 8, fontSize: 13, fontWeight: 600, fontFamily: 'sans-serif', cursor: 'pointer',
});
const btnOutlineStyle = (color: string): React.CSSProperties => ({
  background: 'transparent', color, border: `1px solid ${color}55`,
  padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, fontFamily: 'sans-serif', cursor: 'pointer',
});

// ── PostCard component ────────────────────────────────────────
interface PostCardProps {
  renderProgress?: number;
  post: Post;
  expanded: boolean;
  onToggle: () => void;
  actionLoading: string | null;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onRender: (id: string) => void;
  onVideoApprove: (id: string, action: 'approve' | 'reject') => void;
  onPublishNow: (id: string) => void;
  onDelete: (id: string) => void;
  onGenerateAudio: (id: string) => void;
}

function PostCard({ post, expanded, onToggle, actionLoading, renderProgress, onApprove, onReject, onRender, onVideoApprove, onPublishNow, onDelete, onGenerateAudio }: PostCardProps) {
  const al = actionLoading;
  const [localPost, setLocalPost] = useState(post);
  const [regen, setRegen] = useState<string | null>(null);

  useEffect(() => { setLocalPost(post); }, [post]);

  const handleRegen = async (section: string) => {
    setRegen(section);
    const res = await fetch('/api/regenerate-section', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: localPost.id, section }),
    });
    const data = await res.json();
    if (data.success) {
      if (section === 'why')     setLocalPost(p => ({ ...p, good_output: JSON.stringify(data.data) }));
      if (section === 'caption') setLocalPost(p => ({ ...p, caption_bad: data.data }));
      if (section === 'prompts') setLocalPost(p => ({ ...p, bad_prompt: data.data.okayPrompt, good_prompt: data.data.wellPrompt }));
    } else {
      alert('Regen failed: ' + data.error);
    }
    setRegen(null);
  };

  let audioData: { url?: string; totalSec?: number; script?: string } | null = null;
  try { audioData = JSON.parse(localPost.caption_good || '{}'); } catch {}
  const hasAudio = !!audioData?.url;

  let whyItems: { title: string; description: string }[] = [];
  try { whyItems = JSON.parse(localPost.good_output || '[]'); } catch {}

  return (
    <div style={{ background: '#0B1220', border: '1px solid #1A2540', borderRadius: 14, overflow: 'hidden' }}>
      {/* Collapsed row */}
      <div
        onClick={onToggle}
        style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
      >
        <span style={{ color: '#4A6080', fontSize: 14, userSelect: 'none' }}>{expanded ? '▲' : '▼'}</span>

        <CategoryBadge category={post.category || 'career'} />

        <span style={{
          fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 6,
          fontFamily: 'sans-serif', border: '1px solid',
          ...(STATUS_COLORS[post.status] ? {} : {}),
          color: post.status === 'pending_review' ? '#FBBF24' :
                 post.status === 'approved' ? '#34D399' :
                 post.status === 'rendering' ? '#60A5FA' :
                 post.status === 'pending_video_review' ? '#C084FC' :
                 post.status === 'scheduled' ? '#22D3EE' :
                 post.status === 'rejected' ? '#F87171' : '#9CA3AF',
          background: post.status === 'pending_review' ? '#451A0320' :
                      post.status === 'approved' ? '#05200F20' :
                      post.status === 'rendering' ? '#1E3A5F20' :
                      post.status === 'pending_video_review' ? '#3B1A5F20' :
                      post.status === 'scheduled' ? '#0E3A4220' :
                      post.status === 'rejected' ? '#3F0A0A20' : '#11111120',
          borderColor: post.status === 'pending_review' ? '#78350F50' :
                       post.status === 'approved' ? '#14532D50' :
                       post.status === 'rendering' ? '#1D4ED850' :
                       post.status === 'pending_video_review' ? '#6B21A850' :
                       post.status === 'scheduled' ? '#16456550' :
                       post.status === 'rejected' ? '#7F1D1D50' : '#1A254050',
        }}>
          {STATUS_LABELS[post.status] || post.status}
        </span>

        <span style={{ fontSize: 11, color: '#60A5FA', background: '#1E3A5F30', border: '1px solid #2563EB25', padding: '2px 8px', borderRadius: 6, fontFamily: 'sans-serif' }}>
          {post.format === 'tip_list' ? '📋 Tips' : post.format === 'myth_bust' ? '💥 Myth' : '↕ B/A'}
        </span>

        <span style={{ flex: 1, fontSize: 13, color: '#8A9AB0', fontFamily: 'sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {post.bad_prompt?.slice(0, 90)}
        </span>

        <span style={{ fontSize: 11, color: '#4A6080', fontFamily: 'sans-serif', whiteSpace: 'nowrap' }}>
          {post.created_at ? relativeTime(post.created_at) : ''}
        </span>

        {post.status === 'rendering' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 140 }}>
            <div style={{ flex: 1, height: 4, background: '#1A2540', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 2, background: '#0085FF',
                width: `${Math.round((renderProgress ?? 0) * 100)}%`,
                transition: 'width 0.5s ease',
              }} />
            </div>
            <span style={{ fontSize: 11, color: '#60A5FA', fontFamily: 'sans-serif', whiteSpace: 'nowrap' }}>
              {renderProgress != null ? `${Math.round(renderProgress * 100)}%` : '…'}
            </span>
          </div>
        )}
      </div>

      {/* Expanded body */}
      {expanded && (
        <div style={{ padding: '0 20px 24px', borderTop: '1px solid #1A2540' }}>
          <div style={{ marginTop: 20 }}>

            {localPost.format === 'before_after' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Okay prompt */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={sectionLabel('#FF2D78')}>Okay Prompt</div>
                    <RegenButton label="Redo Well Prompted" loading={regen === 'prompts'} onClick={() => handleRegen('prompts')} />
                  </div>
                  <div style={promptBox('#FF2D7820', '#FF2D7840')}>{localPost.bad_prompt}</div>
                </div>
                {/* Well prompted */}
                <div>
                  <div style={sectionLabel('#0085FF')}>Well Prompted</div>
                  <div style={promptBox('#0085FF15', '#0085FF40')}>{localPost.good_prompt}</div>
                </div>
                {/* Why breakdown */}
                {whyItems.length > 0 && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div style={sectionLabel('#5A7090')}>Why This Works</div>
                      <RegenButton label="Redo Why" loading={regen === 'why'} onClick={() => handleRegen('why')} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {whyItems.map((item, i) => (
                        <div key={i} style={{ display: 'flex', gap: 12, background: '#080B14', border: '1px solid #1A2540', borderRadius: 10, padding: '12px 16px' }}>
                          <div style={{ width: 28, height: 28, borderRadius: 7, background: '#0085FF15', border: '1px solid #0085FF30', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0085FF', fontSize: 12, fontWeight: 800, flexShrink: 0 }}>
                            {i + 1}
                          </div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#E2E8F0', fontFamily: 'sans-serif' }}>{item.title}</div>
                            <div style={{ fontSize: 12, color: '#5A7090', marginTop: 3, fontFamily: 'sans-serif', lineHeight: 1.5 }}>{item.description}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {/* Caption */}
                {localPost.caption_bad && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div style={sectionLabel('#5A7090')}>Caption</div>
                      <RegenButton label="Redo Caption" loading={regen === 'caption'} onClick={() => handleRegen('caption')} />
                    </div>
                    <div style={{ background: '#080B14', border: '1px solid #1A2540', borderRadius: 10, padding: 16, fontSize: 12, color: '#8A9AB0', fontFamily: 'sans-serif', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
                      {localPost.caption_bad}
                    </div>
                  </div>
                )}
              </div>

            ) : localPost.format === 'tip_list' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={sectionLabel('#C084FC')}>{localPost.bad_prompt}</div>
                {(() => { try { return JSON.parse(localPost.bad_output || '[]'); } catch { return []; } })().map((tip: string, i: number) => (
                  <div key={i} style={{ display: 'flex', gap: 12, background: '#080B14', border: '1px solid #1A2540', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#C8D0E0', fontFamily: 'sans-serif' }}>
                    <span style={{ color: '#C084FC', fontWeight: 700, fontFamily: 'mono' }}>{i + 1}.</span> {tip}
                  </div>
                ))}
              </div>

            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {(() => { try { return JSON.parse(localPost.bad_output || '{}'); } catch { return null; } })() && (() => {
                  const d = JSON.parse(localPost.bad_output || '{}');
                  return (
                    <>
                      <div style={{ background: '#1A0A0A', border: '1px solid #FF2D7840', borderRadius: 10, padding: 14 }}>
                        <div style={sectionLabel('#FF2D78')}>❌ Myth</div>
                        <div style={{ fontSize: 13, color: '#C8D0E0', fontFamily: 'sans-serif' }}>{d.myth_statement}</div>
                      </div>
                      <div style={{ background: '#0A1A0A', border: '1px solid #0085FF40', borderRadius: 10, padding: 14 }}>
                        <div style={sectionLabel('#0085FF')}>✅ Reality</div>
                        <div style={{ fontSize: 13, color: '#C8D0E0', fontFamily: 'sans-serif' }}>{d.reality}</div>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}

            {/* Video preview */}
            {((localPost as any).video_url || localPost.video_bad_url) && (
              <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #1A2540' }}>
                <div style={sectionLabel('#5A7090')}>Video Preview</div>
                <video src={(localPost as any).video_url || localPost.video_bad_url} controls style={{ maxWidth: 260, width: '100%', borderRadius: 10, border: '1px solid #1A2540' }} />
              </div>
            )}

            {/* Audio section */}
            {localPost.format === 'before_after' && (
              <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid #1A2540' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {hasAudio ? (
                    <>
                      <span style={{ fontSize: 11, color: '#34D399', fontWeight: 700, fontFamily: 'sans-serif' }}>🎙 Audio Ready</span>
                      <span style={{ fontSize: 11, color: '#4A6080', cursor: 'default' }} title={`Narration: ~${Math.round(audioData!.totalSec || 0)}s · Video: ~${Math.round((audioData as any).totalVideoDurationSec || 0)}s`}>
                        ~{Math.round((audioData as any).totalVideoDurationSec || audioData!.totalSec || 0)}s video
                      </span>
                      <audio key={audioData!.url} src={audioData!.url} controls style={{ height: 28, flex: 1 }} />
                    </>
                  ) : (
                    <span style={{ fontSize: 11, color: '#4A6080', fontFamily: 'sans-serif' }}>No audio yet</span>
                  )}
                  <button
                    onClick={() => onGenerateAudio(localPost.id)}
                    disabled={al === localPost.id + '-audio'}
                    style={{ fontSize: 11, background: hasAudio ? 'transparent' : '#0085FF15', color: hasAudio ? '#5A7090' : '#0085FF', border: `1px solid ${hasAudio ? '#1A2540' : '#0085FF30'}`, padding: '5px 12px', borderRadius: 7, cursor: 'pointer', fontFamily: 'sans-serif', whiteSpace: 'nowrap' }}
                  >
                    {al === localPost.id + '-audio' ? '⏳ Generating...' : hasAudio ? '↻ Regen Audio' : '🎙 Generate Audio'}
                  </button>
                </div>
                {hasAudio && audioData?.script && (
                  <details style={{ marginTop: 8 }}>
                    <summary style={{ fontSize: 11, color: '#3A5070', fontFamily: 'sans-serif', cursor: 'pointer' }}>View narration script</summary>
                    <p style={{ fontSize: 11, color: '#5A7090', fontFamily: 'sans-serif', lineHeight: 1.6, marginTop: 6, padding: '8px 12px', background: '#060910', borderRadius: 6, border: '1px solid #1A2540' }}>
                      {typeof audioData.script === 'string'
                        ? audioData.script
                        : [(audioData.script as any).section1, (audioData.script as any).section2].filter(Boolean).join(' ')}
                    </p>
                  </details>
                )}
              </div>
            )}

            {/* Actions */}
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #1A2540', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>

              {post.status === 'pending_review' && (
                <>
                  <button onClick={() => onApprove(post.id)} disabled={al === post.id + '-approve'} style={actionBtn('#0085FF', '#fff')}>
                    ✓ Approve
                  </button>
                  <button onClick={() => onReject(post.id)} disabled={al === post.id + '-reject'} style={actionBtnOutline('#FF2D78')}>
                    ✗ Reject
                  </button>
                </>
              )}

              {post.status === 'approved' && (
                <button onClick={() => onRender(post.id)} disabled={al === post.id + '-render'} style={actionBtn('#7C3AED', '#fff')}>
                  {al === post.id + '-render' ? '⏳ Starting...' : '🎬 Render Video'}
                </button>
              )}

              {post.status === 'pending_video_review' && (
                <>
                  <button onClick={() => onVideoApprove(post.id, 'approve')} disabled={al === post.id + '-video-approve'} style={actionBtn('#0085FF', '#fff')}>
                    ✓ Approve Video
                  </button>
                  <button onClick={() => onVideoApprove(post.id, 'reject')} disabled={al === post.id + '-video-reject'} style={actionBtnOutline('#FF2D78')}>
                    ✗ Reject Video
                  </button>
                </>
              )}

              {post.status === 'scheduled' && (
                <>
                  {post.scheduled_at && (
                    <span style={{ fontSize: 12, color: '#22D3EE', fontFamily: 'sans-serif' }}>
                      ⏰ {new Date(post.scheduled_at).toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} ET
                    </span>
                  )}
                  <button onClick={() => onPublishNow(post.id)} disabled={al === post.id + '-publish'} style={actionBtn('#059669', '#fff')}>
                    {al === post.id + '-publish' ? '⏳ Publishing...' : '🚀 Publish Now'}
                  </button>
                </>
              )}

              {!['rendering', 'publishing'].includes(post.status) && (
                <button onClick={() => onDelete(post.id)} disabled={al === post.id + '-delete'} style={{ ...actionBtnOutline('#F87171'), marginLeft: 'auto' }}>
                  {al === post.id + '-delete' ? '⏳' : '🗑 Delete'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RegenButton({ label, loading, onClick }: { label: string; loading: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      style={{
        background: 'transparent', color: loading ? '#4A6080' : '#5A7090',
        border: '1px solid #1A2540', padding: '3px 10px', borderRadius: 6,
        fontSize: 11, fontFamily: 'sans-serif', cursor: loading ? 'default' : 'pointer',
        display: 'flex', alignItems: 'center', gap: 4,
      }}
    >
      {loading ? '⏳' : '↻'} {loading ? 'Regenerating...' : label}
    </button>
  );
}

const sectionLabel = (color: string): React.CSSProperties => ({
  fontSize: 10, fontWeight: 700, color, letterSpacing: 1.5, textTransform: 'uppercase',
  fontFamily: 'sans-serif', marginBottom: 8,
});
const promptBox = (bg: string, border: string): React.CSSProperties => ({
  background: bg, border: `1px solid ${border}`, borderRadius: 10,
  padding: '14px 16px', fontSize: 13, color: '#C8D8F0', fontFamily: 'monospace',
  lineHeight: 1.65, whiteSpace: 'pre-wrap',
});
const actionBtn = (bg: string, color: string): React.CSSProperties => ({
  background: bg, color, border: 'none', padding: '8px 18px', borderRadius: 8,
  fontSize: 13, fontWeight: 600, fontFamily: 'sans-serif', cursor: 'pointer',
});
const actionBtnOutline = (color: string): React.CSSProperties => ({
  background: 'transparent', color, border: `1px solid ${color}55`,
  padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600,
  fontFamily: 'sans-serif', cursor: 'pointer',
});
