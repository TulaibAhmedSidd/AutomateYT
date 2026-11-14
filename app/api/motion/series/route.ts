import { NextResponse } from 'next/server';
import { listMotionSeries } from '@/lib/motion/series';
import { nextSlots } from '@/lib/youtube-publish';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Motion graphics series from content/motion/series: each episode with its newest render and its YouTube post,
// plus the next free posting time of the plan.
export async function GET() {
  try {
    return NextResponse.json({ series: listMotionSeries(), nextSlot: nextSlots(1)[0] || null }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `Could not read the motion series: ${message}` }, { status: 500 });
  }
}
