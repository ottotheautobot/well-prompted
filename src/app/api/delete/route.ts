import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Statuses that are mid-process and should not be deleted
const LIMBO_STATUSES = ['rendering', 'publishing'];

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const { data: post, error: fetchErr } = await supabase
    .from('posts').select('id, status').eq('id', id).single();

  if (fetchErr || !post) return NextResponse.json({ error: 'Post not found' }, { status: 404 });

  if (LIMBO_STATUSES.includes(post.status)) {
    return NextResponse.json(
      { error: `Cannot delete — post is currently ${post.status}. Wait for it to finish.` },
      { status: 409 }
    );
  }

  const { error } = await supabase.from('posts').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
