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
  const { id, render_id, bucket } = await req.json();
  if (!id || !render_id) return NextResponse.json({ error: 'Missing id or render_id' }, { status: 400 });

  const progress = await getRenderProgress({
    renderId: render_id,
    bucketName: bucket,
    functionName: FUNCTION_NAME,
    region: REGION,
  });

  if (progress.fatalErrorEncountered) {
    await supabase.from('posts').update({ render_status: 'failed', status: 'approved' }).eq('id', id);
    return NextResponse.json({ done: false, error: progress.errors?.[0]?.message || 'Render failed' });
  }

  if (progress.done && progress.outputFile) {
    await supabase.from('posts').update({
      render_status: 'done',
      status: 'pending_video_review',
      video_url: progress.outputFile,
      // Keep video_bad_url for publish compat
      video_bad_url: progress.outputFile,
    }).eq('id', id);

    return NextResponse.json({ done: true, video_url: progress.outputFile, progress: 1 });
  }

  return NextResponse.json({ done: false, progress: progress.overallProgress });
}
