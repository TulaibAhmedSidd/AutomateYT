import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import { getSeries, libraryEpisodeId, listEpisodes, readLibrary } from '@/lib/cartoon/store';
import { jsonError } from '@/lib/cartoon/http';
import { SCRIPT_MODELS } from '@/lib/llm-json';
import { writeEpisode } from '@/lib/cartoon/writer';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Writes the script of one planned library episode: { number, model }. Saved to content/cartoon/episodes/<id>/<NN>.json
// (so it goes to GitHub and the other PC), then imported into the studio. Costs AI credit: only on the owner's click.
export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const series = getSeries(id);
    const lib = readLibrary().find((l) => l.series.id === id);
    if (!series || !lib) return NextResponse.json({ error: 'This series has no planned episodes.' }, { status: 404 });
    const body = await req.json().catch(() => ({}));
    const n = Number(body.number);
    if (!Number.isInteger(n) || n < 1 || n > lib.topics.length) return NextResponse.json({ error: 'Bad episode number.' }, { status: 400 });
    const out = path.join(process.cwd(), 'content', 'cartoon', 'episodes', id, `${String(n).padStart(2, '0')}.json`);
    if (fs.existsSync(out)) return NextResponse.json({ error: 'This episode already has a script.' }, { status: 400 });
    const model = SCRIPT_MODELS.includes(body.model) ? String(body.model) : lib.model;
    const episode = await writeEpisode(series, lib.topics[n - 1], model);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify({ number: n, topic: lib.topics[n - 1], model, writtenAt: new Date().toISOString(), episode }, null, 2) + '\n');
    listEpisodes(); // imports the new script into the studio
    return NextResponse.json({ id: libraryEpisodeId(id, n) });
  } catch (error) {
    return jsonError(error);
  }
}
