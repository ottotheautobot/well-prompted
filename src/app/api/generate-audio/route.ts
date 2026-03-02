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
  { id: 'track-01', url: `${BASE_URL}/music/track-01.wav`, name: 'In the Gloom'         },
  { id: 'track-02', url: `${BASE_URL}/music/track-02.mp3`, name: 'Noble Criminal'        },
  { id: 'track-03', url: `${BASE_URL}/music/track-03.wav`, name: 'Off-White'             },
  { id: 'track-04', url: `${BASE_URL}/music/track-04.mp3`, name: 'Paraleloz'             },
  { id: 'track-05', url: `${BASE_URL}/music/track-05.wav`, name: 'Strangers in Dub'     },
  { id: 'track-06', url: `${BASE_URL}/music/track-06.mp3`, name: 'Weekend Instrumental' },
  { id: 'track-07', url: `${BASE_URL}/music/track-07.wav`, name: 'Butterfly'            },
  { id: 'track-08', url: `${BASE_URL}/music/track-08.wav`, name: 'Surrounded by Bubbles'},
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

export async function POST(req: NextRequest) {
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: 'Missing post id' }, { status: 400 });

  const { data: post } = await supabase.from('posts').select('*').eq('id', id).single();
  if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 });

  let whyBreakdown: { title: string; description: string }[] = [];
  try { whyBreakdown = JSON.parse(post.good_output || '[]'); } catch {}

  // Generate narration script
  const narrationRaw = await anthropic.messages.create({
    model: 'claude-haiku-4-5', max_tokens: 600,
    messages: [{
      role: 'user', content:
`Write a voiceover narration script for a 30-second Instagram Reel about prompt engineering.

OKAY PROMPT: "${post.bad_prompt}"
WELL PROMPTED: "${post.good_prompt}"
WHY BREAKDOWN:
${whyBreakdown.map((w, i) => `${i + 1}. ${w.title} — ${w.description}`).join('\n')}

The video has two pages:
- Page 1: Okay prompt shown, then well prompted version types in (~10-12 seconds)
- Page 2: "Why this works" breakdown appears item by item (~15-18 seconds)

SECTION 1 (30-38 words MAX, plays over page 1):
- One sentence calling out what's wrong with the okay prompt. Make it sting slightly.
- "Here's the upgrade." as a natural pivot.
- 1 sentence on what the well prompted version does differently — what it adds and why.

SECTION 2 (40-52 words MAX, plays over page 2):
- Natural bridge: "Here's why it works." or similar.
- One short sentence per breakdown item. Punchy. No padding.

Rules:
- Warm but direct. Like a smart colleague explaining something useful.
- No filler. No "in this video". No "make sure to follow".
- Natural speech rhythm — fragments are fine.

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
    script: narration,
    musicUrl: music.url,
    musicStartSec: music.startFrom,
    musicName: music.name,
  };

  // Save to DB in caption_good
  await supabase.from('posts').update({ caption_good: JSON.stringify(audioData) }).eq('id', id);

  return NextResponse.json({ success: true, ...audioData });
}
