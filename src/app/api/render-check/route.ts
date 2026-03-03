import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logFire } from '@/lib/logger';
import { getRenderProgress } from '@remotion/lambda/client';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const REGION = (process.env.AWS_REGION || 'us-east-2') as 'us-east-2';
const FUNCTION_NAME = process.env.REMOTION_FUNCTION_NAME!;

// Called by cron every 2 min + on queue page load (GET)
// Resolves all posts stuck in "rendering" status
export async function GET(req: NextRequest) {
  const { data: stuck, error } = await supabase
    .from('posts')
    .select('id, render_ids')
    .eq('status', 'rendering');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!stuck || stuck.length === 0) return NextResponse.json({ checked: 0, resolved: [] });

  logFire('render-check', 'info', `Checking ${stuck.length} stuck render(s)`);

  const resolved: string[] = [];
  const failed: string[] = [];

  for (const post of stuck) {
    const ids = post.render_ids as { render_id?: string; bucket?: string } | null;
    if (!ids?.render_id || !ids?.bucket) {
      // No render IDs — orphaned, reset to approved
      await supabase.from('posts').update({ status: 'approved', render_status: null }).eq('id', post.id);
      failed.push(post.id);
      continue;
    }

    try {
      const progress = await getRenderProgress({
        renderId: ids.render_id,
        bucketName: ids.bucket,
        functionName: FUNCTION_NAME,
        region: REGION,
      });

      if (progress.fatalErrorEncountered) {
        logFire('render-check', 'error', `Render fatal error for post ${post.id}`, { postId: post.id, renderId: ids.render_id });
        await supabase.from('posts').update({ status: 'approved', render_status: 'failed', render_ids: null }).eq('id', post.id);
        failed.push(post.id);
      } else if (progress.done && progress.outputFile) {
        logFire('render-check', 'info', `Resolved stuck render for post ${post.id}`, { postId: post.id, renderId: ids.render_id });
        await supabase.from('posts').update({
          status: 'pending_video_review',
          render_status: 'done',
          video_bad_url: progress.outputFile,
        }).eq('id', post.id);
        resolved.push(post.id);
      }
      // Still in progress — leave it, cron will pick it up next run
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      // Lambda job expired or unknown — reset to approved so user can re-render
      if (msg.includes('does not exist') || msg.includes('expired') || msg.includes('NoSuchKey')) {
        await supabase.from('posts').update({ status: 'approved', render_status: 'expired', render_ids: null }).eq('id', post.id);
        failed.push(post.id);
      }
    }
  }

  return NextResponse.json({ checked: stuck.length, resolved, failed });
}
