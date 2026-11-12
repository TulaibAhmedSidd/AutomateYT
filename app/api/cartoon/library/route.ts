import { NextResponse } from 'next/server';
import { listEpisodes, listSeries, readLibrary } from '@/lib/cartoon/store';
import { jsonError, refuseOnVercel } from '@/lib/cartoon/http';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Every series with its progress: episodes planned, scripts written, fully recorded and rendered.
// Library series (content/cartoon) come first, grouped; series made in the app come after as "my series".
export async function GET() {
  const refused = refuseOnVercel();
  if (refused) return refused;
  try {
    const all = listSeries();
    const episodes = listEpisodes();
    const library = readLibrary();
    const rows = all.map((s) => {
      const lib = library.find((l) => l.series.id === s.id);
      const eps = episodes.filter((e) => e.seriesId === s.id);
      return {
        id: s.id,
        name: s.name,
        language: s.language,
        audience: s.audience,
        group: lib?.group || 'mine',
        why: lib?.why || '',
        characters: s.characters.map((c) => ({ name: c.name, reference: c.reference })),
        planned: Math.max(lib?.topics.length || 0, eps.length),
        written: eps.length,
        recorded: eps.filter((e) => e.shots > 0 && e.recorded === e.shots).length,
        rendered: eps.filter((e) => e.status.stage === 'done').length,
      };
    });
    return NextResponse.json({ series: rows }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return jsonError(error);
  }
}
