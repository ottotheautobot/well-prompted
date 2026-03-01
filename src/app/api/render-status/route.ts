import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getRenderProgress } from '@remotion/lambda/client';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const REGION = (process.env.AWS_REGION || 'us-east-2') as 'us-east-2';
const FUNCTION_NAME = process.env.REMOTION_FUNCTION_NAME!;

export async function POST(req: NextRequest) {
  const { id, bad_render_id, good_render_id, bucket } = await req.json();
  if (!id || !bad_render_id || !good_render_id || !bucket) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 });
  }

  const { data: post } = await supabase.from('posts').select('category,bad_prompt').eq('id', id).single();

  try {
    const [badProgress, goodProgress] = await Promise.all([
      getRenderProgress({ renderId: bad_render_id, bucketName: bucket, functionName: FUNCTION_NAME, region: REGION }),
      getRenderProgress({ renderId: good_render_id, bucketName: bucket, functionName: FUNCTION_NAME, region: REGION }),
    ]);

    const badDone = badProgress.done;
    const goodDone = goodProgress.done;
    const overallProgress = ((badProgress.overallProgress + goodProgress.overallProgress) / 2 * 100).toFixed(0);

    if (badDone && goodDone) {
      await supabase.from('posts').update({
        video_bad_url: badProgress.outputFile,
        video_good_url: goodProgress.outputFile,
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
            text: `🎬 <b>Videos ready for review!</b>\n\nCategory: ${post?.category}\n"${post?.bad_prompt?.slice(0, 50)}"\n\n<a href="https://well-prompted-pi.vercel.app/queue">Review →</a>`,
          }),
        });
      }

      return NextResponse.json({ done: true, video_bad_url: badProgress.outputFile, video_good_url: goodProgress.outputFile });
    }

    if (badProgress.fatalErrorEncountered || goodProgress.fatalErrorEncountered) {
      await supabase.from('posts').update({ render_status: 'failed' }).eq('id', id);
      return NextResponse.json({ done: false, error: 'Render failed' }, { status: 500 });
    }

    return NextResponse.json({ done: false, progress: parseInt(overallProgress) });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
