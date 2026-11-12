import { NextResponse } from 'next/server';
import { createJob, listJobs } from '@/lib/motion/jobs';
import { sanitizeSpec } from '@/lib/motion/spec';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json({ jobs: listJobs() });
}

export async function POST(req: Request) {
  if (process.env.VERCEL) {
    return NextResponse.json({ error: 'Motion videos render on your own PC. Run the app locally to render.' }, { status: 400 });
  }
  const body = await req.json().catch(() => ({}));
  const spec = sanitizeSpec(body.spec);
  if (!spec.scenes.length) return NextResponse.json({ error: 'Add at least one scene.' }, { status: 400 });
  const id = createJob(spec);
  return NextResponse.json({ id });
}
