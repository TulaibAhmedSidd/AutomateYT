import { NextResponse } from 'next/server';
import { deleteEpisode, getEpisode, getSeries, readEpisodeStatus, saveEpisode } from '@/lib/cartoon/store';
import { jsonError } from '@/lib/cartoon/http';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

// One episode with its series and render status.
export async function GET(_req: Request, context: Ctx) {
  try {
    const { id } = await context.params;
    const episode = getEpisode(id);
    if (!episode) return NextResponse.json({ error: 'Episode not found' }, { status: 404 });
    return NextResponse.json(
      { episode, series: getSeries(episode.seriesId), status: readEpisodeStatus(id) },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return jsonError(error);
  }
}

// Saves edits to the episode: { episode }.
export async function PUT(req: Request, context: Ctx) {
  try {
    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));
    return NextResponse.json({ episode: saveEpisode(id, body.episode) });
  } catch (error) {
    return jsonError(error);
  }
}

// Deletes the episode and everything in its folder.
export async function DELETE(_req: Request, context: Ctx) {
  try {
    const { id } = await context.params;
    deleteEpisode(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
