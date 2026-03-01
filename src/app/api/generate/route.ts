import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const CATEGORIES = ['writing', 'coding', 'business', 'image_gen', 'data', 'creative', 'productivity'];

async function callClaude(prompt: string, system?: string): Promise<string> {
  const msg = await client.messages.create({
    model: 'claude-haiku-4-5',  // Fast + cheap for actual prompt runs
    max_tokens: 512,
    ...(system ? { system } : {}),
    messages: [{ role: 'user', content: prompt }],
  });
  return msg.content[0].type === 'text' ? msg.content[0].text.trim() : '';
}

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const category = body.category || CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
  const topic = body.topic || null;

  try {
    // === STAGE 1: Generate concept — bad prompt, good prompt, techniques ===
    const conceptRaw = await callClaude(
      `You are the content strategist for well.prompted, an Instagram page teaching prompt engineering.

Generate a before/after prompt concept for this category: ${category}
${topic ? `Topic: ${topic}` : 'Choose a relatable, everyday topic people actually struggle with.'}

Rules for the GOOD prompt:
- Max 2-3 targeted improvements over the bad prompt
- Should feel achievable — something a smart person writes in 30 seconds
- Must produce a dramatically better result, not just a longer prompt
- No jargon, no over-engineering

Return JSON only:
{
  "topic": "one-line description of the task",
  "bad_prompt": "the vague, naive prompt a beginner would write",
  "good_prompt": "the improved prompt — concise but targeted",
  "techniques": ["technique1", "technique2"],
  "improvement_summary": "1 sentence: the core difference between bad and good"
}`,
    );

    const concept = JSON.parse(conceptRaw.replace(/```json\n?|\n?```/g, '').trim());

    // === STAGE 2: Run the BAD prompt for real ===
    const bad_output = await callClaude(concept.bad_prompt);

    // === STAGE 3: Run the GOOD prompt for real ===
    const good_output = await callClaude(concept.good_prompt);

    // === STAGE 4: Generate captions ===
    const captionsRaw = await callClaude(
      `You write captions for well.prompted, an Instagram page teaching prompt engineering.

Here's a before/after prompt comparison:

BAD PROMPT: "${concept.bad_prompt}"
BAD OUTPUT: "${bad_output.slice(0, 300)}"

GOOD PROMPT: "${concept.good_prompt}"
GOOD OUTPUT: "${good_output.slice(0, 300)}"

IMPROVEMENT: ${concept.improvement_summary}

Write two captions:
- caption_bad: 2 sentences. Why this prompt fails — what's missing, what the AI has to guess. End with a hook that makes people swipe.
- caption_good: 2 sentences. What specific changes were made and exactly why they work. Concrete, not vague.

Tone: Smart, direct, slightly edgy. Like a senior engineer explaining something. No corporate speak.

Return JSON only:
{
  "caption_bad": "...",
  "caption_good": "..."
}`,
    );

    const captions = JSON.parse(captionsRaw.replace(/```json\n?|\n?```/g, '').trim());

    // === Save to DB ===
    const { data, error } = await supabase.from('posts').insert({
      status: 'pending_review',
      format: 'before_after',
      category,
      techniques: concept.techniques || [],
      bad_prompt: concept.bad_prompt,
      bad_output,
      good_prompt: concept.good_prompt,
      good_output,
      caption_bad: captions.caption_bad,
      caption_good: captions.caption_good,
      render_status: 'pending',
    }).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // === Notify Telegram ===
    if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
      await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: process.env.TELEGRAM_CHAT_ID,
          parse_mode: 'HTML',
          text: `🆕 <b>New post ready for review</b>\n\n<b>Category:</b> ${category}\n<b>Topic:</b> ${concept.topic}\n\n<b>Bad:</b> "${concept.bad_prompt}"\n<b>Good:</b> "${concept.good_prompt}"\n\n<a href="https://well-prompted-pi.vercel.app/queue">Review in portal →</a>`,
        }),
      });
    }

    return NextResponse.json(data);
  } catch (err: any) {
    console.error('Generate error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
