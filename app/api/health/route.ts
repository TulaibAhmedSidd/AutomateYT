import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

type KeyName = 'openai' | 'gemini' | 'elevenlabs' | 'leonardo' | 'youtube';

const ENV_KEYS: Record<KeyName, string[]> = {
  openai: ['OPENAI_API_KEY'],
  gemini: ['GEMINI_API_KEY'],
  elevenlabs: ['ELEVENLABS_API_KEY'],
  leonardo: ['LEONARDO_API_KEY'],
  youtube: ['YOUTUBE_CLIENT_ID', 'YOUTUBE_CLIENT_SECRET', 'YOUTUBE_REFRESH_TOKEN'],
};

function withTimeout<T>(promise: Promise<T>, ms: number) {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`timed out after ${ms / 1000}s`)), ms)),
  ]);
}

// Reports only booleans: never returns key values.
export async function GET() {
  const keys: Record<KeyName, boolean> = {
    openai: false,
    gemini: false,
    elevenlabs: false,
    leonardo: false,
    youtube: false,
  };

  for (const [name, vars] of Object.entries(ENV_KEYS) as [KeyName, string[]][]) {
    keys[name] = vars.every((v) => Boolean(process.env[v]));
  }

  let database: { ok: boolean; error?: string } = { ok: false };
  let videoCount: number | null = null;

  try {
    if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not set');
    const { default: connectToDatabase } = await import('@/lib/mongodb');
    await withTimeout(connectToDatabase(), 8000);
    const { Settings } = await import('@/models/Settings');
    const { Video } = await import('@/models/Video');
    const settings = (await Settings.findOne().lean()) as { apiKeys?: Record<string, string> } | null;
    const stored = settings?.apiKeys || {};
    keys.openai ||= Boolean(stored.openai);
    keys.gemini ||= Boolean(stored.gemini);
    keys.elevenlabs ||= Boolean(stored.elevenlabs);
    keys.leonardo ||= Boolean(stored.leonardo);
    keys.youtube ||= Boolean(stored.youtubeClientId && stored.youtubeClientSecret && stored.youtubeRefreshToken);
    videoCount = await Video.countDocuments();
    database = { ok: true };
  } catch (error: unknown) {
    database = { ok: false, error: error instanceof Error ? error.message : 'Database unreachable' };
  }

  return NextResponse.json({ database, keys, videoCount, checkedAt: new Date().toISOString() });
}
