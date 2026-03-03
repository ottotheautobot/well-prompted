import { NextRequest, NextResponse } from 'next/server';
import { logFire } from '@/lib/logger';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const IG_API      = 'https://graph.instagram.com/v19.0';
const IG_TOKEN    = process.env.INSTAGRAM_ACCESS_TOKEN!;
const IG_ACCT     = process.env.INSTAGRAM_ACCOUNT_ID!;

async function igPost(path: string, body: Record<string, string>) {
  const res = await fetch(`${IG_API}/${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, access_token: IG_TOKEN }),
  });
  return res.json();
}

async function getStatus(containerId: string): Promise<string> {
  const res = await fetch(`${IG_API}/${containerId}?fields=status_code,status&access_token=${IG_TOKEN}`);
  const d = await res.json();
  return d.status_code || 'UNKNOWN';
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { id, step, container_id } = body;
  if (!id) return NextResponse.json({ error: 'Missing post id' }, { status: 400 });

  const { data: post } = await supabase.from('posts').select('*').eq('id', id).single();
  if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 });

  const videoUrl = post.video_url || post.video_bad_url;

  // STEP 1: Create Reel container
  if (!step || step === 'create') {
    if (!videoUrl) return NextResponse.json({ error: 'Video not ready' }, { status: 400 });

    logFire('publish', 'info', `Publishing started`, { postId: id, prompt: post.bad_prompt?.slice(0, 60) });
    await supabase.from('posts').update({ status: 'publishing' }).eq('id', id);

    // thumb_offset at ~15s (15000ms) to capture the "Why This Works" page
    const res = await igPost(`${IG_ACCT}/media`, {
      media_type: 'REELS',
      video_url: videoUrl,
      caption: post.caption_bad || '',
      share_to_feed: 'true',
      thumb_offset: '15000',
    });

    if (!res.id) {
      logFire('publish', 'error', `IG container creation failed`, { postId: id, detail: JSON.stringify(res).slice(0, 200) });
      await supabase.from('posts').update({ status: 'scheduled', publish_error: JSON.stringify(res.error) }).eq('id', id);
      return NextResponse.json({ error: 'Failed to create container', detail: res }, { status: 500 });
    }

    return NextResponse.json({ step: 'check_container', container_id: res.id });
  }

  // STEP 2: Poll container status
  if (step === 'check_container') {
    const status = await getStatus(container_id);

    if (status === 'ERROR') {
      await supabase.from('posts').update({ status: 'scheduled', publish_error: `Container error: ${status}` }).eq('id', id);
      return NextResponse.json({ error: 'Container processing failed' }, { status: 500 });
    }

    if (status !== 'FINISHED') {
      return NextResponse.json({ step: 'check_container', container_id, status, ready: false });
    }

    // Publish
    const publishRes = await igPost(`${IG_ACCT}/media_publish`, { creation_id: container_id });

    if (!publishRes.id) {
      logFire('publish', 'error', `IG publish failed`, { postId: id, detail: JSON.stringify(publishRes).slice(0, 200) });
      await supabase.from('posts').update({ status: 'scheduled', publish_error: JSON.stringify(publishRes.error) }).eq('id', id);
      return NextResponse.json({ error: 'Publish failed', detail: publishRes }, { status: 500 });
    }

    logFire('publish', 'info', `Published to Instagram`, { postId: id, mediaId: publishRes.id });
    await supabase.from('posts').update({
      status: 'published',
      published_at: new Date().toISOString(),
      instagram_media_id: publishRes.id,
    }).eq('id', id);

    if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
      await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: process.env.TELEGRAM_CHAT_ID, parse_mode: 'HTML',
          text: `✅ <b>Published to Instagram!</b>\n\n"${(post.bad_prompt||'').slice(0,60)}..."\n\nhttps://instagram.com/well.prompted`,
        }),
      });
    }

    return NextResponse.json({ success: true, mediaId: publishRes.id });
  }

  return NextResponse.json({ error: 'Unknown step' }, { status: 400 });
}

// GET: auto-publish due scheduled posts
export async function GET() {
  const now = new Date().toISOString();
  const { data: duePosts } = await supabase
    .from('posts').select('id').eq('status', 'scheduled')
    .lte('scheduled_at', now).not('video_bad_url', 'is', null);

  if (!duePosts?.length) return NextResponse.json({ published: 0, message: 'No posts due' });

  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://well-prompted-pi.vercel.app';
  const results = [];
  for (const post of duePosts) {
    const res = await fetch(`${base}/api/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.PORTAL_PASSWORD}` },
      body: JSON.stringify({ id: post.id, step: 'create' }),
    });
    results.push({ id: post.id, ...(await res.json()) });
  }
  return NextResponse.json({ kicked_off: results.length, results });
}
