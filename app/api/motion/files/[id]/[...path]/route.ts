import { isJobId, jobFile } from '@/lib/motion/jobs';
import { fileResponse } from '@/lib/media-response';

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
  return fileResponse(req, file, download ? `${id}.mp4` : undefined);
}
