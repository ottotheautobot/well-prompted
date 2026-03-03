import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
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

// Mirror of PromptVideo.tsx timing logic — gives us target durations per page
function calcVideoTimings(wellPrompt: string, whyBreakdown: {title:string;description:string}[]) {
  const TYPING_START_SEC = 1.2;
  const typingSec        = Math.max(5, wellPrompt.length / 26);
  const typingEndSec     = TYPING_START_SEC + typingSec;
  const p1TotalSec       = typingEndSec + 5;           // typing + 5s hold

  const itemCount        = whyBreakdown.length;
  const whyAnimSec       = 0.3 + itemCount * 0.45;     // stagger animation
  const p2TotalSec       = whyAnimSec + 8;             // animation + hold

  // At speed 1.1, TTS runs at ~165 wpm = 2.75 words/sec
  const WPS = 2.75;

  // Section 1: fill from video start up to just before typing finishes
  // (narration hooks the viewer, plays while typing animates)
  const s1TargetSec   = Math.max(10, typingEndSec - 2);
  const s1TargetWords = Math.round(s1TargetSec * WPS);

  // Section 2: fill the why page (items animate + hold)
  const s2TargetSec   = Math.max(10, p2TotalSec - 1);
  const s2TargetWords = Math.round(s2TargetSec * WPS);

  return { p1TotalSec, p2TotalSec, s1TargetWords, s2TargetWords, typingEndSec };
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

  // Generate narration script
  const narrationRaw = await anthropic.messages.create({
    model: 'claude-haiku-4-5', max_tokens: 600,
    messages: [{
      role: 'user', content:
`Write a voiceover narration script timed to a specific Instagram Reel.

OKAY PROMPT: "${post.bad_prompt}"
WELL PROMPTED: "${post.good_prompt}"
WHY BREAKDOWN:
${whyBreakdown.map((w, i) => `${i + 1}. ${w.title} — ${w.description}`).join('\n')}

VIDEO TIMING:
- Page 1 runs for ${timings.p1TotalSec.toFixed(1)} seconds total. The well prompted version finishes typing at ~${timings.typingEndSec.toFixed(1)}s.
- Page 2 runs for ${timings.p2TotalSec.toFixed(1)} seconds. Why breakdown items appear one by one.

SECTION 1 — EXACTLY ${timings.s1TargetWords} words (narration plays while page 1 is on screen):
- Opens by calling out what's wrong with the okay prompt. One sentence, make it sting slightly.
- "Here's the upgrade." as a natural pivot.
- 1-2 sentences explaining what the well prompted version adds and why it works.
- Must be EXACTLY ${timings.s1TargetWords} words — count carefully. At 1.1x speed this fills ~${timings.typingEndSec.toFixed(0)} seconds.

SECTION 2 — EXACTLY ${timings.s2TargetWords} words (narration plays while page 2 is on screen):
- Opens with a natural bridge: "Here's why it works." or similar.
- Walk through each breakdown item in order. One punchy sentence per item.
- Must be EXACTLY ${timings.s2TargetWords} words — count carefully. At 1.1x speed this fills ~${timings.p2TotalSec.toFixed(0)} seconds.

Rules:
- Warm but direct. Smart colleague energy, not professor energy.
- No filler. No "in this video". No exclamation points.
- Natural rhythm — fragments are fine.

Return JSON only:
{"section1": "...", "section2": "..."}`
    }],
  });

  const raw = narrationRaw.content[0].type === 'text' ? narrationRaw.content[0].text : '';
  let narration = { section1: '', section2: '' };
  try {
    const s = raw.indexOf('{'), e = raw.lastIndexOf('}');
    narration = JSON.parse(raw.slice(s, e + 1));
  } catch { return NextResponse.json({ error: 'Failed to parse narration script' }, { status: 500 }); }

  const fullScript = [narration.section1, narration.section2].filter(Boolean).join(' ');

  // ElevenLabs TTS
  const ttsRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE}`, {
    method: 'POST',
    headers: { 'xi-api-key': ELEVENLABS_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: fullScript,
      model_id: 'eleven_turbo_v2_5',
      speed: SPEECH_SPEED,
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

  const music = pickMusic(id);
  const audioData = {
    url: `https://s3.us-east-2.amazonaws.com/${S3_BUCKET}/audio/${id}.mp3`,
    section1Sec: estimateSec(narration.section1),
    totalSec: estimateSec(fullScript),
    // Video timing targets — used by calcVideoDuration floor
    p1TotalSec: timings.p1TotalSec,
    p2TotalSec: timings.p2TotalSec,
    script: narration,
    musicUrl: music.url,
    musicStartSec: music.startFrom,
    musicName: music.name,
  };

  // Save to DB in caption_good
  await supabase.from('posts').update({ caption_good: JSON.stringify(audioData) }).eq('id', id);

  return NextResponse.json({ success: true, ...audioData });
}
