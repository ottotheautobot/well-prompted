import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logFire } from '@/lib/logger';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Assign a post to a slot, or unassign (scheduled_at: null)
export async function POST(req: NextRequest) {
  const { id, scheduled_at } = await req.json();
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  if (scheduled_at) {
    // Assign to slot
    const { data, error } = await supabase
      .from('posts')
      .update({ status: 'scheduled', scheduled_at })
      .eq('id', id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    logFire('schedule', 'info', `Post scheduled at ${scheduled_at}`, { postId: id });
    return NextResponse.json(data);
  } else {
    // Unassign — back to pending_schedule
    const { data, error } = await supabase
      .from('posts')
      .update({ status: 'pending_schedule', scheduled_at: null })
      .eq('id', id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    logFire('schedule', 'info', `Post unscheduled`, { postId: id });
    return NextResponse.json(data);
  }
}
