import { NextResponse } from 'next/server';
import { deleteSeries, getSeries } from '@/lib/cartoon/store';
import { jsonError } from '@/lib/cartoon/http';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

// One series.
export async function GET(_req: Request, context: Ctx) {
  try {
    const { id } = await context.params;
    const series = getSeries(id);
    if (!series) return NextResponse.json({ error: 'Series not found' }, { status: 404 });
    return NextResponse.json({ series });
  } catch (error) {
    return jsonError(error);
  }
}

// Deletes a saved series (starter series cannot be deleted).
export async function DELETE(_req: Request, context: Ctx) {
  try {
    const { id } = await context.params;
    deleteSeries(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
