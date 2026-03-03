import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logFire } from '@/lib/logger';
import Anthropic from '@anthropic-ai/sdk';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const s3 = new S3Client({
  region: process.env.AWS_REGION || 'us-east-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const S3_BUCKET        = process.env.REMOTION_S3_BUCKET || 'remotionlambda-useast2-v6np42nzpq';
const ELEVENLABS_KEY   = process.env.ELEVENLABS_API_KEY!;
const ELEVENLABS_VOICE = process.env.ELEVENLABS_VOICE_ID || 'q0IMILNRPxOgtBTS4taI';
const SPEECH_SPEED     = 1.1;

const BASE_URL = `https://s3.us-east-2.amazonaws.com/${S3_BUCKET}`;

// Music library — all clips pre-trimmed by Allen, startFrom: 0
const MUSIC_LIBRARY = [
  { id: 'track-01', url: `${BASE_URL}/music/track-01.wav`, name: 'In the Gloom'          },
  { id: 'track-03', url: `${BASE_URL}/music/track-03.wav`, name: 'Off-White'              },
  { id: 'track-05', url: `${BASE_URL}/music/track-05.wav`, name: 'Strangers in Dub'      },
  { id: 'track-07', url: `${BASE_URL}/music/track-07.wav`, name: 'Butterfly'             },
  { id: 'track-08', url: `${BASE_URL}/music/track-08.wav`, name: 'Surrounded by Bubbles' },
].map(t => ({ ...t, startFrom: 0 }));

function pickMusic(postId: string) {
  // Deterministic pick based on post ID so rerenders get the same track
  const idx = postId.charCodeAt(0) % MUSIC_LIBRARY.length;
  return MUSIC_LIBRARY[idx];
} // slightly brisk — keeps energy up, fits in ~25-30s

// At speed 1.1, effective wpm ≈ 165
function estimateSec(text: string, speed = SPEECH_SPEED) {
  return (text.trim().split(/\s+/).length / (150 * speed)) * 60;
}

// Get actual duration from MP3 buffer — ElevenLabs outputs 128kbps CBR MP3
function mp3DurationSec(buf: Buffer): number {
  return buf.length / 16000; // 128kbps = 16000 bytes/sec
}

// Mirror of PromptVideo.tsx timing logic — returns full video duration
function calcVideoTimings(wellPrompt: string, whyBreakdown: {title:string;description:string}[]) {
  const FPS              = 30;
  const FADE_SEC         = Math.round(FPS * 0.45) / FPS;
  const TYPING_START_SEC = 1.2;
  const typingSec        = Math.max(5, wellPrompt.length / 26);
  const typingEndSec     = TYPING_START_SEC + typingSec;
  const p1TotalSec       = typingEndSec + 5;           // typing + 5s hold

  const itemCount        = whyBreakdown.length;
  const whyAnimSec       = 0.3 + itemCount * 0.45;
  const p2TotalSec       = whyAnimSec + 8;             // animation + 8s reading hold
  const p2StartSec       = p1TotalSec + FADE_SEC;

  const MIN_VIDEO_SEC = 30;
  const totalVideoDurationSec = Math.max(MIN_VIDEO_SEC, p2StartSec + p2TotalSec + FADE_SEC);

  // Calibrated from measurements: ~2.5 wps on average (varies by sentence style)
  // Target audio to fill the full video, minus a 2s grace buffer at the end
  const WPS = 2.5;
  // Narration targets 27s of speech for a 30s video — only 3s gap for logo outro
  const totalTargetWords = Math.round((totalVideoDurationSec - 3) * WPS);

  return { totalVideoDurationSec, totalTargetWords, p1TotalSec, p2StartSec, typingEndSec };
}

export async function POST(req: NextRequest) {
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: 'Missing post id' }, { status: 400 });

  const { data: post } = await supabase.from('posts').select('*').eq('id', id).single();
  if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 });

  let whyBreakdown: { title: string; description: string }[] = [];
  try { whyBreakdown = JSON.parse(post.good_output || '[]'); } catch {}

  // Calculate exact video timings so narration fits each page
  const timings = calcVideoTimings(post.good_prompt, whyBreakdown);

  // Rotating closers — deterministic by post ID so same post always gets same one
  const CLOSERS = [
    'Try it tonight.',
    'Save this one.',
    'Your turn.',
    'Go try it.',
    'Now you know.',
    'Use this next time.',
    'That is the upgrade.',
    'Worth saving this.',
    'Simple fix. Big difference.',
    'Start here.',
  ];
  const closer = CLOSERS[id.charCodeAt(0) % CLOSERS.length];

  // Generate one continuous narration script timed to the full video
  const narrationRaw = await anthropic.messages.create({
    model: 'claude-haiku-4-5', max_tokens: 600,
    messages: [{
      role: 'user', content:
`Write a voiceover narration for a ${timings.totalVideoDurationSec.toFixed(0)}-second Instagram Reel about prompt engineering.

OKAY PROMPT: "${post.bad_prompt}"
WELL PROMPTED: "${post.good_prompt}"
WHY BREAKDOWN:
${whyBreakdown.map((w, i) => `${i + 1}. ${w.title} — ${w.description}`).join('\n')}

VIDEO STRUCTURE:
- 0 to ${timings.p1TotalSec.toFixed(0)}s → Page 1: okay prompt shown, then well prompted version types in (finishes at ~${timings.typingEndSec.toFixed(0)}s)
- ${timings.p2StartSec.toFixed(0)}s onward → Page 2: why breakdown items appear one by one

The narration is ONE continuous script playing start to finish. It should naturally cover both pages — first explain the prompt upgrade, then walk the why breakdown. The transitions should feel like one flowing monologue, not two separate sections.

SCRIPT — EXACTLY ${timings.totalTargetWords} words total (targeting ~${timings.totalVideoDurationSec - 3} seconds of speech):
- Open with ONE sharp sentence calling out what's wrong with the okay prompt. Vary the opening style — do NOT always start with "You're..." or always frame it as an upgrade. Mix it up: sometimes call out the mistake directly, sometimes ask a rhetorical question, sometimes just state what the prompt is missing.
- Transition naturally into the better version — vary the pivot line too. Not always "Here's the upgrade." Try things like "This version is different.", "Watch what changes.", "Here's what actually works.", etc.
- Naturally pivot around the ${timings.p1TotalSec.toFixed(0)}s mark to the why breakdown — the viewer will see the why page at this point
- Walk the breakdown items in order, one punchy sentence each
- End with EXACTLY this closing line (word-for-word, do not paraphrase): "${closer}"

Rules:
- Warm but direct. Smart colleague, not professor.
- No "in this video", no exclamation points, no padding.
- Fragments are fine. Rhythm matters.
- Word count is critical. Write the script, then count every word, then trim or expand to hit EXACTLY ${timings.totalTargetWords} words before returning.
- Avoid "First," "Second," "Third," numbered starters, and em-dashes (—).
- Insert SSML break tags at natural pause moments — after the opening hook sentence, before/after "Here's the upgrade.", and before the pivot to the why breakdown. Use <break time="0.5s"/> for short beats and <break time="0.8s"/> for bigger transitions. Do not overuse — 3-4 breaks total max.
- Do NOT count SSML tags in the word count.

Return JSON only:
{"script": "...", "wordCount": <number>}`
    }],
  });

  const raw = narrationRaw.content[0].type === 'text' ? narrationRaw.content[0].text : '';
  let narration = { script: '' };
  try {
    const s = raw.indexOf('{'), e = raw.lastIndexOf('}');
    narration = JSON.parse(raw.slice(s, e + 1));
  } catch { return NextResponse.json({ error: 'Failed to parse narration script' }, { status: 500 }); }

  const fullScript = narration.script;

  // ElevenLabs TTS
  const ttsRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE}`, {
    method: 'POST',
    headers: { 'xi-api-key': ELEVENLABS_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: fullScript,
      model_id: 'eleven_turbo_v2_5',
      speed: SPEECH_SPEED,
      enable_ssml_parsing: true,
      voice_settings: { stability: 0.48, similarity_boost: 0.82, style: 0.12, use_speaker_boost: true },
    }),
  });
  if (!ttsRes.ok) {
    const err = await ttsRes.text();
    return NextResponse.json({ error: `ElevenLabs error: ${err}` }, { status: 500 });
  }

  const buf = Buffer.from(await ttsRes.arrayBuffer());

  // Upload to S3
  await s3.send(new PutObjectCommand({
    Bucket: S3_BUCKET, Key: `audio/${id}.mp3`,
    Body: buf, ContentType: 'audio/mpeg',
  }));

  const actualDurationSec = mp3DurationSec(buf);
  const music = pickMusic(id);
  const audioData = {
    url: `https://s3.us-east-2.amazonaws.com/${S3_BUCKET}/audio/${id}.mp3?v=${Date.now()}`,
    totalSec: actualDurationSec,  // actual duration from buffer, not word-count estimate
    totalVideoDurationSec: timings.totalVideoDurationSec,
    script: narration.script,
    musicUrl: music.url,
    musicStartSec: music.startFrom,
    musicName: music.name,
  };

  // Save to DB in caption_good
  await supabase.from('posts').update({ caption_good: JSON.stringify(audioData) }).eq('id', id);

  return NextResponse.json({ success: true, ...audioData });
}
