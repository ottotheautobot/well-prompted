import { NextRequest, NextResponse } from 'next/server';

const GATEWAY_URL   = process.env.GATEWAY_URL   || 'http://localhost:7823';
const GATEWAY_TOKEN = process.env.GATEWAY_TOKEN  || '';
const CRON_JOB_ID   = '18915557-b0f0-44f0-9d65-3e8ff1907657';

async function cronRequest(method: string, path: string, body?: object) {
  const res = await fetch(`${GATEWAY_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(GATEWAY_TOKEN ? { Authorization: `Bearer ${GATEWAY_TOKEN}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

export async function GET() {
  try {
    const data = await cronRequest('GET', `/api/cron/${CRON_JOB_ID}`);
    return NextResponse.json({ enabled: data?.enabled ?? null, job: data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { action } = await req.json();
  if (!['enable', 'disable'].includes(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }
  try {
    const data = await cronRequest('PATCH', `/api/cron/${CRON_JOB_ID}`, { enabled: action === 'enable' });
    return NextResponse.json({ success: true, enabled: data?.enabled });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
