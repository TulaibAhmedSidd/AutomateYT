import { NextResponse } from 'next/server';
import { authUrl } from '@/lib/youtube-connect';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Sends the owner to Google sign-in to connect their YouTube channel.
export async function GET(req: Request) {
  const origin = new URL(req.url).origin;
  try {
    return NextResponse.redirect(await authUrl(origin));
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.redirect(`${origin}/connections?youtube_error=${encodeURIComponent(message)}`);
  }
}
