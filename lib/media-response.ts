import fs from 'fs';
import { Readable } from 'stream';

/** A file on disk that may be streamed to the browser. */
export type ServedFile = { full: string; type: string; size: number };

/** Streams a file with Range support (so video and audio can seek). `downloadName` makes the browser save it. */
export function fileResponse(req: Request, file: ServedFile, downloadName?: string) {
  const headers: Record<string, string> = {
    'Content-Type': file.type,
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'no-cache',
  };
  if (downloadName) headers['Content-Disposition'] = `attachment; filename="${downloadName.replace(/[^\w.-]/g, '_')}"`;

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
