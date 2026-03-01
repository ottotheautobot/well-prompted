'use client';

import { useEffect, useState } from 'react';
import { Post } from '@/types';

export default function QueuePage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('pending_review');
  const [generating, setGenerating] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchPosts = async (status: string) => {
    setLoading(true);
    const data = await fetch(`/api/posts?status=${status}`).then(r => r.json());
    setPosts(data);
    setLoading(false);
  };

  useEffect(() => { fetchPosts(filter); }, [filter]);

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

  const handleAction = async (id: string, action: 'approve' | 'reject') => {
    await fetch('/api/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action }),
    });
    setPosts(posts.filter(p => p.id !== id));
  };

  const statusColors: Record<string, string> = {
    pending_review: 'bg-yellow-900 text-yellow-400',
    approved: 'bg-green-900 text-green-400',
    scheduled: 'bg-blue-900 text-blue-400',
    published: 'bg-purple-900 text-purple-400',
    rejected: 'bg-red-900 text-red-400',
  };

  return (
    <div className="min-h-screen bg-[#080B14] text-white">
      {/* Header */}
      <div className="border-b border-[#1A2540] px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div>
            <span className="text-white font-bold text-xl">well</span>
            <span className="text-[#4D9EFF] font-bold text-xl">.prompted</span>
          </div>
          <nav className="flex gap-4 text-sm text-gray-400">
            <a href="/queue" className="text-white font-medium">Queue</a>
            <a href="/calendar" className="hover:text-white transition">Calendar</a>
            <a href="/settings" className="hover:text-white transition">Settings</a>
          </nav>
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="bg-[#4D9EFF] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-400 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {generating ? '⏳ Generating...' : '+ Generate Post'}
        </button>
      </div>

      <div className="max-w-6xl mx-auto px-8 py-6">
        {/* Filter tabs */}
        <div className="flex gap-2 mb-6">
          {['pending_review', 'approved', 'scheduled', 'published', 'rejected'].map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${filter === s ? 'bg-[#4D9EFF] text-white' : 'bg-[#0F1520] text-gray-400 hover:text-white border border-[#1A2540]'}`}
            >
              {s.replace('_', ' ')}
            </button>
          ))}
        </div>

        {/* Posts */}
        {loading ? (
          <div className="text-gray-500 text-center py-20">Loading...</div>
        ) : posts.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-gray-500 mb-4">No posts in this queue.</div>
            {filter === 'pending_review' && (
              <button onClick={handleGenerate} disabled={generating} className="text-[#4D9EFF] text-sm hover:underline">
                Generate your first post →
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map(post => (
              <div key={post.id} className="bg-[#0F1520] border border-[#1A2540] rounded-xl overflow-hidden">
                {/* Post header */}
                <div
                  className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-[#111827] transition"
                  onClick={() => setExpanded(expanded === post.id ? null : post.id)}
                >
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColors[post.status] || 'bg-gray-800 text-gray-400'}`}>
                      {post.status.replace('_', ' ')}
                    </span>
                    <span className="text-xs bg-[#4D9EFF15] text-[#4D9EFF] px-2 py-1 rounded border border-[#4D9EFF30]">{post.category}</span>
                    {post.techniques?.slice(0, 2).map(t => (
                      <span key={t} className="text-xs text-gray-500 hidden sm:inline">{t}</span>
                    ))}
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-gray-600 text-xs font-mono truncate max-w-xs hidden md:block">
                      "{post.bad_prompt?.slice(0, 50)}..."
                    </span>
                    <span className="text-gray-600 text-sm">{expanded === post.id ? '▲' : '▼'}</span>
                  </div>
                </div>

                {/* Expanded content */}
                {expanded === post.id && (
                  <div className="px-6 pb-6 border-t border-[#1A2540]">
                    <div className="grid grid-cols-2 gap-6 mt-6">
                      {/* BAD side */}
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-xs text-[#FF2D78] font-bold uppercase tracking-widest">✗ Bad Prompt</span>
                        </div>
                        <div className="bg-[#080B14] border border-[#FF2D7830] rounded-lg p-4 font-mono text-sm text-gray-300 mb-3">
                          {post.bad_prompt}
                        </div>
                        <div className="text-xs text-gray-500 mb-1 uppercase tracking-wider">Output</div>
                        <div className="bg-[#080B14] border border-[#1A2540] rounded-lg p-4 text-sm text-gray-400 mb-3 max-h-40 overflow-y-auto">
                          {post.bad_output}
                        </div>
                        <div className="text-xs text-gray-500 mb-1 uppercase tracking-wider">Caption</div>
                        <div className="text-sm text-gray-300 italic">{post.caption_bad}</div>
                      </div>

                      {/* GOOD side */}
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-xs text-[#4D9EFF] font-bold uppercase tracking-widest">✓ Well Prompted</span>
                        </div>
                        <div className="bg-[#080B14] border border-[#4D9EFF30] rounded-lg p-4 font-mono text-sm text-gray-300 mb-3">
                          {post.good_prompt}
                        </div>
                        <div className="text-xs text-gray-500 mb-1 uppercase tracking-wider">Output</div>
                        <div className="bg-[#080B14] border border-[#1A2540] rounded-lg p-4 text-sm text-gray-400 mb-3 max-h-40 overflow-y-auto">
                          {post.good_output}
                        </div>
                        <div className="text-xs text-gray-500 mb-1 uppercase tracking-wider">Caption</div>
                        <div className="text-sm text-gray-300 italic">{post.caption_good}</div>
                      </div>
                    </div>

                    {/* Actions */}
                    {post.status === 'pending_review' && (
                      <div className="flex gap-3 mt-6 pt-4 border-t border-[#1A2540]">
                        <button
                          onClick={() => handleAction(post.id, 'approve')}
                          className="bg-[#4D9EFF] text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-400 transition"
                        >
                          ✓ Approve
                        </button>
                        <button
                          onClick={() => handleAction(post.id, 'reject')}
                          className="bg-transparent text-[#FF2D78] border border-[#FF2D7855] px-5 py-2 rounded-lg text-sm font-medium hover:bg-[#FF2D7815] transition"
                        >
                          ✗ Reject
                        </button>
                        <button className="bg-transparent text-gray-400 border border-[#1A2540] px-5 py-2 rounded-lg text-sm hover:text-white transition">
                          Edit
                        </button>
                      </div>
                    )}
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
