import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const ELEVENLABS_KEY    = process.env.ELEVENLABS_API_KEY!;
const ELEVENLABS_VOICE  = process.env.ELEVENLABS_VOICE_ID || '4tRn1lSkEn13EVTuqb0g';
const S3_BUCKET         = process.env.REMOTION_S3_BUCKET || 'remotionlambda-useast2-v6np42nzpq';

const s3 = new S3Client({
  region: process.env.AWS_REGION || 'us-east-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

// Estimate seconds from word count (150 wpm natural TTS pace)
function estimateSec(text: string): number {
  return (text.trim().split(/\s+/).length / 150) * 60;
}

async function generateAudio(postId: string, script: string): Promise<{ url: string; durationSec: number }> {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE}`, {
    method: 'POST',
    headers: { 'xi-api-key': ELEVENLABS_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: script,
      model_id: 'eleven_turbo_v2_5',
      voice_settings: { stability: 0.45, similarity_boost: 0.82, style: 0.15, use_speaker_boost: true },
    }),
  });
  if (!res.ok) throw new Error(`ElevenLabs error: ${res.status} ${await res.text()}`);
  const buf = Buffer.from(await res.arrayBuffer());

  const key = `audio/${postId}.mp3`;
  await s3.send(new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    Body: buf,
    ContentType: 'audio/mpeg',
  }));

  const url = `https://s3.us-east-2.amazonaws.com/${S3_BUCKET}/${key}`;
  const durationSec = estimateSec(script);
  return { url, durationSec };
}

async function callClaude(prompt: string, maxTokens = 800): Promise<string> {
  const msg = await client.messages.create({
    model: 'claude-haiku-4-5', max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }],
  });
  return msg.content[0].type === 'text' ? msg.content[0].text.trim() : '';
}

function parseJSON(raw: string) {
  const s = raw.indexOf('{'), e = raw.lastIndexOf('}');
  return JSON.parse(raw.slice(s, e + 1));
}

// ── CONTENT MATRIX ──
// Each entry: id, category, situation, emotional_hook, technique, okay_prompt
// "okay_prompt" is how a real person types it at 11pm — no formatting, no context, vague

const CONTENT_MATRIX = [
  // ── CAREER ──
  {
    id: 'C1', category: 'career',
    situation: 'Got passed over for a promotion and needs to ask why without burning the relationship',
    emotional_hook: 'Injustice, anxiety about damaging the relationship',
    technique: 'Tone calibration + goal framing',
    okay_prompt: "Write me an email to my boss asking why I didn't get the promotion.",
    tags: ['#careertips', '#workadvice', '#promotion', '#careeradvice'],
  },
  {
    id: 'C2', category: 'career',
    situation: 'Asking for a raise when you have performance data but don\'t know how to frame it',
    emotional_hook: 'Fear of rejection, not knowing how to present without seeming greedy',
    technique: 'Business case framing + constraint + specificity',
    okay_prompt: "Write me an email asking my boss for a raise. I've been here 2 years and I work really hard.",
    tags: ['#careertips', '#salary', '#raise', '#workadvice'],
  },
  {
    id: 'C3', category: 'career',
    situation: 'Performance review self-assessment due and starting from scratch',
    emotional_hook: 'Dread, procrastination, not knowing how to make wins sound impressive',
    technique: 'Structure + role + outcome framing',
    okay_prompt: "Help me write my performance review self-assessment. I don't know where to start.",
    tags: ['#performancereview', '#careertips', '#workadvice', '#selfassessment'],
  },
  {
    id: 'C4', category: 'career',
    situation: 'Need to tell your boss you\'re overwhelmed without looking incompetent',
    emotional_hook: 'Fear of being seen as weak or unable to handle the job',
    technique: 'Audience awareness + tone + proposed solution framing',
    okay_prompt: "Write an email telling my boss I have too much work and I'm overwhelmed.",
    tags: ['#worklifebalance', '#careertips', '#workadvice', '#burnout'],
  },
  {
    id: 'C5', category: 'career',
    situation: 'Received a job offer and needs to negotiate salary without killing the offer',
    emotional_hook: 'Scarcity fear — afraid asking will cause them to rescind',
    technique: 'Persona + leverage framing + constraint',
    okay_prompt: "Write a response to a job offer where I want to negotiate the salary.",
    tags: ['#salarynegotiation', '#jobsearch', '#careertips', '#joboffer'],
  },
  // ── JOB SEARCH ──
  {
    id: 'J1', category: 'job_search',
    situation: 'Applying for a role they\'re slightly underqualified for and need to address the gap',
    emotional_hook: 'Impostor syndrome, fear of being rejected on paper',
    technique: 'Reframe + context + positioning',
    okay_prompt: "Write me a cover letter for a product manager job. I don't have all the requirements.",
    tags: ['#coverletter', '#jobsearch', '#jobhunting', '#careertips'],
  },
  {
    id: 'J2', category: 'job_search',
    situation: 'Cold messaging someone at a target company — a complete stranger — for a job',
    emotional_hook: 'Fear of rejection, not knowing what to say to a stranger',
    technique: 'Hook + specificity + clear ask + length constraint',
    okay_prompt: "Write a LinkedIn message to someone at a company I want to work at asking about job opportunities.",
    tags: ['#linkedin', '#jobsearch', '#networking', '#jobhunting'],
  },
  {
    id: 'J3', category: 'job_search',
    situation: 'Following up after a job interview without seeming desperate',
    emotional_hook: 'Desperation vs. professionalism tension',
    technique: 'Tone constraint + brevity + value add',
    okay_prompt: "Write a follow up email after my job interview. I want to remind them I'm interested.",
    tags: ['#jobsearch', '#interview', '#jobhunting', '#careertips'],
  },
  {
    id: 'J4', category: 'job_search',
    situation: 'Writing a LinkedIn post to position themselves as an expert without sounding cringe',
    emotional_hook: 'Embarrassment about self-promotion',
    technique: 'Voice + specificity + format + anti-cringe constraint',
    okay_prompt: "Write me a LinkedIn post about my experience in sales that makes me look like an expert.",
    tags: ['#linkedin', '#personalbrand', '#thoughtleadership', '#careertips'],
  },
  {
    id: 'J5', category: 'job_search',
    situation: 'Got rejected from a job and wants to ask for feedback in a way that gets a real response',
    emotional_hook: 'Defeat, not wanting to seem bitter',
    technique: 'Framing + brevity + genuine curiosity tone',
    okay_prompt: "Write an email asking for feedback after I got rejected from a job application.",
    tags: ['#jobsearch', '#jobhunting', '#rejection', '#careertips'],
  },
  // ── COMMUNICATION ──
  {
    id: 'K1', category: 'communication',
    situation: 'Need to push back on a manager\'s decision without being seen as difficult',
    emotional_hook: 'Power dynamic fear, career risk',
    technique: 'Framing + evidence + collaborative tone',
    okay_prompt: "Write an email disagreeing with my manager's decision about our project timeline.",
    tags: ['#workadvice', '#communication', '#leadership', '#careertips'],
  },
  {
    id: 'K2', category: 'communication',
    situation: 'Messed up a client deliverable and needs to send an apology that keeps the relationship',
    emotional_hook: 'Shame, urgency, fear of losing the client',
    technique: 'Specificity + accountability + next steps',
    okay_prompt: "Write an apology email to a client because I missed a deadline on their project.",
    tags: ['#clientmanagement', '#communication', '#businessadvice', '#workadvice'],
  },
  {
    id: 'K3', category: 'communication',
    situation: 'A colleague\'s work keeps missing the mark and you need to say something',
    emotional_hook: 'Conflict avoidance, fear of damaging the relationship',
    technique: 'Specific behavior + impact + curious tone',
    okay_prompt: "Write a message to a coworker telling them their work quality has been bad lately.",
    tags: ['#workadvice', '#communication', '#management', '#leadership'],
  },
  {
    id: 'K4', category: 'communication',
    situation: 'Need to say no to a request from someone senior without damaging the relationship',
    emotional_hook: 'People-pleasing, fear of seeming unhelpful',
    technique: 'Constraint + alternative offer + tone',
    okay_prompt: "Write an email saying no to a request from my director because I'm too busy.",
    tags: ['#workadvice', '#boundaries', '#communication', '#careertips'],
  },
  {
    id: 'K5', category: 'communication',
    situation: 'An unreasonable client is pushing beyond scope and you need to set a boundary',
    emotional_hook: 'Resentment, fear of losing the client if you push back',
    technique: 'Role + situation + firm-but-professional tone',
    okay_prompt: "Write a message to a client who keeps asking for more than what we agreed on.",
    tags: ['#clientmanagement', '#freelance', '#boundaries', '#businessadvice'],
  },
  // ── WRITING ──
  {
    id: 'W1', category: 'writing',
    situation: 'Writing a blog post intro that makes people actually keep reading',
    emotional_hook: 'Content anxiety — putting in effort nobody reads',
    technique: 'Hook framework + structure + audience',
    okay_prompt: "Write an intro for my blog post about remote work productivity tips.",
    tags: ['#contentwriting', '#blogging', '#writing', '#contentcreator'],
  },
  {
    id: 'W2', category: 'writing',
    situation: 'Need to repurpose one long article into multiple LinkedIn posts',
    emotional_hook: 'Time pressure, content output anxiety',
    technique: 'Task scoping + format + angle variation',
    okay_prompt: "Turn this blog post into LinkedIn posts for me.",
    tags: ['#contentrepurposing', '#linkedin', '#contentcreation', '#contentcreator'],
  },
  {
    id: 'W3', category: 'writing',
    situation: 'Email newsletter subject lines that people actually open',
    emotional_hook: 'Low open rates, feeling ignored',
    technique: 'Audience definition + curiosity gap + constraint',
    okay_prompt: "Write subject lines for my email newsletter about marketing tips.",
    tags: ['#emailmarketing', '#newsletter', '#copywriting', '#marketingtips'],
  },
  // ── THINKING ──
  {
    id: 'T1', category: 'thinking',
    situation: 'Stuck in decision paralysis on a major choice — going in circles',
    emotional_hook: 'Anxiety, exhaustion from overthinking',
    technique: 'Structured decision framework prompt',
    okay_prompt: "Help me decide whether I should quit my job and go freelance.",
    tags: ['#decisionmaking', '#productivity', '#mindset', '#aitools'],
  },
  {
    id: 'T3', category: 'thinking',
    situation: 'Have a business idea and want to pressure-test it before spending money',
    emotional_hook: 'Excitement mixed with fear of wasting money',
    technique: 'Devil\'s advocate + structured critique prompt',
    okay_prompt: "Tell me if my business idea is good. I want to start a meal prep delivery service.",
    tags: ['#entrepreneur', '#startup', '#businessadvice', '#aitools'],
  },
];

// Hashtag base set (always included)
const BASE_TAGS = '#promptengineering #chatgpt #aitools #productivity #prompttips #artificialintelligence #chatgptprompts #aiwriting #promptcraft';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  // Pick content item
  let item;
  if (body.matrix_id) {
    item = CONTENT_MATRIX.find(c => c.id === body.matrix_id);
  } else if (body.matrix_index !== undefined) {
    item = CONTENT_MATRIX[body.matrix_index % CONTENT_MATRIX.length];
  } else if (body.category) {
    const filtered = CONTENT_MATRIX.filter(c => c.category === body.category);
    item = filtered[Math.floor(Math.random() * filtered.length)];
  } else {
    item = CONTENT_MATRIX[Math.floor(Math.random() * CONTENT_MATRIX.length)];
  }

  if (!item) return NextResponse.json({ error: 'No matching content item' }, { status: 400 });

  try {
    // === STAGE 1: Generate well-prompted version ===
    const wellPromptRaw = await callClaude(
      `You are a prompt engineering expert creating educational content for @well.prompted on Instagram.

SCENARIO: ${item.situation}
EMOTIONAL HOOK: ${item.emotional_hook}
TECHNIQUE TO DEMONSTRATE: ${item.technique}

OKAY PROMPT (how a real person types it at 11pm, half-asleep):
"${item.okay_prompt}"

Write the "well prompted" version. Rules:
- Add ONLY 3-5 targeted improvements — not a laundry list
- Each addition must have an obvious reason it matters
- Must feel achievable by a non-technical person
- Use realistic placeholder values like [Manager's name], [15%], [specific achievement]
- First person voice, same task — just much more specific
- Do NOT use markdown, headers, or bullet points in the prompt itself — it's a prompt, not a document

Return ONLY the prompt text, nothing else.`, 400);

    // === STAGE 2: Generate "why this works" breakdown ===
    const whyRaw = await callClaude(
      `You're explaining to a smart person why one prompt works better than another. Sound like a real person — direct, a little sharp, no corporate jargon.

OKAY PROMPT: "${item.okay_prompt}"
WELL PROMPTED: "${wellPromptRaw}"
TECHNIQUE: ${item.technique}

Write 4-5 breakdown items. Each needs:
- TITLE: 4-7 words, plain English, active voice. Sounds like something you'd actually say out loud. NOT "Leverages Contextual Specificity" — YES "Naming the person changes everything"
- DESCRIPTION: 1 sentence max. Explain the actual mechanism — why does this specific change make the AI respond better? Be concrete, no filler.

Avoid: nominalizations, passive voice, buzzwords like leverages / facilitates / enables / anchors / reframes / optimizes
Write like you're explaining it to a colleague over lunch, not in a performance review.

Return JSON only:
[{"title":"...","description":"..."},...]`, 500);

    const whyBreakdown = JSON.parse(whyRaw.slice(whyRaw.indexOf('['), whyRaw.lastIndexOf(']') + 1));

    // === STAGE 3: Generate narration script ===
    const narrationRaw = await callClaude(
      `Write a voiceover narration script for a 30-second Instagram Reel about prompt engineering.

SCENARIO: ${item.situation}
OKAY PROMPT: "${item.okay_prompt}"
WELL PROMPTED: "${wellPromptRaw}"
WHY BREAKDOWN: ${whyBreakdown.map((w: {title:string;description:string}, i: number) => `${i+1}. ${w.title} — ${w.description}`).join('\n')}

The video has two pages:
- Page 1: Okay prompt shown, then well prompted version types in (~10-12 seconds)
- Page 2: "Why this works" breakdown appears item by item (~15-18 seconds)

Write TWO sections of narration:

SECTION 1 (35-45 words, plays over page 1):
- One sentence calling out what's wrong with the okay prompt. Make it sting slightly.
- "Here's the upgrade." as a natural pivot.
- 1-2 sentences explaining what the well prompted version does differently — what it adds and why that matters. Don't read it verbatim.

SECTION 2 (50-65 words, plays over page 2):
- Natural bridge into the why — something like "Here's why it works." or "Let's break it down."
- One sentence per breakdown item, in order. Conversational, punchy. Talk like a smart person explaining to a friend, not a professor.

Rules:
- No filler. No "in this video". No "make sure to follow". No exclamation energy.
- Warm but direct. Like a smart colleague walking you through something useful.
- Natural speech rhythm — use sentence fragments where they sound right.

Return JSON only:
{"section1": "...", "section2": "..."}`, 600);

    let narration = { section1: '', section2: '' };
    try {
      const s = narrationRaw.indexOf('{'), e = narrationRaw.lastIndexOf('}');
      narration = JSON.parse(narrationRaw.slice(s, e + 1));
    } catch { /* narration optional, don't fail the whole post */ }

    const fullScript = [narration.section1, narration.section2].filter(Boolean).join(' ');
    const section1Sec = estimateSec(narration.section1);
    const totalSec    = estimateSec(fullScript);

    // === STAGE 4: Generate caption ===
    const captionRaw = await callClaude(
      `Write an Instagram caption for a prompt engineering before/after post.

SCENARIO: ${item.situation}
OKAY PROMPT: "${item.okay_prompt}"
TECHNIQUE: ${item.technique}
CATEGORY TAGS: ${item.tags.join(' ')}

Caption formula (follow exactly):
Line 1: Hook — 5-8 words, calls out the mistake directly. Make it sting a little.
Lines 2-3: 1-2 short punchy sentences on WHY the vague prompt fails. Be specific.
Line 4: "Swipe for the prompt upgrade →"
Line 5: Technique in caps + em dash + one line on what it does
Blank line
"—"
"Follow @well.prompted for daily prompt upgrades."
"Save this. You'll use it."
Blank line
Hashtags: ${BASE_TAGS} ${item.tags.join(' ')}

Rules:
- No emojis. No exclamation marks. No "Hey!" No corporate speak.
- Write like a smart person texting a colleague, not a brand.
- The hook should feel slightly uncomfortable — like someone calling out a mistake you make.

Return ONLY the caption text, nothing else.`, 600);

    // === STAGE 5: Save to DB ===
    const { data: post, error } = await supabase.from('posts').insert({
      status: 'pending_review',
      format: 'before_after',
      category: item.category,
      techniques: [item.technique],
      bad_prompt: item.okay_prompt,
      good_prompt: wellPromptRaw,
      good_output: JSON.stringify(whyBreakdown),
      bad_output: '',
      caption_bad: captionRaw,
      caption_good: '',
      render_status: 'pending',
    }).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // === STAGE 6: Kick off audio generation async (separate endpoint, avoids timeout) ===
    const audioData = null;
    const base = process.env.NEXT_PUBLIC_APP_URL || 'https://well-prompted-pi.vercel.app';
    fetch(`${base}/api/generate-audio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.PORTAL_PASSWORD}` },
      body: JSON.stringify({ id: post.id }),
    }).catch(() => {}); // fire and forget

    // Telegram notification
    if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
      await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: process.env.TELEGRAM_CHAT_ID, parse_mode: 'HTML',
          text: `🆕 <b>New post ready for review</b> [${item.id}]\n\n<i>"${item.okay_prompt}"</i>\n\n<a href="https://well-prompted-pi.vercel.app/queue">Review in portal →</a>`,
        }),
      });
    }

    return NextResponse.json({ ...post, okay_prompt: item.okay_prompt, well_prompt: wellPromptRaw, why_breakdown: whyBreakdown, audio: audioData });

  } catch (err: any) {
    console.error('Generate error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
