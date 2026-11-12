import { NextResponse } from 'next/server';
import { CartoonError } from './store';

/** Turns an error into JSON: our own CartoonError messages as 400, anything else as a 500 with the reason. */
export function jsonError(error: unknown) {
  if (error instanceof CartoonError) return NextResponse.json({ error: error.message }, { status: 400 });
  const message = error instanceof Error ? error.message : String(error);
  console.error('[cartoon]', message);
  return NextResponse.json({ error: `Something went wrong: ${message}` }, { status: 500 });
}

/** Refuses work that needs this PC's disk and FFmpeg when running on Vercel. */
export function refuseOnVercel() {
  if (process.env.VERCEL) {
    return NextResponse.json({ error: 'Cartoon Studio runs on your own PC. Start the app locally.' }, { status: 400 });
  }
  return null;
}
