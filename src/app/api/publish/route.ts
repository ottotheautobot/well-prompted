import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const IG_API = 'https://graph.instagram.com/v19.0';
const IG_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN!;
const IG_ACCOUNT_ID = process.env.INSTAGRAM_ACCOUNT_ID!;

async function createVideoContainer(videoUrl: string, caption?: string, isCarouselItem = false): Promise<string> {
  const params: Record<string, string> = {
    media_type: 'REELS', // Using REELS for video carousels
    video_url: videoUrl,
    access_token: IG_TOKEN,
  };
  if (isCarouselItem) {
    params.is_carousel_item = 'true';
  }
  if (caption && !isCarouselItem) {
    params.caption = caption;
  }

  const res = await fetch(`${IG_API}/${IG_ACCOUNT_ID}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!data.id) throw new Error(`Failed to create container: ${JSON.stringify(data)}`);
  return data.id;
}

async function waitForContainer(containerId: string, maxWaitMs = 120000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const res = await fetch(`${IG_API}/${containerId}?fields=status_code,status&access_token=${IG_TOKEN}`);
    const data = await res.json();
    if (data.status_code === 'FINISHED') return;
    if (data.status_code === 'ERROR') throw new Error(`Container processing failed: ${data.status}`);
    await new Promise(r => setTimeout(r, 5000));
  }
  throw new Error('Container processing timed out');
}

async function createCarouselContainer(itemIds: string[], caption: string): Promise<string> {
  const res = await fetch(`${IG_API}/${IG_ACCOUNT_ID}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      media_type: 'CAROUSEL',
      children: itemIds.join(','),
      caption,
      access_token: IG_TOKEN,
    }),
  });
  const data = await res.json();
  if (!data.id) throw new Error(`Failed to create carousel: ${JSON.stringify(data)}`);
  return data.id;
}

async function publishContainer(containerId: string): Promise<string> {
  const res = await fetch(`${IG_API}/${IG_ACCOUNT_ID}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ creation_id: containerId, access_token: IG_TOKEN }),
  });
  const data = await res.json();
  if (!data.id) throw new Error(`Failed to publish: ${JSON.stringify(data)}`);
  return data.id;
}

export async function POST(req: NextRequest) {
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: 'Missing post id' }, { status: 400 });

  const { data: post, error: fetchErr } = await supabase
    .from('posts')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchErr || !post) return NextResponse.json({ error: 'Post not found' }, { status: 404 });
  if (!post.video_bad_url || !post.video_good_url) return NextResponse.json({ error: 'Videos not ready' }, { status: 400 });

  // Mark as publishing
  await supabase.from('posts').update({ status: 'publishing' }).eq('id', id);

  try {
    // Step 1: Create carousel item containers
    console.log('Creating carousel item containers...');
    const [badId, goodId] = await Promise.all([
      createVideoContainer(post.video_bad_url, undefined, true),
      createVideoContainer(post.video_good_url, undefined, true),
    ]);

    // Step 2: Wait for both to finish processing
    console.log('Waiting for containers:', badId, goodId);
    await Promise.all([waitForContainer(badId), waitForContainer(goodId)]);

    // Step 3: Create carousel container with caption (use bad slide caption as main)
    const caption = post.caption_bad || '';
    const carouselId = await createCarouselContainer([badId, goodId], caption);

    // Step 4: Publish
    console.log('Publishing carousel:', carouselId);
    const mediaId = await publishContainer(carouselId);

    // Step 5: Update DB
    await supabase.from('posts').update({
      status: 'published',
      published_at: new Date().toISOString(),
      instagram_media_id: mediaId,
    }).eq('id', id);

    // Notify via Telegram
    if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
      await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: process.env.TELEGRAM_CHAT_ID,
          parse_mode: 'HTML',
          text: `✅ <b>Post published to Instagram!</b>\n\n"${post.bad_prompt?.slice(0, 60)}..."\n\nMedia ID: ${mediaId}\nhttps://instagram.com/well.prompted`,
        }),
      });
    }

    return NextResponse.json({ success: true, mediaId });
  } catch (err: any) {
    console.error('Publish error:', err);
    await supabase.from('posts').update({ status: 'scheduled', publish_error: err.message }).eq('id', id);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// GET: check for due posts and publish them (called by cron)
export async function GET() {
  const now = new Date().toISOString();
  const { data: duePosts } = await supabase
    .from('posts')
    .select('id, bad_prompt, scheduled_at')
    .eq('status', 'scheduled')
    .lte('scheduled_at', now)
    .not('video_bad_url', 'is', null)
    .not('video_good_url', 'is', null);

  if (!duePosts?.length) return NextResponse.json({ published: 0 });

  const results = [];
  for (const post of duePosts) {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://well-prompted-pi.vercel.app'}/api/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: post.id }),
      });
      const data = await res.json();
      results.push({ id: post.id, ...data });
    } catch (e: any) {
      results.push({ id: post.id, error: e.message });
    }
  }

  return NextResponse.json({ published: results.filter(r => r.success).length, results });
}
