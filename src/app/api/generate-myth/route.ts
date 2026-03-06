import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const MYTHS = [
  { myth: 'Longer prompts always get better results', category: 'technique' },
  { myth: 'You need to say "please" and "thank you" to AI', category: 'technique' },
  { myth: 'AI understands what you mean even if you\'re vague', category: 'technique' },
  { myth: 'ChatGPT and Claude work the same way, so prompts are interchangeable', category: 'technique' },
  { myth: 'The AI remembers your previous conversations', category: 'technique' },
  { myth: 'More examples in your prompt always helps', category: 'technique' },
  { myth: 'You can\'t tell AI what NOT to do', category: 'technique' },
  { myth: 'AI outputs are always biased toward agreement', category: 'technique' },
  { myth: 'Prompt engineering is only for developers', category: 'general' },
  { myth: 'You need to re-explain everything every message', category: 'technique' },
];

async function callClaude(prompt: string, maxTokens = 600): Promise<string> {
  const msg = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }],
  });
  return msg.content[0].type === 'text' ? msg.content[0].text.trim() : '';
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  
  // Prevent duplicates: check if myth already exists
  let idx = body.myth_index !== undefined
    ? body.myth_index % MYTHS.length
    : Math.floor(Math.random() * MYTHS.length);
  
  let item = MYTHS[idx];
  let attemptsLeft = MYTHS.length;
  
  while (attemptsLeft > 0) {
    const { data: existingPost } = await supabase
      .from('posts')
      .select('id')
      .eq('bad_prompt', item.myth)
      .limit(1)
      .single()
      .catch(() => ({ data: null }));
    
    if (!existingPost) {
      // Myth has never been generated (approved, rejected, or otherwise), safe to use
      break;
    }
    
    // Myth already exists, try next one
    idx = (idx + 1) % MYTHS.length;
    item = MYTHS[idx];
    attemptsLeft--;
  }
  
  if (attemptsLeft === 0) {
    return NextResponse.json({
      error: 'All myths have already been generated. Add more to the MYTHS array.',
    }, { status: 400 });
  }

  try {
    const raw = await callClaude(`
You create myth-busting content for @well.prompted, an Instagram page teaching prompt engineering to professionals.

MYTH TO BUST: "${item.myth}"

Generate a punchy myth bust post with:
- myth_statement: the myth as a bold claim (how people say it) — 1 sentence
- reality: the actual truth — 2-3 sentences, specific and concrete
- proof: a concrete example or comparison that proves the reality — 2-3 sentences
- fix: what to do instead — 1-2 actionable sentences
- caption: Instagram caption. Hook (5-8 words, calls out the myth). 2 short sentences on why people believe it and why they're wrong. End with "Save this."

Tone: Smart, direct. Like a senior engineer correcting a misconception. No hedging. No "it depends."

Return JSON only:
{
  "myth_statement": "...",
  "reality": "...",
  "proof": "...",
  "fix": "...",
  "caption": "..."
}`, 700);

    const clean = raw.replace(/```json\n?|\n?```/g, '').trim();
    const data = JSON.parse(clean.slice(clean.indexOf('{'), clean.lastIndexOf('}') + 1));

    const content = JSON.stringify({
      myth_statement: data.myth_statement,
      reality: data.reality,
      proof: data.proof,
      fix: data.fix,
    });

    const { data: post, error } = await supabase.from('posts').insert({
      status: 'pending_review',
      format: 'myth_bust',
      category: item.category,
      techniques: [],
      bad_prompt: item.myth,           // myth as "topic"
      bad_output: content,             // full myth bust content as JSON
      good_prompt: data.fix,           // the fix
      good_output: data.reality,
      bad_output_snippet: data.myth_statement,
      good_output_snippet: data.fix,
      caption_bad: data.caption,
      caption_good: '',
      render_status: 'pending',
    }).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
      await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: process.env.TELEGRAM_CHAT_ID,
          parse_mode: 'HTML',
          text: `🆕 <b>Myth bust ready for review</b>\n\n❌ MYTH: "${item.myth}"\n✅ REALITY: "${data.reality.slice(0, 120)}..."\n\n<a href="https://well-prompted-pi.vercel.app/queue">Review →</a>`,
        }),
      });
    }

    return NextResponse.json({ ...post, ...data });
  } catch (err: any) {
    console.error('Generate myth error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
