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

  // Mark as rendering immediately
  await supabase.from('posts').update({ render_status: 'rendering', status: 'rendering' }).eq('id', id);

  try {
    // Fire both renders — returns immediately with render IDs, does NOT wait for completion
    const [badRender, goodRender] = await Promise.all([
      renderMediaOnLambda({
        region: REGION,
        functionName: FUNCTION_NAME,
        serveUrl: SITE_URL,
        composition: 'PromptVideo',
        inputProps: {
          prompt: post.bad_prompt,
          output: post.bad_output,
          outputSnippet: post.bad_output_snippet || post.bad_output.slice(0, 120),
          variant: 'bad',
          postNumber: 1,
          category: post.category,
        },
        codec: 'h264',
        imageFormat: 'jpeg',
        maxRetries: 1,
        outName: `${id}-bad.mp4`,
        logLevel: 'error',
        framesPerLambda: 300,
        concurrencyPerLambda: 1,
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
          outputSnippet: post.good_output_snippet || post.good_output.slice(0, 120),
          variant: 'good',
          postNumber: 2,
          category: post.category,
        },
        codec: 'h264',
        imageFormat: 'jpeg',
        maxRetries: 1,
        outName: `${id}-good.mp4`,
        logLevel: 'error',
        framesPerLambda: 300,
        concurrencyPerLambda: 1,
        downloadBehavior: { type: 'play-in-browser' },
      }),
    ]);

    // Save render IDs so the status endpoint can poll them
    await supabase.from('posts').update({
      render_ids: {
        bad_render_id: badRender.renderId,
        good_render_id: goodRender.renderId,
        bucket: badRender.bucketName,
      }
    }).eq('id', id);

    return NextResponse.json({
      success: true,
      bad_render_id: badRender.renderId,
      good_render_id: goodRender.renderId,
      bucket: badRender.bucketName,
      message: 'Renders started. Poll /api/render-status to check progress.',
    });

  } catch (err: any) {
    await supabase.from('posts').update({ render_status: 'failed', status: 'approved' }).eq('id', id);
    console.error('Render error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
