import { NextResponse } from 'next/server';
import { getSeries } from '@/lib/cartoon/store';
import { jsonError } from '@/lib/cartoon/http';
import { SCRIPT_MODELS } from '@/lib/llm-json';
import { writeEpisode } from '@/lib/cartoon/writer';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Writes a new episode for a series from a topic: { seriesId, topic, model }. Returns a draft (not saved).
// Costs AI credit (about 1.7 cents per episode with gpt-6.1-sol).
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const series = getSeries(String(body.seriesId || ''));
    if (!series) return NextResponse.json({ error: 'Pick a series first.' }, { status: 400 });
    const topic = typeof body.topic === 'string' ? body.topic.trim().slice(0, 600) : '';
    if (!topic) return NextResponse.json({ error: 'Write what the episode is about first.' }, { status: 400 });
    const model = SCRIPT_MODELS.includes(body.model) ? String(body.model) : 'gpt-6.1-sol';
    return NextResponse.json({ episode: await writeEpisode(series, topic, model) });
  } catch (error) {
    return jsonError(error);
  }
}
