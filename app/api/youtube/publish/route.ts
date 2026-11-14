import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import { CARTOON_DIR, getEpisode } from '@/lib/cartoon/store';
import { isJobId, jobDir, readSpec } from '@/lib/motion/jobs';
import { readConnections } from '@/lib/connections';
import { uploadToYoutube } from '@/lib/youtube-connect';
import { addEntry, findEntry, nextSlots, readLog, readPlan, removeEntry, savePlan, type PublishEntry } from '@/lib/youtube-publish';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Target = { kind: 'motion'; jobId: string } | { kind: 'cartoon'; episodeId: string };

/** The MP4 and the log key of a finished video. A series episode keeps its key across re-renders. */
function resolve(target: Target): { file: string; key: string; language?: string } {
  if (target?.kind === 'motion') {
    if (!isJobId(target.jobId)) throw new Error('Bad video id');
    const spec = readSpec(target.jobId);
    if (!spec) throw new Error('Video not found');
    const key = spec.series && spec.episode ? `motion:${spec.series}#${spec.episode}` : `motion-job:${target.jobId}`;
    return { file: path.join(jobDir(target.jobId), 'video.mp4'), key, language: spec.language };
  }
  if (target?.kind === 'cartoon') {
    if (!/^[\w-]{3,64}$/.test(target.episodeId) || !getEpisode(target.episodeId)) throw new Error('Episode not found');
    return { file: path.join(CARTOON_DIR, 'episodes', target.episodeId, 'video.mp4'), key: `cartoon:${target.episodeId}` };
  }
  throw new Error('Unknown video');
}

function state(key?: string) {
  const yt = readConnections().youtube;
  return {
    entry: key ? findEntry(key) : null,
    nextSlots: nextSlots(3),
    plan: readPlan(),
    connected: Boolean(yt),
    channelTitle: yt?.channelTitle || null,
    posted: readLog().length,
  };
}

// GET ?key=… → is this video posted, the next free posting times, the plan and the channel. Without key: all posts.
// GET ?kind=motion&id=<jobId> works too (the server works out the key).
export async function GET(req: Request) {
  try {
    const q = new URL(req.url).searchParams;
    let key = q.get('key') || undefined;
    if (!key && q.get('kind') && q.get('id')) {
      key = resolve(q.get('kind') === 'motion' ? { kind: 'motion', jobId: q.get('id')! } : { kind: 'cartoon', episodeId: q.get('id')! }).key;
    }
    return NextResponse.json({ ...state(key), key: key || null, entries: key ? undefined : readLog() }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}

// POST actions:
//  { action: 'upload', target, title, description, tags, madeForKids, when: 'schedule'|'public'|'unlisted'|'private', publishAt?, categoryId? }
//  { action: 'manual', target, title, publishAt?, url? }   → the owner uploaded in YouTube Studio; record it
//  { action: 'plan', times?, audited? }                     → change the posting plan
export async function POST(req: Request) {
  if (process.env.VERCEL) return NextResponse.json({ error: 'Videos live on your own PC. Run the app locally.' }, { status: 400 });
  try {
    const body = await req.json().catch(() => ({}));
    if (body.action === 'plan') {
      savePlan({
        ...(Array.isArray(body.times) ? { times: body.times.map(String) } : {}),
        ...(typeof body.audited === 'boolean' ? { audited: body.audited } : {}),
      });
      return NextResponse.json(state());
    }

    const { file, key, language } = resolve(body.target as Target);
    const title = String(body.title || '').trim().slice(0, 100);
    if (!title) return NextResponse.json({ error: 'Write a title first.' }, { status: 400 });
    const publishAt = typeof body.publishAt === 'string' && !Number.isNaN(Date.parse(body.publishAt)) ? new Date(body.publishAt).toISOString() : undefined;

    if (body.action === 'manual') {
      const url = typeof body.url === 'string' && /^https:\/\/(www\.)?(youtube\.com|youtu\.be)\//.test(body.url.trim()) ? body.url.trim() : undefined;
      const entry: PublishEntry = {
        key,
        title,
        method: 'manual',
        privacy: publishAt && Date.parse(publishAt) > Date.now() ? 'scheduled' : 'public',
        publishAt: publishAt || new Date().toISOString(),
        url,
        at: new Date().toISOString(),
      };
      addEntry(entry);
      return NextResponse.json(state(key));
    }

    if (body.action === 'upload') {
      if (!fs.existsSync(file)) return NextResponse.json({ error: 'Make the video first.' }, { status: 400 });
      const when = ['schedule', 'public', 'unlisted', 'private'].includes(body.when) ? body.when : 'private';
      if (when === 'schedule' && (!publishAt || Date.parse(publishAt) < Date.now() + 15 * 60_000)) {
        return NextResponse.json({ error: 'Pick a time at least 15 minutes from now.' }, { status: 400 });
      }
      const tags = Array.isArray(body.tags) ? body.tags.map(String).filter(Boolean) : [];
      const result = await uploadToYoutube(new URL(req.url).origin, file, {
        title,
        description: String(body.description || ''),
        tags,
        madeForKids: body.madeForKids === true,
        privacy: when === 'schedule' ? 'private' : when,
        publishAt: when === 'schedule' ? publishAt : undefined,
        categoryId: ['24', '27', '22'].includes(body.categoryId) ? body.categoryId : '24',
        language,
      });
      addEntry({
        key,
        title,
        method: 'api',
        privacy: when === 'schedule' ? 'scheduled' : when,
        publishAt: when === 'schedule' ? publishAt : when === 'public' ? new Date().toISOString() : undefined,
        videoId: result.id,
        url: result.url,
        at: new Date().toISOString(),
      });
      return NextResponse.json(state(key));
    }
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

// DELETE ?key=… → forget a record made by mistake (does not delete anything on YouTube).
export async function DELETE(req: Request) {
  const key = new URL(req.url).searchParams.get('key');
  if (!key) return NextResponse.json({ error: 'key is required' }, { status: 400 });
  removeEntry(key);
  return NextResponse.json(state(key));
}
