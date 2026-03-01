import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

// Curated topic × technique matrix from content research
// Each entry: [topic, techniques[], badPromptHint, hookAngle]
const CONTENT_MATRIX = [
  // Professional Communication
  {
    category: 'professional_comms',
    topic: 'Ask for a raise via email',
    techniques: ['specificity', 'constraints', 'concrete evidence'],
    bad_hint: 'A vague request for a meeting to discuss compensation',
    good_hint: 'Include specific % ask, 2-3 concrete achievements, word limit',
    hook: 'The AI invented a career you don\'t have',
  },
  {
    category: 'professional_comms',
    topic: 'Cold outreach email to a potential client',
    techniques: ['role assignment', 'audience definition', 'personalization'],
    bad_hint: 'Generic intro email with no context about who you\'re writing to',
    good_hint: 'Define recipient\'s role, pain point, your specific value prop, max 3 sentences',
    hook: 'This is why your cold emails get ignored',
  },
  {
    category: 'professional_comms',
    topic: 'Script for a difficult conversation with a coworker',
    techniques: ['context loading', 'specificity', 'tone definition'],
    bad_hint: 'Write a script for a hard conversation at work',
    good_hint: 'Load context: what happened, relationship, desired outcome, what to avoid saying',
    hook: 'Vague prompt = therapy speak that helps no one',
  },
  {
    category: 'professional_comms',
    topic: 'Self-assessment for a performance review',
    techniques: ['output scaffolding', 'few-shot examples', 'specificity'],
    bad_hint: 'Help me write my performance self-assessment',
    good_hint: 'Give it your role, 3 wins with metrics, a growth area, and the exact format your company uses',
    hook: 'You\'re leaving half your review on the table',
  },
  {
    category: 'professional_comms',
    topic: 'LinkedIn post about a recent career win',
    techniques: ['negative constraints', 'role assignment', 'tone'],
    bad_hint: 'Write a LinkedIn post about landing a big client',
    good_hint: 'Assign a voice, ban corporate buzzwords, specify what the win actually was + why it matters',
    hook: 'Stop letting AI write LinkedIn cringe for you',
  },
  // Content & Writing
  {
    category: 'writing',
    topic: 'Blog post intro that actually hooks readers',
    techniques: ['audience definition', 'constraints', 'hook formula'],
    bad_hint: 'Write an intro for a blog post about remote work productivity',
    good_hint: 'Define reader (who they are, what they struggle with), ban the "In today\'s world" opener, first line must be a provocative question or bold claim',
    hook: 'Your AI blog intro is a sleeping pill',
  },
  {
    category: 'writing',
    topic: 'Email newsletter subject line with high open rates',
    techniques: ['few-shot examples', 'A/B variants', 'specificity'],
    bad_hint: 'Write a subject line for my newsletter about productivity',
    good_hint: 'Show 2-3 examples of your existing subject lines, ask for 10 variants in different styles (curiosity, specificity, contrast), pick one to A/B test',
    hook: 'Show it one example and it matches the style exactly',
  },
  {
    category: 'writing',
    topic: 'Instagram caption for a product launch',
    techniques: ['format constraints', 'negative constraints', 'audience'],
    bad_hint: 'Write an Instagram caption for my new product launch',
    good_hint: 'Specify the product benefit (not the feature), target emotion, ban generic CTAs and excessive emojis, max 3 lines + one CTA',
    hook: 'The AI thinks your audience is a children\'s birthday party',
  },
  {
    category: 'writing',
    topic: 'Rewrite a boring paragraph into something people actually read',
    techniques: ['role assignment', 'tone specification', 'constraints'],
    bad_hint: 'Make this paragraph more engaging',
    good_hint: 'Assign a specific voice (e.g., "write like a sharp magazine editor"), specify what to preserve, ban passive voice and filler words',
    hook: 'Same words, completely different energy',
  },
  {
    category: 'writing',
    topic: 'Brainstorm 10 content ideas for a niche topic',
    techniques: ['context loading', 'specificity', 'format'],
    bad_hint: 'Give me content ideas for my fitness Instagram',
    good_hint: 'Load context: audience (age, pain points, what they\'ve seen too much of), specify format (Reels vs posts), ask for 10 with one-line rationale for each',
    hook: 'Give it nothing, get a list you\'ve seen 100 times',
  },
  // Work Productivity
  {
    category: 'productivity',
    topic: 'Summarize a long document with action items',
    techniques: ['output scaffolding', 'format specification'],
    bad_hint: 'Summarize this document',
    good_hint: 'Specify: 3-bullet summary for someone who won\'t read it, then action items with owner + deadline format, flag anything that needs a decision',
    hook: 'Summaries that don\'t bury the one thing that matters',
  },
  {
    category: 'productivity',
    topic: 'Decide between two strategic options',
    techniques: ['chain of thought', 'role assignment', 'structured output'],
    bad_hint: 'Help me decide between hiring a freelancer or an employee',
    good_hint: 'Load your constraints (budget, timeline, skill gap), ask it to argue both sides first then give a recommendation with top 3 reasons',
    hook: 'Make the AI argue against its own answer first',
  },
  {
    category: 'productivity',
    topic: 'Write a meeting agenda that actually works',
    techniques: ['specificity', 'constraints', 'format'],
    bad_hint: 'Create a meeting agenda for a project kickoff',
    good_hint: 'Specify: who\'s attending (roles), goal of the meeting (decision vs update vs alignment), time budget per item, what must be resolved by the end',
    hook: 'Your AI agenda is just a list of nouns',
  },
  {
    category: 'productivity',
    topic: 'Status update email to leadership',
    techniques: ['role assignment', 'audience definition', 'format'],
    bad_hint: 'Write a project status update',
    good_hint: 'Define what leadership cares about (risks, blockers, timeline), lead with status (green/yellow/red), limit to what they need to action, not everything that happened',
    hook: 'Leadership reads the first sentence and stops',
  },
  {
    category: 'productivity',
    topic: '30-60-90 day plan for a new role',
    techniques: ['output scaffolding', 'specificity', 'context loading'],
    bad_hint: 'Write a 30-60-90 day plan for a new marketing manager',
    good_hint: 'Load the actual job description, specify company stage (startup vs enterprise), define what "success" looks like in 90 days, ask for 3 measurable goals per phase',
    hook: 'Generic plan = generic first impression',
  },
  // Job Search
  {
    category: 'job_search',
    topic: 'Tailor a resume bullet to a specific job description',
    techniques: ['context loading', 'specificity', 'keyword alignment'],
    bad_hint: 'Help me improve my resume bullet',
    good_hint: 'Paste the job description, paste your bullet, ask it to rewrite using the exact language from the JD, lead with the measurable impact',
    hook: 'Your resume says "responsible for things"',
  },
  {
    category: 'job_search',
    topic: 'Cover letter that doesn\'t sound like AI wrote it',
    techniques: ['few-shot examples', 'negative constraints', 'voice'],
    bad_hint: 'Write a cover letter for a product manager role at a tech startup',
    good_hint: 'Give it your actual tone (paste 2-3 sentences you\'ve written), ban phrases like "I am writing to express my interest," lead with the thing that makes you different',
    hook: 'Recruiters spot the AI cover letter in 3 seconds',
  },
  {
    category: 'job_search',
    topic: 'Prepare for a job interview',
    techniques: ['role assignment', 'chain of thought', 'context loading'],
    bad_hint: 'Help me prepare for a job interview',
    good_hint: 'Have it play the interviewer — give it the job description and your resume, ask it to grill you with likely hard questions, then critique your answers',
    hook: 'Have the AI interview you before the real thing',
  },
  {
    category: 'job_search',
    topic: 'Negotiate a job offer',
    techniques: ['specificity', 'context loading', 'role assignment'],
    bad_hint: 'Help me negotiate my job offer',
    good_hint: 'Load: the offer details, your competing offers or market data, what you want and your walk-away point — ask for the exact words to say in the negotiation call',
    hook: 'Don\'t negotiate without a script',
  },
  {
    category: 'job_search',
    topic: 'Follow-up after a job rejection',
    techniques: ['tone specification', 'context loading', 'strategic framing'],
    bad_hint: 'Write a follow-up email after being rejected for a job',
    good_hint: 'Specify: keep door open for future roles, ask for one piece of feedback, no desperation — 4 sentences max, professional but warm tone',
    hook: 'The follow-up most people never think to send',
  },
];

async function callClaude(prompt: string, system?: string, maxTokens = 600): Promise<string> {
  const msg = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: maxTokens,
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

  // Pick a content item: by index, by category, or random from matrix
  let contentItem = null;
  if (body.matrix_index !== undefined) {
    contentItem = CONTENT_MATRIX[body.matrix_index];
  } else if (body.category) {
    const filtered = CONTENT_MATRIX.filter(c => c.category === body.category);
    contentItem = filtered[Math.floor(Math.random() * filtered.length)];
  } else {
    contentItem = CONTENT_MATRIX[Math.floor(Math.random() * CONTENT_MATRIX.length)];
  }

  const category = contentItem?.category || 'writing';

  try {
    // === STAGE 1: Generate concrete bad + good prompts from the matrix hint ===
    const conceptRaw = await callClaude(
      `You are the content strategist for @well.prompted, an Instagram page teaching prompt engineering through before/after comparisons.

Generate a before/after prompt pair for this topic:
TOPIC: ${contentItem?.topic}
CATEGORY: ${category}

BAD PROMPT DIRECTION: ${contentItem?.bad_hint}
GOOD PROMPT DIRECTION: ${contentItem?.good_hint}
TECHNIQUES TO DEMONSTRATE: ${contentItem?.techniques?.join(', ')}

RULES for BAD prompt:
- Must be exactly what a smart but inexperienced person would actually type
- Not obviously wrong — just incomplete or vague
- 1-2 sentences max

RULES for GOOD prompt:
- 2-4 targeted additions/changes only (role, constraint, format, context)
- Must feel achievable — someone could write this in 60 seconds
- NOT a wall of text — no paragraph-length prompt engineering dissertations
- Should produce dramatically different output when actually run

Return JSON only, no markdown:
{
  "topic": "${contentItem?.topic}",
  "bad_prompt": "the realistic bad prompt",
  "good_prompt": "the improved prompt",
  "techniques": ${JSON.stringify(contentItem?.techniques || [])},
  "improvement_summary": "1 sentence: the 2-3 core changes made and why they matter"
}`,
      undefined, 400
    );

    const concept = JSON.parse(conceptRaw.replace(/```json\n?|\n?```/g, '').trim());

    // === STAGE 2: Run BAD prompt ===
    const bad_output = await callClaude(concept.bad_prompt, undefined, 500);

    // === STAGE 3: Run GOOD prompt ===
    const good_output = await callClaude(concept.good_prompt, undefined, 500);

    // === STAGE 4: Generate captions with hook ===
    const captionsRaw = await callClaude(
      `You write Instagram captions for @well.prompted, a page that teaches prompt engineering through before/after demos.

BEFORE/AFTER:
Bad prompt: "${concept.bad_prompt}"
Bad output (first 200 chars): "${bad_output.slice(0, 200)}"

Good prompt: "${concept.good_prompt}"  
Good output (first 200 chars): "${good_output.slice(0, 200)}"

What changed: ${concept.improvement_summary}
Hook angle for this post: "${contentItem?.hook}"

Write two captions:

caption_bad (for the "before" slide):
- First line = the hook. Make it punchy. This is what shows as preview text before someone taps.
- 2-3 sentences total. Explain WHY this prompt fails — what the AI has to guess, what's missing.
- End with something that makes people swipe to see the fix.

caption_good (for the "after" slide):
- First line = name what changed. Be specific.
- 2-3 sentences. Explain exactly what was added and why each change produced a better result.
- Teach the principle, not just the result.

Tone: Smart, direct, slightly edgy. Like a senior engineer who's seen it all. Zero corporate speak. Zero emoji.

Return JSON only:
{
  "caption_bad": "...",
  "caption_good": "..."
}`,
      undefined, 400
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
          text: `🆕 <b>New post ready for review</b>\n\n<b>Topic:</b> ${concept.topic}\n<b>Category:</b> ${category}\n\n<b>Bad:</b> "${concept.bad_prompt.slice(0, 80)}..."\n<b>Good:</b> "${concept.good_prompt.slice(0, 80)}..."\n\n<a href="https://well-prompted-pi.vercel.app/queue">Review in portal →</a>`,
        }),
      });
    }

    return NextResponse.json({ ...data, hook: contentItem?.hook });
  } catch (err: any) {
    console.error('Generate error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
