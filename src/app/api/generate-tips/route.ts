import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

// Curated tip list topics for @well.prompted
const TIP_TOPICS = [
  { title: '5 words that instantly improve any prompt', category: 'technique', count: 5 },
  { title: '7 prompt mistakes killing your AI outputs', category: 'mistakes', count: 7 },
  { title: '5 prompts every professional should have saved', category: 'productivity', count: 5 },
  { title: '6 ways to get AI to stop hedging and just answer', category: 'technique', count: 6 },
  { title: '5 prompts that turn ChatGPT into a thinking partner', category: 'productivity', count: 5 },
  { title: '7 things to always tell the AI before asking anything', category: 'technique', count: 7 },
  { title: '5 prompt structures that work on every AI model', category: 'technique', count: 5 },
  { title: '6 signs your prompt is the problem, not the AI', category: 'mistakes', count: 6 },
  { title: '5 ways to make AI write in your voice, not its default', category: 'writing', count: 5 },
  { title: '7 prompts for when you\'re stuck and need to think clearly', category: 'productivity', count: 7 },
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

  // Prevent duplicates: check existing tip list titles
  const { data: existingTips } = await supabase
    .from('posts')
    .select('bad_prompt')
    .eq('format', 'tip_list')
    .catch(() => ({ data: [] }));
  
  const usedTitles = new Set(
    (existingTips || []).map((p: any) => p.bad_prompt?.trim().toLowerCase()).filter(Boolean)
  );

  let topicIndex = body.topic_index !== undefined
    ? body.topic_index
    : Math.floor(Math.random() * TIP_TOPICS.length);

  let topic = TIP_TOPICS[topicIndex % TIP_TOPICS.length];
  let attemptsLeft = TIP_TOPICS.length;

  // Find first unused topic
  while (attemptsLeft > 0 && usedTitles.has(topic.title.trim().toLowerCase())) {
    topicIndex = (topicIndex + 1) % TIP_TOPICS.length;
    topic = TIP_TOPICS[topicIndex];
    attemptsLeft--;
  }

  if (attemptsLeft === 0) {
    return NextResponse.json({
      error: 'All tip list topics have already been generated. Add more to the TIP_TOPICS array.',
    }, { status: 400 });
  }

  try {
    const raw = await callClaude(`
You create punchy, specific tip lists for @well.prompted — an Instagram page teaching prompt engineering.

Generate exactly ${topic.count} tips for this topic: "${topic.title}"

Audience: professionals who use AI daily and are frustrated with generic outputs. They want specific, actionable techniques they can use immediately.

Rules for each tip:
- 10-20 words max per tip
- Specific and actionable — not "be specific" but "replace adjectives like 'professional' with concrete examples"
- No fluffy intros like "Remember to..." or "Make sure you..."
- Each tip teaches ONE distinct technique
- Punchy enough to stand alone on a slide
- No overlap between tips

Return JSON only:
{
  "title": "${topic.title}",
  "tips": ["tip 1", "tip 2", ...],
  "caption": "single punchy Instagram caption for this post. Hook first line (5-8 words). 2 short sentences explaining the value. End with: Save this."
}`, 700);

    const clean = raw.replace(/```json\n?|\n?```/g, '').trim();
    const start = clean.indexOf('{');
    const end = clean.lastIndexOf('}') + 1;
    const data = JSON.parse(clean.slice(start, end));

    // Save as a tip_list post
    const { data: post, error } = await supabase.from('posts').insert({
      status: 'pending_review',
      format: 'tip_list',
      category: topic.category,
      techniques: [],
      // Reuse bad_prompt/good_prompt fields for tip content
      bad_prompt: data.title,           // title
      bad_output: JSON.stringify(data.tips), // tips as JSON
      good_prompt: '',
      good_output: '',
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
          text: `🆕 <b>New tip list ready for review</b>\n\n<b>${data.title}</b>\n${data.tips.slice(0, 3).map((t: string, i: number) => `${i + 1}. ${t}`).join('\n')}...\n\n<a href="https://well-prompted-pi.vercel.app/queue">Review →</a>`,
        }),
      });
    }

    return NextResponse.json({ ...post, tips: data.tips, title: data.title });
  } catch (err: any) {
    console.error('Generate tips error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
