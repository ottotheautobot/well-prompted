import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Default posting schedule — best times for tech/professional IG audience
// Times in ET (UTC-5 in winter, UTC-4 summer)
const DEFAULT_SLOTS = [
  { day: 1, hour: 8,  minute: 0  }, // Monday 8am
  { day: 1, hour: 12, minute: 0  }, // Monday noon
  { day: 2, hour: 8,  minute: 0  }, // Tuesday 8am
  { day: 2, hour: 18, minute: 0  }, // Tuesday 6pm
  { day: 3, hour: 8,  minute: 0  }, // Wednesday 8am
  { day: 3, hour: 12, minute: 0  }, // Wednesday noon
  { day: 4, hour: 8,  minute: 0  }, // Thursday 8am
  { day: 4, hour: 18, minute: 0  }, // Thursday 6pm
  { day: 5, hour: 8,  minute: 0  }, // Friday 8am
  { day: 5, hour: 12, minute: 0  }, // Friday noon
  { day: 6, hour: 10, minute: 0  }, // Saturday 10am
  { day: 0, hour: 11, minute: 0  }, // Sunday 11am
];

// GET /api/schedule — return upcoming slots + what's scheduled in them
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const weeks = parseInt(url.searchParams.get('weeks') || '2');

  // Build slot list for the next N weeks
  const now = new Date();
  const slots = [];

  for (let w = 0; w < weeks; w++) {
    for (const slot of DEFAULT_SLOTS) {
      const date = new Date(now);
      const daysUntil = (slot.day - date.getDay() + 7) % 7 + w * 7;
      date.setDate(date.getDate() + daysUntil);
      date.setHours(slot.hour + 5, slot.minute, 0, 0); // convert ET to UTC (approx)

      if (date > now) {
        slots.push({
          slot_time: date.toISOString(),
          day: slot.day,
          hour: slot.hour,
          minute: slot.minute,
        });
      }
    }
  }

  slots.sort((a, b) => new Date(a.slot_time).getTime() - new Date(b.slot_time).getTime());

  // Get scheduled posts to overlay on calendar
  const { data: scheduled } = await supabase
    .from('posts')
    .select('id, scheduled_at, format, category, bad_prompt')
    .in('status', ['scheduled', 'published'])
    .gte('scheduled_at', now.toISOString())
    .order('scheduled_at', { ascending: true });

  return NextResponse.json({ slots: slots.slice(0, 30), scheduled: scheduled || [] });
}

// POST /api/schedule — assign a post to a slot
export async function POST(req: NextRequest) {
  const { post_id, slot_time } = await req.json();
  if (!post_id || !slot_time) {
    return NextResponse.json({ error: 'post_id and slot_time required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('posts')
    .update({ scheduled_at: slot_time, status: 'scheduled' })
    .eq('id', post_id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// PATCH /api/schedule — auto-fill empty slots with approved posts
export async function PATCH(req: NextRequest) {
  // Get all approved posts with videos ready
  const { data: approved } = await supabase
    .from('posts')
    .select('id, format, category')
    .eq('status', 'approved')
    .eq('render_status', 'done')
    .order('created_at', { ascending: true });

  if (!approved?.length) {
    return NextResponse.json({ message: 'No approved posts ready to schedule', filled: 0 });
  }

  // Get next available slots (no post currently scheduled in that window)
  const { data: alreadyScheduled } = await supabase
    .from('posts')
    .select('scheduled_at')
    .in('status', ['scheduled', 'published'])
    .gte('scheduled_at', new Date().toISOString());

  const takenTimes = new Set(alreadyScheduled?.map(p => p.scheduled_at) || []);

  // Generate upcoming slots
  const now = new Date();
  const upcomingSlots: Date[] = [];
  for (let w = 0; w < 4; w++) {
    for (const slot of DEFAULT_SLOTS) {
      const date = new Date(now);
      const daysUntil = (slot.day - date.getDay() + 7) % 7 + w * 7;
      date.setDate(date.getDate() + daysUntil);
      date.setHours(slot.hour + 5, slot.minute, 0, 0);
      if (date > now) upcomingSlots.push(date);
    }
  }
  upcomingSlots.sort((a, b) => a.getTime() - b.getTime());

  const freeSlots = upcomingSlots.filter(s => !takenTimes.has(s.toISOString()));

  // Assign posts to slots — alternate formats for variety
  let filled = 0;
  for (let i = 0; i < Math.min(approved.length, freeSlots.length); i++) {
    await supabase
      .from('posts')
      .update({ scheduled_at: freeSlots[i].toISOString(), status: 'scheduled' })
      .eq('id', approved[i].id);
    filled++;
  }

  return NextResponse.json({ message: `Scheduled ${filled} posts`, filled });
}
