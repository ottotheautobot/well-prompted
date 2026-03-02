import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const IG_API = 'https://graph.instagram.com/v19.0';
const IG_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN!;
const IG_ACCOUNT_ID = process.env.INSTAGRAM_ACCOUNT_ID!;

async function igPost(path: string, body: Record<string, string>) {
  const res = await fetch(`${IG_API}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, access_token: IG_TOKEN }),
  });
  return res.json();
}

async function igGet(path: string) {
  const res = await fetch(`${IG_API}/${path}&access_token=${IG_TOKEN}`);
  return res.json();
}

async function getContainerStatus(containerId: string): Promise<string> {
  const data = await igGet(`${containerId}?fields=status_code,status`);
  return data.status_code || 'UNKNOWN';
}

// POST: kick off publish — creates containers, returns container IDs for polling
// Called again with container IDs to check status and finalize
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { id, step, bad_container_id, good_container_id, carousel_id } = body;

  if (!id) return NextResponse.json({ error: 'Missing post id' }, { status: 400 });

  const { data: post, error: fetchErr } = await supabase.from('posts').select('*').eq('id', id).single();
  if (fetchErr || !post) return NextResponse.json({ error: 'Post not found' }, { status: 404 });

  // STEP 1: Create item containers
  if (!step || step === 'create') {
    if (!post.video_bad_url || !post.video_good_url) {
      return NextResponse.json({ error: 'Videos not ready — render first' }, { status: 400 });
    }

    await supabase.from('posts').update({ status: 'publishing' }).eq('id', id);

    const [badRes, goodRes] = await Promise.all([
      igPost(`${IG_ACCOUNT_ID}/media`, { media_type: 'REELS', video_url: post.video_bad_url, is_carousel_item: 'true' }),
      igPost(`${IG_ACCOUNT_ID}/media`, { media_type: 'REELS', video_url: post.video_good_url, is_carousel_item: 'true' }),
    ]);

    if (!badRes.id || !goodRes.id) {
      await supabase.from('posts').update({ status: 'scheduled', publish_error: JSON.stringify(badRes.error || goodRes.error) }).eq('id', id);
      return NextResponse.json({ error: 'Failed to create containers', badRes, goodRes }, { status: 500 });
    }

    return NextResponse.json({
      step: 'check_items',
      bad_container_id: badRes.id,
      good_container_id: goodRes.id,
    });
  }

  // STEP 2: Check item containers, create carousel when ready
  if (step === 'check_items') {
    const [badStatus, goodStatus] = await Promise.all([
      getContainerStatus(bad_container_id),
      getContainerStatus(good_container_id),
    ]);

    if (badStatus === 'ERROR' || goodStatus === 'ERROR') {
      await supabase.from('posts').update({ status: 'scheduled', publish_error: `Item container error: bad=${badStatus} good=${goodStatus}` }).eq('id', id);
      return NextResponse.json({ error: 'Item container failed', badStatus, goodStatus }, { status: 500 });
    }

    if (badStatus !== 'FINISHED' || goodStatus !== 'FINISHED') {
      return NextResponse.json({ step: 'check_items', bad_container_id, good_container_id, badStatus, goodStatus, ready: false });
    }

    // Both ready — create carousel
    const caption = post.caption_bad || '';
    const carouselRes = await igPost(`${IG_ACCOUNT_ID}/media`, {
      media_type: 'CAROUSEL',
      children: `${bad_container_id},${good_container_id}`,
      caption,
    });

    if (!carouselRes.id) {
      await supabase.from('posts').update({ status: 'scheduled', publish_error: JSON.stringify(carouselRes.error) }).eq('id', id);
      return NextResponse.json({ error: 'Failed to create carousel', carouselRes }, { status: 500 });
    }

    return NextResponse.json({ step: 'check_carousel', carousel_id: carouselRes.id, ready: false });
  }

  // STEP 3: Check carousel container, publish when ready
  if (step === 'check_carousel') {
    const status = await getContainerStatus(carousel_id);

    if (status === 'ERROR') {
      await supabase.from('posts').update({ status: 'scheduled', publish_error: `Carousel container error: ${status}` }).eq('id', id);
      return NextResponse.json({ error: 'Carousel container failed' }, { status: 500 });
    }

    if (status !== 'FINISHED') {
      return NextResponse.json({ step: 'check_carousel', carousel_id, status, ready: false });
    }

    // Publish!
    const publishRes = await igPost(`${IG_ACCOUNT_ID}/media_publish`, { creation_id: carousel_id });

    if (!publishRes.id) {
      await supabase.from('posts').update({ status: 'scheduled', publish_error: JSON.stringify(publishRes.error) }).eq('id', id);
      return NextResponse.json({ error: 'Failed to publish', publishRes }, { status: 500 });
    }

    await supabase.from('posts').update({
      status: 'published',
      published_at: new Date().toISOString(),
      instagram_media_id: publishRes.id,
    }).eq('id', id);

    // Notify
    if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
      await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: process.env.TELEGRAM_CHAT_ID,
          parse_mode: 'HTML',
          text: `✅ <b>Published to Instagram!</b>\n\n"${(post.bad_prompt || '').slice(0, 60)}..."\n\nMedia ID: ${publishRes.id}\nhttps://instagram.com/well.prompted`,
        }),
      });
    }

    return NextResponse.json({ success: true, mediaId: publishRes.id });
  }

  return NextResponse.json({ error: 'Unknown step' }, { status: 400 });
}

// GET: auto-publish due posts (called by cron)
export async function GET() {
  const now = new Date().toISOString();
  const { data: duePosts } = await supabase
    .from('posts')
    .select('id, bad_prompt')
    .eq('status', 'scheduled')
    .lte('scheduled_at', now)
    .not('video_bad_url', 'is', null)
    .not('video_good_url', 'is', null);

  if (!duePosts?.length) return NextResponse.json({ published: 0, message: 'No posts due' });

  // Kick off publish step 1 for each due post (client must poll to complete)
  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://well-prompted-pi.vercel.app';
  const results = [];
  for (const post of duePosts) {
    const res = await fetch(`${base}/api/publish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.PORTAL_PASSWORD}`,
      },
      body: JSON.stringify({ id: post.id, step: 'create' }),
    });
    results.push({ id: post.id, ...(await res.json()) });
  }

  return NextResponse.json({ kicked_off: results.length, results });
}
