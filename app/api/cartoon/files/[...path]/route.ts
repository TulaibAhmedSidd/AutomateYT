import { resolveCartoonFile } from '@/lib/cartoon/store';
import { fileResponse } from '@/lib/media-response';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Serves cartoon files (reference pictures, shot pictures, recordings, rendered video) from storage/cartoon.
// ?download=1 saves the file instead of playing it.
export async function GET(req: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path: parts } = await context.params;
  const file = resolveCartoonFile(parts.map((p) => decodeURIComponent(p)));
  if (!file) return new Response('Not found', { status: 404 });
  const download = new URL(req.url).searchParams.get('download');
  return fileResponse(req, file, download ? parts.join('-') : undefined);
}
