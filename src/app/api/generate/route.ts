import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SYSTEM_PROMPT = `You are the content engine for well.prompted, an Instagram page that teaches prompt engineering through before/after comparisons.

Generate compelling prompt comparison content. Each post shows a naive prompt vs a well-crafted one, with captions explaining the WHY.

Tone: Smart, direct, slightly edgy. Like a senior engineer explaining something clearly. Not corporate, not preachy.

Always return valid JSON only — no markdown, no explanation outside the JSON.`;

const CATEGORIES = ['writing', 'coding', 'business', 'image_gen', 'data', 'creative', 'productivity'];
const FORMATS = ['before_after', 'tip_card', 'myth_bust'];

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const category = body.category || CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
  const format = body.format || 'before_after';
  const topic = body.topic || null;

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const userPrompt = `Generate a prompt comparison post.
Category: ${category}
Format: ${format}
${topic ? `Topic: ${topic}` : 'Choose an interesting, relatable topic for this category.'}

Return JSON with exactly these fields:
{
  "bad_prompt": "the vague, naive prompt",
  "bad_output": "simulate the mediocre AI response to the bad prompt (2-3 sentences, generic)",
  "good_prompt": "the well-crafted prompt using specific techniques",
  "good_output": "simulate the dramatically better AI response (more specific, useful, structured)",
  "caption_bad": "2-3 sentences: why this prompt fails — what's missing, what the AI is left to guess",
  "caption_good": "2-3 sentences: what specific techniques were added (role, constraints, format, etc.) and why they work",
  "techniques": ["array", "of", "technique", "names", "used"]
}`;

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const text = message.content[0].type === 'text' ? message.content[0].text : '';
    const generated = JSON.parse(text);

    // Save to DB as pending_review
    const { data, error } = await supabase.from('posts').insert({
      status: 'pending_review',
      format,
      category,
      techniques: generated.techniques || [],
      bad_prompt: generated.bad_prompt,
      bad_output: generated.bad_output,
      good_prompt: generated.good_prompt,
      good_output: generated.good_output,
      caption_bad: generated.caption_bad,
      caption_good: generated.caption_good,
      render_status: 'pending',
    }).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Notify Telegram
    if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
      await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: process.env.TELEGRAM_CHAT_ID,
          text: `🆕 New post ready for review!\n\nCategory: ${category} | Format: ${format}\nBad prompt: "${generated.bad_prompt.slice(0, 80)}..."\n\nReview at: https://well-prompted-pi.vercel.app/queue`,
        }),
      });
    }

    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
