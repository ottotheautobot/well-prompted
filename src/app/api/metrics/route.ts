import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const IG_TOKEN   = process.env.INSTAGRAM_ACCESS_TOKEN!;
const GRAPH_BASE = 'https://graph.facebook.com/v19.0';

const REEL_METRICS = [
  'impressions', 'reach', 'plays', 'ig_reels_avg_watch_time',
  'likes', 'comments', 'saved', 'shares',
  'follows', 'profile_visits', 'total_interactions',
].join(',');

export async function GET(req: NextRequest) {
  const postId = req.nextUrl.searchParams.get('postId');
  if (!postId) return NextResponse.json({ error: 'Missing postId' }, { status: 400 });

  const { data: post } = await supabase.from('posts').select('instagram_media_id,video_url,category,bad_prompt,published_at').eq('id', postId).single();
  if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 });

  const mediaId = post.instagram_media_id;
  if (!mediaId) return NextResponse.json({ error: 'No Instagram media ID — post may not be published yet' }, { status: 404 });

  try {
    const res = await fetch(
      `${GRAPH_BASE}/${mediaId}/insights?metric=${REEL_METRICS}&period=lifetime&access_token=${IG_TOKEN}`
    );
    const json = await res.json();

    if (json.error) {
      return NextResponse.json({ error: json.error.message }, { status: 400 });
    }

    // Parse flat metric array into object
    const raw: Record<string, number> = {};
    for (const item of json.data || []) {
      raw[item.name] = item.values?.[0]?.value ?? item.value ?? 0;
    }

    const likes    = raw.likes    || 0;
    const comments = raw.comments || 0;
    const saved    = raw.saved    || 0;
    const shares   = raw.shares   || 0;
    const reach    = raw.reach    || 1; // avoid div/0
    const engagementRate = ((likes + comments + saved + shares) / reach * 100).toFixed(2);

    const avgWatchMs = raw.ig_reels_avg_watch_time || 0;
    const avgWatchSec = (avgWatchMs / 1000).toFixed(1);

    return NextResponse.json({
      postId,
      mediaId,
      publishedAt: post.published_at,
      metrics: {
        impressions:     raw.impressions     || 0,
        reach:           raw.reach           || 0,
        plays:           raw.plays           || 0,
        avgWatchSec,
        likes,
        comments,
        saves:           saved,
        shares,
        profileVisits:   raw.profile_visits  || 0,
        follows:         raw.follows         || 0,
        totalInteractions: raw.total_interactions || 0,
        engagementRate,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
