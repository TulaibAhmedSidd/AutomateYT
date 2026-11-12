import { NextResponse } from 'next/server';
import { createEpisode, listEpisodes } from '@/lib/cartoon/store';
import { jsonError, refuseOnVercel } from '@/lib/cartoon/http';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Lists episodes, newest first, with recording counts and render status.
export async function GET() {
  const refused = refuseOnVercel();
  if (refused) return refused;
  try {
    return NextResponse.json({ episodes: listEpisodes() });
  } catch (error) {
    return jsonError(error);
  }
}

// Creates an episode from a draft: { seriesId, episode }.
export async function POST(req: Request) {
  const refused = refuseOnVercel();
  if (refused) return refused;
  try {
    const body = await req.json().catch(() => ({}));
    return NextResponse.json({ episode: createEpisode(String(body.seriesId || ''), body.episode) });
  } catch (error) {
    return jsonError(error);
  }
}
