import { NextRequest, NextResponse } from 'next/server';
import { logFire } from '@/lib/logger';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const { id, action } = await req.json();

  if (!id || !['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  // Video approve → pending_schedule (user places it on calendar). Video reject → back to approved.
  const status = action === 'approve' ? 'pending_schedule' : 'approved';
  const updates: Record<string, unknown> = { status };
  if (action === 'reject') {
    // Clear video so Render button reappears
    updates.video_bad_url = null;
    updates.render_status = null;
    updates.render_ids = null;
  }

  const { data, error } = await supabase
    .from('posts')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  logFire('approve', 'info', `Video ${action}d — post → ${status}`, { postId: id });

  return NextResponse.json(data);
}
