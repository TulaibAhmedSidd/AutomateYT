import { NextResponse } from 'next/server';
import { getSeries, libraryEpisodeId, listEpisodes, readLibrary } from '@/lib/cartoon/store';
import { jsonError } from '@/lib/cartoon/http';
import { readLog } from '@/lib/youtube-publish';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// One series with every episode slot: planned ideas from the library (script written or not) plus episodes made in the app.
export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const series = getSeries(id);
    if (!series) return NextResponse.json({ error: 'Series not found' }, { status: 404 });
    const lib = readLibrary().find((l) => l.series.id === id);
    const episodes = listEpisodes().filter((e) => e.seriesId === id);
    const byId = new Map(episodes.map((e) => [e.id, e]));
    const log = readLog();
    const postOf = (epId?: string) => (epId ? log.find((e) => e.key === `cartoon:${epId}`) || null : null);

    const slots = (lib?.topics || []).map((topic, i) => {
      const ep = byId.get(libraryEpisodeId(id, i + 1)) || null;
      if (ep) byId.delete(ep.id);
      return { number: i + 1, topic, episode: ep, post: postOf(ep?.id) };
    });
    // Episodes the owner made in the app (not from the library) come after, newest first.
    const extra = [...byId.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const start = slots.length;
    extra.forEach((ep, i) => slots.push({ number: start + i + 1, topic: '', episode: ep, post: postOf(ep.id) }));

    return NextResponse.json(
      { series, group: lib?.group || 'mine', why: lib?.why || '', model: lib?.model || 'gpt-6.1-sol', slots },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return jsonError(error);
  }
}
