import { NextResponse } from 'next/server';
import { deleteJob, isJobId, jobDir, readSpec, readStatus } from '@/lib/motion/jobs';
import fs from 'fs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!isJobId(id) || !fs.existsSync(jobDir(id))) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const spec = readSpec(id);
  return NextResponse.json({ id, status: readStatus(id), spec: spec ? { ...spec, assetBase: `/api/motion/files/${id}/assets` } : null });
}

export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!isJobId(id) || !fs.existsSync(jobDir(id))) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  deleteJob(id);
  return NextResponse.json({ ok: true });
}
