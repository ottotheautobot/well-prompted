import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { renderMediaOnLambda, getRenderProgress } from '@remotion/lambda/client';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const REGION = 'us-east-1';
const FUNCTION_NAME = 'remotion-render-4-0-431-mem3008mb-disk10240mb-240sec';
const SITE_URL = 'https://remotionlambda-useast1-v6pulbp3tj.s3.us-east-1.amazonaws.com/sites/well-prompted/index.html';

async function renderVideo(props: Record<string, unknown>, outKey: string): Promise<string> {
  const { renderId, bucketName } = await renderMediaOnLambda({
    region: REGION,
    functionName: FUNCTION_NAME,
    serveUrl: SITE_URL,
    composition: 'PromptVideo',
    inputProps: props,
    codec: 'h264',
    imageFormat: 'jpeg',
    maxRetries: 1,
    outName: outKey,
    logLevel: 'error',
  });

  // Poll until done
  while (true) {
    const progress = await getRenderProgress({ renderId, bucketName, functionName: FUNCTION_NAME, region: REGION });
    if (progress.done) return progress.outputFile!;
    if (progress.fatalErrorEncountered) throw new Error(progress.errors[0]?.message || 'Render failed');
    await new Promise(r => setTimeout(r, 3000));
  }
}

export async function POST(req: NextRequest) {
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: 'Missing post id' }, { status: 400 });

  // Get post
  const { data: post, error } = await supabase.from('posts').select('*').eq('id', id).single();
  if (error || !post) return NextResponse.json({ error: 'Post not found' }, { status: 404 });

  // Mark as rendering
  await supabase.from('posts').update({ render_status: 'rendering' }).eq('id', id);

  try {
    const [badUrl, goodUrl] = await Promise.all([
      renderVideo({
        prompt: post.bad_prompt,
        output: post.bad_output,
        variant: 'bad',
        postNumber: 1,
        category: post.category,
      }, `${id}-bad.mp4`),
      renderVideo({
        prompt: post.good_prompt,
        output: post.good_output,
        variant: 'good',
        postNumber: 2,
        category: post.category,
      }, `${id}-good.mp4`),
    ]);

    // Update post with video URLs and move to video review
    await supabase.from('posts').update({
      video_bad_url: badUrl,
      video_good_url: goodUrl,
      render_status: 'done',
      status: 'pending_video_review',
    }).eq('id', id);

    // Notify Telegram
    if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
      await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: process.env.TELEGRAM_CHAT_ID,
          parse_mode: 'HTML',
          text: `🎬 <b>Videos ready for review!</b>\n\nPost: ${post.category} — ${post.bad_prompt?.slice(0, 50)}...\n\n<a href="https://well-prompted-pi.vercel.app/queue">Review videos →</a>`,
        }),
      });
    }

    return NextResponse.json({ success: true, video_bad_url: badUrl, video_good_url: goodUrl });
  } catch (err: any) {
    await supabase.from('posts').update({ render_status: 'failed' }).eq('id', id);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
