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

export const maxDuration = 60; // Vercel Pro max

export async function POST(req: NextRequest) {
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: 'Missing post id' }, { status: 400 });

  const { data: post, error } = await supabase.from('posts').select('*').eq('id', id).single();
  if (error || !post) return NextResponse.json({ error: 'Post not found' }, { status: 404 });

  await supabase.from('posts').update({ render_status: 'rendering', status: 'rendering' }).eq('id', id);

  try {
    // Fire both renders — don't wait for completion, just get render IDs
    const [badRender, goodRender] = await Promise.all([
      renderMediaOnLambda({
        region: REGION,
        functionName: FUNCTION_NAME,
        serveUrl: SITE_URL,
        composition: 'PromptVideo',
        inputProps: {
          prompt: post.bad_prompt,
          output: post.bad_output,
          variant: 'bad',
          postNumber: 1,
          category: post.category,
        },
        codec: 'h264',
        imageFormat: 'jpeg',
        maxRetries: 1,
        outName: `${id}-bad.mp4`,
        logLevel: 'error',
        downloadBehavior: { type: 'play-in-browser' },
      }),
      renderMediaOnLambda({
        region: REGION,
        functionName: FUNCTION_NAME,
        serveUrl: SITE_URL,
        composition: 'PromptVideo',
        inputProps: {
          prompt: post.good_prompt,
          output: post.good_output,
          variant: 'good',
          postNumber: 2,
          category: post.category,
        },
        codec: 'h264',
        imageFormat: 'jpeg',
        maxRetries: 1,
        outName: `${id}-good.mp4`,
        logLevel: 'error',
        downloadBehavior: { type: 'play-in-browser' },
      }),
    ]);

    // Store render IDs so the poll endpoint can check status
    await supabase.from('posts').update({
      render_status: 'rendering',
      // Store render metadata in a JSON field — add this column if needed
    }).eq('id', id);

    // Poll for completion in background (up to 55s before Vercel kills us)
    const deadline = Date.now() + 50000;
    let badDone = false, goodDone = false;
    let badUrl = '', goodUrl = '';

    const { getRenderProgress } = await import('@remotion/lambda/client');

    while (Date.now() < deadline && (!badDone || !goodDone)) {
      await new Promise(r => setTimeout(r, 4000));

      if (!badDone) {
        const p = await getRenderProgress({ renderId: badRender.renderId, bucketName: badRender.bucketName, functionName: FUNCTION_NAME, region: REGION });
        if (p.done) { badUrl = p.outputFile!; badDone = true; }
        if (p.fatalErrorEncountered) throw new Error('Bad render failed: ' + p.errors[0]?.message);
      }

      if (!goodDone) {
        const p = await getRenderProgress({ renderId: goodRender.renderId, bucketName: goodRender.bucketName, functionName: FUNCTION_NAME, region: REGION });
        if (p.done) { goodUrl = p.outputFile!; goodDone = true; }
        if (p.fatalErrorEncountered) throw new Error('Good render failed: ' + p.errors[0]?.message);
      }
    }

    if (badDone && goodDone) {
      // Both done within timeout
      await supabase.from('posts').update({
        video_bad_url: badUrl,
        video_good_url: goodUrl,
        render_status: 'done',
        status: 'pending_video_review',
      }).eq('id', id);

      if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
        await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: process.env.TELEGRAM_CHAT_ID,
            parse_mode: 'HTML',
            text: `🎬 <b>Videos ready for review!</b>\n\nCategory: ${post.category}\nTopic: "${post.bad_prompt?.slice(0, 50)}"\n\n<a href="https://well-prompted-pi.vercel.app/queue">Review videos →</a>`,
          }),
        });
      }

      return NextResponse.json({ success: true, video_bad_url: badUrl, video_good_url: goodUrl });
    } else {
      // Still rendering after timeout — renders continue on Lambda, client should poll
      return NextResponse.json({
        success: false,
        still_rendering: true,
        bad_render_id: badRender.renderId,
        good_render_id: goodRender.renderId,
        bucket: badRender.bucketName,
        message: 'Renders started. Check back in a minute.',
      });
    }
  } catch (err: any) {
    await supabase.from('posts').update({ render_status: 'failed' }).eq('id', id);
    console.error('Render error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
