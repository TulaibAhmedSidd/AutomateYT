import { NextResponse } from 'next/server';
import { listSeries, saveSeries } from '@/lib/cartoon/store';
import { jsonError, refuseOnVercel } from '@/lib/cartoon/http';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Lists all cartoon series (the 4 starter series are created on first use).
export async function GET() {
  const refused = refuseOnVercel();
  if (refused) return refused;
  try {
    return NextResponse.json({ series: listSeries() });
  } catch (error) {
    return jsonError(error);
  }
}

// Creates or updates a series: { series }.
export async function POST(req: Request) {
  const refused = refuseOnVercel();
  if (refused) return refused;
  try {
    const body = await req.json().catch(() => ({}));
    return NextResponse.json({ series: saveSeries(body.series) });
  } catch (error) {
    return jsonError(error);
  }
}
