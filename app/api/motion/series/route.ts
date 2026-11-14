import { NextResponse } from 'next/server';
import { listMotionSeries } from '@/lib/motion/series';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Motion graphics series from content/motion/series, with which episodes are already rendered on this PC.
export async function GET() {
  try {
    return NextResponse.json({ series: listMotionSeries() }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `Could not read the motion series: ${message}` }, { status: 500 });
  }
}
