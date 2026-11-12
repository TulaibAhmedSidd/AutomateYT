import fs from 'fs';
import { Readable } from 'stream';
import { isJobId, jobFile } from '@/lib/motion/jobs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Streams a rendered video or a scene's voice file, with Range support so the video can seek.
export async function GET(req: Request, context: { params: Promise<{ id: string; path: string[] }> }) {
  const { id, path: parts } = await context.params;
  if (!isJobId(id)) return new Response('Not found', { status: 404 });
  let file;
  try {
    file = jobFile(id, parts);
  } catch {
    return new Response('Not found', { status: 404 });
  }
  if (!file) return new Response('Not found', { status: 404 });

  const download = new URL(req.url).searchParams.get('download');
  const headers: Record<string, string> = {
    'Content-Type': file.type,
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'no-cache',
  };
  if (download) headers['Content-Disposition'] = `attachment; filename="${id}.mp4"`;

  const range = req.headers.get('range');
  const m = range?.match(/bytes=(\d*)-(\d*)/);
  if (m) {
    const start = m[1] ? parseInt(m[1], 10) : 0;
    const end = m[2] ? Math.min(parseInt(m[2], 10), file.size - 1) : file.size - 1;
    if (start >= file.size || start > end) {
      return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${file.size}` } });
    }
    const stream = Readable.toWeb(fs.createReadStream(file.full, { start, end })) as ReadableStream;
    return new Response(stream, {
      status: 206,
      headers: { ...headers, 'Content-Range': `bytes ${start}-${end}/${file.size}`, 'Content-Length': String(end - start + 1) },
    });
  }
  const stream = Readable.toWeb(fs.createReadStream(file.full)) as ReadableStream;
  return new Response(stream, { headers: { ...headers, 'Content-Length': String(file.size) } });
}
