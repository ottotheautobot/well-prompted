import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logFire } from '@/lib/logger';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ET slot schedule: dayOfWeek → times in HH:MM 24h ET
const SLOT_SCHEDULE: Record<number, string[]> = {
  0: ['11:00'],
  1: ['08:00', '12:00'],
  2: ['08:00', '18:00'],
  3: ['08:00', '12:00'],
  4: ['08:00', '18:00'],
  5: ['08:00', '12:00'],
  6: ['10:00'],
};

function getETOffsetHours(): number {
  // Check DST: ET is UTC-4 (EDT) or UTC-5 (EST)
  const now = new Date();
  const jan = new Date(now.getFullYear(), 0, 1).getTimezoneOffset();
  const jul = new Date(now.getFullYear(), 6, 1).getTimezoneOffset();
  const isDST = now.getTimezoneOffset() < Math.max(jan, jul);
  return isDST ? -4 : -5;
}

function generateUpcomingSlots(daysAhead = 42): Date[] {
  const etOffset = getETOffsetHours();
  const slots: Date[] = [];
  const now = new Date();

  for (let d = 0; d < daysAhead; d++) {
    const dayUTC = new Date(now);
    dayUTC.setUTCDate(dayUTC.getUTCDate() + d);

    // Compute ET date
    const etMs = dayUTC.getTime() + etOffset * 3600000;
    const etDate = new Date(etMs);
    const dow = etDate.getUTCDay();
    const times = SLOT_SCHEDULE[dow] || [];

    for (const t of times) {
      const [h, m] = t.split(':').map(Number);
      const slotUTC = new Date(Date.UTC(
        etDate.getUTCFullYear(), etDate.getUTCMonth(), etDate.getUTCDate(),
        h - etOffset, m, 0
      ));
      if (slotUTC > now) slots.push(slotUTC);
    }
  }
  return slots.sort((a, b) => a.getTime() - b.getTime());
}

export async function POST(_req: NextRequest) {
  // Fetch pending_schedule posts (oldest first)
  const { data: pending } = await supabase
    .from('posts')
    .select('id')
    .eq('status', 'pending_schedule')
    .order('created_at', { ascending: true });

  if (!pending?.length) return NextResponse.json({ assigned: 0 });

  // Fetch already-scheduled slot times
  const { data: scheduled } = await supabase
    .from('posts')
    .select('scheduled_at')
    .eq('status', 'scheduled')
    .not('scheduled_at', 'is', null);

  const taken = new Set((scheduled || []).map(p => new Date(p.scheduled_at).toISOString()));
  const available = generateUpcomingSlots().filter(s => !taken.has(s.toISOString()));

  const toAssign = Math.min(pending.length, available.length);
  const results = [];

  for (let i = 0; i < toAssign; i++) {
    const { data } = await supabase
      .from('posts')
      .update({ status: 'scheduled', scheduled_at: available[i].toISOString() })
      .eq('id', pending[i].id)
      .select()
      .single();
    if (data) results.push(data);
  }

  logFire('schedule', 'info', `Auto-scheduled ${results.length} posts`);
  return NextResponse.json({ assigned: results.length, posts: results });
}
