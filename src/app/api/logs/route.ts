import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const level    = searchParams.get('level');
  const category = searchParams.get('category');
  const postId   = searchParams.get('postId');
  const search   = searchParams.get('search');
  const limit    = parseInt(searchParams.get('limit') || '100');

  let query = supabase
    .from('logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (level)    query = query.eq('level', level);
  if (category) query = query.eq('category', category);
  if (postId)   query = query.eq('post_id', postId);
  if (search)   query = query.ilike('message', `%${search}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
