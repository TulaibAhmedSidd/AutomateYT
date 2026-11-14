import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import { CARTOON_DIR, getEpisode, getSeries } from '@/lib/cartoon/store';
import { jsonError, refuseOnVercel } from '@/lib/cartoon/http';
import { uploadToYoutube } from '@/lib/youtube-connect';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

function uploadFile(id: string) {
  if (!/^[\w-]{3,64}$/.test(id)) throw new Error('Bad episode id');
  return path.join(CARTOON_DIR, 'episodes', id, 'youtube.json');
}

// Was this episode uploaded? { upload: { id, url, at, privacy } | null }
export async function GET(_req: Request, context: Ctx) {
  try {
    const { id } = await context.params;
    const f = uploadFile(id);
    return NextResponse.json({ upload: fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null });
  } catch (error) {
    return jsonError(error);
  }
}

// Uploads the finished video to the connected YouTube channel: { title, description, tags, privacy }.
export async function POST(req: Request, context: Ctx) {
  const refused = refuseOnVercel();
  if (refused) return refused;
  try {
    const { id } = await context.params;
    const ep = getEpisode(id);
    if (!ep) return NextResponse.json({ error: 'Episode not found' }, { status: 404 });
    const video = path.join(CARTOON_DIR, 'episodes', id, 'video.mp4');
    if (!fs.existsSync(video)) return NextResponse.json({ error: 'Make the video first (Step 3).' }, { status: 400 });
    const series = getSeries(ep.seriesId);
    const body = await req.json().catch(() => ({}));
    const privacy = body.privacy === 'public' || body.privacy === 'unlisted' ? body.privacy : 'private';
    const result = await uploadToYoutube(new URL(req.url).origin, video, {
      title: String(body.title || ep.title),
      description: String(body.description ?? ep.description ?? ''),
      tags: Array.isArray(body.tags) ? body.tags.map(String) : ep.tags || [],
      madeForKids: series?.madeForKids === true,
      privacy,
    });
    const record = { ...result, privacy, at: new Date().toISOString() };
    fs.writeFileSync(uploadFile(id), JSON.stringify(record, null, 2));
    return NextResponse.json({ upload: record });
  } catch (error) {
    return jsonError(error);
  }
}
