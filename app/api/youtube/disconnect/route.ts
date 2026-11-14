import { NextResponse } from 'next/server';
import { saveConnection } from '@/lib/connections';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Forgets the YouTube connection on this PC (the channel itself is not touched).
export async function POST() {
  saveConnection('youtube', undefined);
  return NextResponse.json({ ok: true });
}
