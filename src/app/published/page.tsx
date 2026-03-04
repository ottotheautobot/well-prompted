'use client';

import { useEffect, useState, useCallback } from 'react';
import NavBar from '@/components/NavBar';

interface Post {
  id: string;
  bad_prompt: string;
  category: string;
  format: string;
  published_at: string;
  instagram_media_id?: string;
}

interface Metrics {
  reach: number;
  avgWatchSec: string;
  totalViewTimeSec: string;
  likes: number;
  comments: number;
  saves: number;
  shares: number;
  totalInteractions: number;
  engagementRate: string;
}

const CAT_COLOR: Record<string, string> = {
  career: '#60A5FA', job_search: '#F472B6',
  communication: '#C084FC', writing: '#FBB040', thinking: '#34D399',
};

export default function PublishedPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [metrics, setMetrics] = useState<Record<string, Metrics | 'loading' | 'error'>>({});
  const [loading, setLoading] = useState(true);

  const fetchMetrics = useCallback(async (post: Post) => {
    if (!post.instagram_media_id) return;
    setMetrics(m => ({ ...m, [post.id]: 'loading' }));
    const res = await fetch(`/api/metrics?postId=${post.id}`);
    const data = await res.json();
    setMetrics(m => ({ ...m, [post.id]: data.error ? 'error' : data.metrics }));
  }, []);

  useEffect(() => {
    fetch('/api/posts?status=published')
      .then(r => r.json())
      .then((data: Post[]) => {
        const arr = Array.isArray(data) ? data : [];
        setPosts(arr);
        setLoading(false);
        arr.forEach(p => fetchMetrics(p));
      });
  }, [fetchMetrics]);

  const stat = (postId: string, key: keyof Metrics, fallback = '—') => {
    const m = metrics[postId];
    if (!m || m === 'loading') return <span style={{ color: '#2A3A5A' }}>…</span>;
    if (m === 'error') return <span style={{ color: '#3A2A2A' }}>—</span>;
    return String((m as Metrics)[key] ?? fallback);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#080B14', color: '#E2E8F0' }}>
      <NavBar />
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, fontFamily: 'sans-serif', margin: 0 }}>Published</h1>
          <p style={{ fontSize: 13, color: '#5A7090', fontFamily: 'sans-serif', marginTop: 4 }}>
            {posts.length} post{posts.length !== 1 ? 's' : ''} live on Instagram
          </p>
        </div>

        {loading ? (
          <div style={{ color: '#5A7090', fontFamily: 'sans-serif', fontSize: 13 }}>Loading...</div>
        ) : posts.length === 0 ? (
          <div style={{ color: '#5A7090', fontFamily: 'sans-serif', fontSize: 13 }}>No published posts yet.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'sans-serif' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #1A2540' }}>
                  {['Post', 'Published', 'Reach', 'Avg Watch', 'Likes', 'Comments', 'Saves', 'Shares', 'Eng. Rate', ''].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, color: '#4A6080', fontWeight: 700, letterSpacing: 1, whiteSpace: 'nowrap' }}>
                      {h.toUpperCase()}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {posts.map(post => (
                  <tr key={post.id} style={{ borderBottom: '1px solid #0F1825' }}>
                    {/* Post */}
                    <td style={{ padding: '14px 12px', maxWidth: 300 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                          fontSize: 9, fontWeight: 700, letterSpacing: 1,
                          color: CAT_COLOR[post.category] || '#9CA3AF',
                          background: `${CAT_COLOR[post.category]}15` || '#1A2540',
                          border: `1px solid ${CAT_COLOR[post.category]}30` || '#1A2540',
                          borderRadius: 4, padding: '2px 6px', whiteSpace: 'nowrap',
                        }}>
                          {post.category.replace(/_/g, ' ').toUpperCase()}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: '#A8B8CC', marginTop: 4, lineHeight: 1.4 }}>
                        {post.bad_prompt?.slice(0, 70)}{(post.bad_prompt?.length || 0) > 70 ? '…' : ''}
                      </div>
                    </td>
                    {/* Published */}
                    <td style={{ padding: '14px 12px', fontSize: 12, color: '#5A7090', whiteSpace: 'nowrap' }}>
                      {post.published_at ? new Date(post.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                    </td>
                    {/* Stats */}
                    <td style={{ padding: '14px 12px', fontSize: 13, color: '#E2E8F0', fontWeight: 600 }}>{stat(post.id, 'reach')}</td>
                    <td style={{ padding: '14px 12px', fontSize: 13, color: '#E2E8F0' }}>{stat(post.id, 'avgWatchSec')}s</td>
                    <td style={{ padding: '14px 12px', fontSize: 13, color: '#E2E8F0' }}>{stat(post.id, 'likes')}</td>
                    <td style={{ padding: '14px 12px', fontSize: 13, color: '#E2E8F0' }}>{stat(post.id, 'comments')}</td>
                    <td style={{ padding: '14px 12px', fontSize: 13, color: '#E2E8F0' }}>{stat(post.id, 'saves')}</td>
                    <td style={{ padding: '14px 12px', fontSize: 13, color: '#E2E8F0' }}>{stat(post.id, 'shares')}</td>
                    <td style={{ padding: '14px 12px', fontSize: 13, color: '#34D399' }}>{stat(post.id, 'engagementRate')}%</td>
                    {/* IG link */}
                    <td style={{ padding: '14px 12px' }}>
                      {post.instagram_media_id && (
                        <a
                          href={`https://www.instagram.com/p/${post.instagram_media_id}/`}
                          target="_blank" rel="noopener noreferrer"
                          style={{ fontSize: 11, color: '#0085FF', textDecoration: 'none', whiteSpace: 'nowrap' }}
                        >
                          View ↗
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
