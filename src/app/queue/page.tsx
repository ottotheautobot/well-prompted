'use client';

import { useEffect, useState } from 'react';
import { Post } from '@/types';

export default function QueuePage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('pending_review');
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetch(`/api/posts?status=${filter}`)
      .then(r => r.json())
      .then(data => { setPosts(data); setLoading(false); });
  }, [filter]);

  const handleApprove = async (id: string) => {
    await fetch(`/api/approve`, { method: 'POST', body: JSON.stringify({ id, action: 'approve' }), headers: { 'Content-Type': 'application/json' } });
    setPosts(posts.filter(p => p.id !== id));
  };

  const handleReject = async (id: string) => {
    await fetch(`/api/approve`, { method: 'POST', body: JSON.stringify({ id, action: 'reject' }), headers: { 'Content-Type': 'application/json' } });
    setPosts(posts.filter(p => p.id !== id));
  };

  return (
    <div className="min-h-screen bg-[#080B14] text-white p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <span className="text-white font-bold text-2xl">well</span>
            <span className="text-[#4D9EFF] font-bold text-2xl">.prompted</span>
            <span className="text-gray-500 ml-3 text-sm">Content Queue</span>
          </div>
          <button
            onClick={async () => {
            setGenerating(true);
            try {
              const res = await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}),
              });
              if (res.ok) {
                setFilter('pending_review');
                setLoading(true);
                const data = await fetch('/api/posts?status=pending_review').then(r => r.json());
                setPosts(data);
                setLoading(false);
              } else {
                const err = await res.json().catch(() => ({}));
                alert('Generation failed: ' + (err.error || 'Unknown error'));
              }
            } finally {
              setGenerating(false);
            }
          }}
          disabled={generating}
          className="bg-[#4D9EFF] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-400 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generating ? '⏳ Generating...' : '+ Generate Post'}
          </button>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-6">
          {['pending_review', 'approved', 'scheduled', 'published', 'rejected'].map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1 rounded text-xs font-medium transition ${filter === s ? 'bg-[#4D9EFF] text-white' : 'bg-[#0F1520] text-gray-400 hover:text-white'}`}
            >
              {s.replace('_', ' ')}
            </button>
          ))}
        </div>

        {/* Posts */}
        {loading ? (
          <div className="text-gray-500">Loading...</div>
        ) : posts.length === 0 ? (
          <div className="text-gray-500 text-center py-20">No posts in this queue.</div>
        ) : (
          <div className="space-y-6">
            {posts.map(post => (
              <div key={post.id} className="bg-[#0F1520] border border-[#1A2540] rounded-xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-xs bg-[#4D9EFF22] text-[#4D9EFF] px-2 py-1 rounded">{post.category}</span>
                  <span className="text-xs bg-[#FF2D7822] text-[#FF2D78] px-2 py-1 rounded">{post.format}</span>
                  {post.techniques.map(t => (
                    <span key={t} className="text-xs bg-[#FFFFFF11] text-gray-400 px-2 py-1 rounded">{t}</span>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  {/* Bad prompt */}
                  <div>
                    <div className="text-xs text-[#FF2D78] font-bold mb-2 uppercase tracking-wider">✗ Bad Prompt</div>
                    <div className="bg-[#080B14] border border-[#FF2D7833] rounded-lg p-3 text-sm font-mono text-gray-300 mb-2">{post.bad_prompt}</div>
                    <div className="text-xs text-gray-500 mb-2">Caption:</div>
                    <div className="text-sm text-gray-400">{post.caption_bad}</div>
                  </div>

                  {/* Good prompt */}
                  <div>
                    <div className="text-xs text-[#4D9EFF] font-bold mb-2 uppercase tracking-wider">✓ Well Prompted</div>
                    <div className="bg-[#080B14] border border-[#4D9EFF33] rounded-lg p-3 text-sm font-mono text-gray-300 mb-2">{post.good_prompt}</div>
                    <div className="text-xs text-gray-500 mb-2">Caption:</div>
                    <div className="text-sm text-gray-400">{post.caption_good}</div>
                  </div>
                </div>

                {/* Video status */}
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-xs text-gray-500">Videos:</span>
                  <span className={`text-xs px-2 py-1 rounded ${post.render_status === 'done' ? 'bg-green-900 text-green-400' : post.render_status === 'rendering' ? 'bg-yellow-900 text-yellow-400' : 'bg-gray-800 text-gray-500'}`}>
                    {post.render_status ?? 'pending'}
                  </span>
                </div>

                {/* Actions */}
                {post.status === 'pending_review' && (
                  <div className="flex gap-3">
                    <button onClick={() => handleApprove(post.id)} className="bg-[#4D9EFF] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-400 transition">
                      ✓ Approve
                    </button>
                    <button onClick={() => handleReject(post.id)} className="bg-[#FF2D7833] text-[#FF2D78] border border-[#FF2D7855] px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#FF2D7855] transition">
                      ✗ Reject
                    </button>
                    <button className="bg-[#0F1520] text-gray-400 border border-[#1A2540] px-4 py-2 rounded-lg text-sm hover:text-white transition">
                      Edit
                    </button>
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
