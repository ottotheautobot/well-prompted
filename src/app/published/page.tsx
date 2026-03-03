'use client';

import { useEffect, useState } from 'react';
import NavBar from '@/components/NavBar';

interface PublishedPost {
  id: string;
  bad_prompt: string;
  category: string;
  format: string;
  video_url: string;
  published_at: string;
  instagram_media_id?: string;
}

interface Metrics {
  impressions: number;
  reach: number;
  plays: number;
  avgWatchSec: string;
  likes: number;
  comments: number;
  saves: number;
  shares: number;
  profileVisits: number;
  follows: number;
  engagementRate: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  career: '#60A5FA', job_search: '#F472B6',
  communication: '#C084FC', writing: '#FBB040', thinking: '#34D399',
};
const CATEGORY_LABELS: Record<string, string> = {
  career: 'Career', job_search: 'Job Search',
  communication: 'Communication', writing: 'Writing', thinking: 'Thinking',
};

function MetricTile({ icon, label, value, sub }: { icon: string; label: string; value: string | number; sub?: string }) {
  return (
    <div style={{ background: '#080B14', border: '1px solid #1A2540', borderRadius: 10, padding: '12px 14px', textAlign: 'center' }}>
      <div style={{ fontSize: 18, marginBottom: 2 }}>{icon}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: '#E2E8F0', fontFamily: 'sans-serif' }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: '#4A6080', fontFamily: 'sans-serif' }}>{sub}</div>}
      <div style={{ fontSize: 10, color: '#5A7090', fontFamily: 'sans-serif', marginTop: 2, letterSpacing: 0.5 }}>{label.toUpperCase()}</div>
    </div>
  );
}

function PostCard({ post }: { post: PublishedPost }) {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(false);

  const fetchMetrics = async () => {
    setLoadingMetrics(true);
    const res = await fetch(`/api/metrics?postId=${post.id}`);
    const data = await res.json();
    if (data.error) setMetricsError(data.error);
    else setMetrics(data.metrics);
    setLoadingMetrics(false);
  };

  useEffect(() => {
    if (post.instagram_media_id) fetchMetrics();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.id]);

  const catColor = CATEGORY_COLORS[post.category] || '#9CA3AF';

  return (
    <div style={{ background: '#0B1220', border: '1px solid #1A2540', borderRadius: 16, overflow: 'hidden' }}>
      {/* Video */}
      {post.video_url && (
        <video
          src={post.video_url}
          muted
          loop
          autoPlay
          playsInline
          style={{ width: '100%', aspectRatio: '9/16', objectFit: 'cover', display: 'block', maxHeight: 340 }}
        />
      )}

      {/* Meta */}
      <div style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: catColor, letterSpacing: 0.5, fontFamily: 'sans-serif' }}>
            {CATEGORY_LABELS[post.category] || post.category}
          </span>
          <span style={{ fontSize: 10, color: '#4A6080', fontFamily: 'sans-serif' }}>
            {post.published_at ? new Date(post.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
          </span>
        </div>
        <div style={{ fontSize: 12, color: '#8A9AB0', fontFamily: 'sans-serif', lineHeight: 1.5, marginBottom: 14 }}>
          {post.bad_prompt?.slice(0, 80)}
        </div>

        {/* Metrics */}
        {loadingMetrics && (
          <div style={{ fontSize: 11, color: '#4A6080', fontFamily: 'sans-serif', textAlign: 'center', padding: 16 }}>Loading metrics...</div>
        )}

        {metricsError && (
          <div style={{ fontSize: 11, color: '#5A7090', fontFamily: 'sans-serif', background: '#080B14', border: '1px solid #1A2540', borderRadius: 8, padding: 12, textAlign: 'center' }}>
            {metricsError.includes('not published') ? '📊 Metrics unavailable — no IG media ID' : `⚠️ ${metricsError}`}
          </div>
        )}

        {metrics && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Reach + plays row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              <MetricTile icon="👁" label="Impressions" value={metrics.impressions.toLocaleString()} />
              <MetricTile icon="🎯" label="Reach" value={metrics.reach.toLocaleString()} />
              <MetricTile icon="▶️" label="Plays" value={metrics.plays.toLocaleString()} />
            </div>
            {/* Engagement row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              <MetricTile icon="❤️" label="Likes" value={metrics.likes} />
              <MetricTile icon="💬" label="Comments" value={metrics.comments} />
              <MetricTile icon="🔖" label="Saves" value={metrics.saves} />
              <MetricTile icon="↗️" label="Shares" value={metrics.shares} />
            </div>
            {/* Watch + growth row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              <MetricTile icon="⏱" label="Avg Watch" value={`${metrics.avgWatchSec}s`} />
              <MetricTile icon="👤" label="Profile Visits" value={metrics.profileVisits} />
              <MetricTile icon="➕" label="Follows" value={metrics.follows} />
            </div>
            {/* Engagement rate */}
            <div style={{ background: '#080B14', border: '1px solid #0085FF25', borderRadius: 10, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: '#5A7090', fontFamily: 'sans-serif' }}>📈 Engagement Rate</span>
              <span style={{ fontSize: 20, fontWeight: 800, color: '#0085FF', fontFamily: 'sans-serif' }}>{metrics.engagementRate}%</span>
            </div>
            {/* Revenue placeholder */}
            <div style={{ background: '#080B14', border: '1px solid #1A2540', borderRadius: 10, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: '#4A6080', fontFamily: 'sans-serif' }}>💰 Revenue</span>
              <span style={{ fontSize: 12, color: '#4A6080', fontFamily: 'sans-serif', fontStyle: 'italic' }}>Not set up yet</span>
            </div>
          </div>
        )}

        {/* Instagram link */}
        {post.instagram_media_id && (
          <a
            href={`https://www.instagram.com/p/${post.instagram_media_id}/`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'block', marginTop: 12, textAlign: 'center', fontSize: 12, color: '#0085FF', fontFamily: 'sans-serif', textDecoration: 'none' }}
          >
            View on Instagram ↗
          </a>
        )}
      </div>
    </div>
  );
}

export default function PublishedPage() {
  const [posts, setPosts] = useState<PublishedPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/posts?status=published')
      .then(r => r.json())
      .then(data => { setPosts(Array.isArray(data) ? data : []); setLoading(false); });
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: '#080B14', color: '#E2E8F0' }}>
      <NavBar />
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#E2E8F0', fontFamily: 'sans-serif', margin: 0 }}>Published</h1>
          <p style={{ fontSize: 13, color: '#5A7090', fontFamily: 'sans-serif', marginTop: 4 }}>
            {posts.length} post{posts.length !== 1 ? 's' : ''} published to Instagram
          </p>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 80, color: '#4A6080' }}>Loading...</div>
        ) : posts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 80, color: '#4A6080' }}>No published posts yet.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
            {posts.map(post => <PostCard key={post.id} post={post} />)}
          </div>
        )}
      </div>
    </div>
  );
}
