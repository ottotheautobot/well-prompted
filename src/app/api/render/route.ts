import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { renderMediaOnLambda } from '@remotion/lambda/client';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const REGION = (process.env.AWS_REGION || 'us-east-2') as 'us-east-2';
const FUNCTION_NAME = process.env.REMOTION_FUNCTION_NAME!;
const SITE_URL = process.env.REMOTION_SITE_URL!;

export async function POST(req: NextRequest) {
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: 'Missing post id' }, { status: 400 });

  const { data: post, error } = await supabase.from('posts').select('*').eq('id', id).single();
  if (error || !post) return NextResponse.json({ error: 'Post not found' }, { status: 404 });

  await supabase.from('posts').update({ render_status: 'rendering', status: 'rendering' }).eq('id', id);

  try {
    let whyBreakdown = [];
    try { whyBreakdown = JSON.parse(post.good_output || '[]'); } catch {}

    let audioUrl: string | undefined;
    let totalAudioSec: number | undefined;
    let musicUrl: string | undefined;
    let musicStartSec: number | undefined;
    try {
      const audioData = JSON.parse(post.caption_good || '{}');
      if (audioData.url) {
        audioUrl      = audioData.url;
        totalAudioSec = audioData.totalSec;
        musicUrl      = audioData.musicUrl;
        musicStartSec = audioData.musicStartSec;
      }
    } catch {}

    const render = await renderMediaOnLambda({
      region: REGION,
      functionName: FUNCTION_NAME,
      serveUrl: SITE_URL,
      composition: 'PromptVideo',
      inputProps: {
        okayPrompt: post.bad_prompt,
        wellPrompt: post.good_prompt,
        whyBreakdown,
        category: post.category,
        postNumber: post.post_number || 1,
        ...(audioUrl ? { audioUrl, totalAudioSec } : {}),
        ...(musicUrl ? { musicUrl, musicStartSec } : {}),
      },
      codec: 'h264',
      imageFormat: 'jpeg',
      maxRetries: 1,
      outName: `${id}.mp4`,
      logLevel: 'error',
      framesPerLambda: 300,
      concurrencyPerLambda: 1,
      downloadBehavior: { type: 'play-in-browser' },
    });

    await supabase.from('posts').update({
      render_ids: { render_id: render.renderId, bucket: render.bucketName },
    }).eq('id', id);

    return NextResponse.json({
      success: true,
      render_id: render.renderId,
      bucket: render.bucketName,
    });

  } catch (err: any) {
    await supabase.from('posts').update({ render_status: 'failed', status: 'approved' }).eq('id', id);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
