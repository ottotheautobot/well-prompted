import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

async function ask(prompt: string, maxTokens = 800): Promise<string> {
  const r = await anthropic.messages.create({
    model: 'claude-haiku-4-5', max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }],
  });
  return r.content[0].type === 'text' ? r.content[0].text : '';
}

export async function POST(req: NextRequest) {
  const { id, section } = await req.json();
  if (!id || !section) return NextResponse.json({ error: 'Missing id or section' }, { status: 400 });

  const { data: post } = await supabase.from('posts').select('*').eq('id', id).single();
  if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 });

  // ── WHY BREAKDOWN ──────────────────────────────────────────
  if (section === 'why') {
    const raw = await ask(
      `You're explaining to a smart person why one prompt works better than another. Sound like a real person — direct, a little sharp, no corporate jargon.

OKAY PROMPT: "${post.bad_prompt}"
WELL PROMPTED: "${post.good_prompt}"

Write 4-5 breakdown items. Each needs:
- TITLE: 4-6 words, plain English, active voice. Sounds like something you'd say out loud. NOT "Leverages Contextual Specificity" — YES "Naming the person changes everything"
- DESCRIPTION: 10-15 words MAX. One punchy sentence. Why does this change make the AI respond better? Cut every word that doesn't earn its place.

Avoid: nominalizations, passive voice, words like "leverages / facilitates / enables / anchors / reframes / optimizes"
Write like you're explaining it to a colleague over lunch, not in a performance review.

Return JSON array only:
[{"title":"...","description":"..."},...]`, 700
    );
    let why: { title: string; description: string }[] = [];
    try {
      const s = raw.indexOf('['), e = raw.lastIndexOf(']');
      why = JSON.parse(raw.slice(s, e + 1));
    } catch {
      return NextResponse.json({ error: 'Failed to parse why breakdown' }, { status: 500 });
    }
    await supabase.from('posts').update({ good_output: JSON.stringify(why) }).eq('id', id);
    return NextResponse.json({ success: true, section: 'why', data: why });
  }

  // ── CAPTION ────────────────────────────────────────────────
  if (section === 'caption') {
    const category = post.category || 'career';
    const tagMap: Record<string, string> = {
      career: '#careergrowth #careeradvice #ChatGPT #AItools #promptengineering',
      job_search: '#jobsearch #jobhunting #ChatGPT #AItools #promptengineering',
      communication: '#communication #AItools #ChatGPT #promptengineering #productivity',
      writing: '#writing #AIwriting #ChatGPT #promptengineering #contentcreation',
      thinking: '#criticalthinking #AItools #ChatGPT #promptengineering #productivity',
    };
    const raw = await ask(
      `Write an Instagram caption for a prompt engineering before/after Reel.

OKAY PROMPT: "${post.bad_prompt}"
WELL PROMPTED: "${post.good_prompt}"
CATEGORY: ${category}

Caption formula:
Line 1: Hook — 5-8 words, calls out the mistake directly, make it sting
Lines 2-3: 1-2 short punchy sentences on WHY the vague prompt fails
Line 3: Technique in caps + em dash + one line on what it does
[blank line]
—
[blank line]
3-5 lines of hashtags including: #wellprompted #promptengineering ${tagMap[category] || ''}

Rules: no quotes around prompts, no emojis, no "follow for more", no hashtags in the body
Return the caption text only, no JSON.`, 400
    );
    await supabase.from('posts').update({ caption_bad: raw.trim() }).eq('id', id);
    return NextResponse.json({ success: true, section: 'caption', data: raw.trim() });
  }

  // ── WELL PROMPTED only (okay prompt stays as-is) ───────────
  if (section === 'prompts') {
    const raw = await ask(
      `You are a prompt engineering expert. Rewrite the "well prompted" version of this prompt.

OKAY PROMPT (do not change this): "${post.bad_prompt}"

Write a new "well prompted" version. Rules:
- 40-65 words MAX. Punchy, not a requirements doc.
- Add 3-4 targeted improvements (context, constraint, tone, specific detail)
- Flowing sentences — no bullet points, no headers
- Use realistic placeholders like [Manager's name], [15%], [specific achievement]
- Should feel like something a smart person would actually type, not a template

Return ONLY the prompt text, nothing else.`, 300
    );
    const wellPrompt = raw.trim();
    await supabase.from('posts').update({ good_prompt: wellPrompt }).eq('id', id);
    return NextResponse.json({ success: true, section: 'prompts', data: { okayPrompt: post.bad_prompt, wellPrompt } });
  }

  return NextResponse.json({ error: `Unknown section: ${section}` }, { status: 400 });
}
