import { NextResponse } from 'next/server';
import { clientKeys, redirectUrl } from '@/lib/youtube-connect';
import { readConnections } from '@/lib/connections';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// YouTube connection state for the Connections page. Never returns tokens.
export async function GET(req: Request) {
  const keys = await clientKeys();
  const yt = readConnections().youtube;
  return NextResponse.json(
    {
      configured: Boolean(keys.id && keys.secret),
      connected: Boolean(yt),
      channelTitle: yt?.channelTitle || null,
      channelId: yt?.channelId || null,
      connectedAt: yt?.connectedAt || null,
      redirectUrl: redirectUrl(new URL(req.url).origin),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
