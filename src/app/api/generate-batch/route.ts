import { NextRequest, NextResponse } from 'next/server';

// Fires off N sequential generate calls and returns a summary
// Runs sequentially to avoid hammering the Anthropic API
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const count = Math.min(body.count || 5, 20); // max 20 at a time
  const startIndex = body.start_index || 0;

  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'https://well-prompted-pi.vercel.app';

  const results = [];
  for (let i = 0; i < count; i++) {
    const matrixIndex = startIndex + i;
    try {
      const res = await fetch(`${baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matrix_index: matrixIndex }),
      });
      const data = await res.json();
      results.push({
        matrix_index: matrixIndex,
        success: res.ok,
        topic: data.bad_prompt?.slice(0, 50) || data.error,
        id: data.id,
      });
    } catch (e: any) {
      results.push({ matrix_index: matrixIndex, success: false, error: e.message });
    }
  }

  return NextResponse.json({ generated: results.length, results });
}
