import { NextRequest, NextResponse } from 'next/server';
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

  const status = action === 'approve' ? 'scheduled' : 'rejected';

  // If approving, schedule for next available slot (default: 1 hour from now)
  const updates: Record<string, unknown> = { status };
  if (action === 'approve') {
    const scheduledAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    updates.scheduled_at = scheduledAt;
  }

  const { data, error } = await supabase
    .from('posts')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (action === 'approve' && process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
    await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: process.env.TELEGRAM_CHAT_ID,
        parse_mode: 'HTML',
        text: `📅 <b>Post scheduled!</b>\n\nCategory: ${data.category}\nScheduled for: ${new Date(data.scheduled_at).toLocaleString('en-US', { timeZone: 'America/New_York' })} ET`,
      }),
    });
  }

  return NextResponse.json(data);
}
