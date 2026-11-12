import { NextResponse } from 'next/server';
import { jsonError } from '@/lib/cartoon/http';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// The ElevenLabs voices in the owner's account. "premade" voices work on every plan; library ("professional")
// voices need a paid plan when used through the API. Free to call (no credits).
export async function GET() {
  try {
    const key = process.env.ELEVENLABS_API_KEY;
    if (!key) return NextResponse.json({ voices: [], error: 'ELEVENLABS_API_KEY is not set in .env.local' });
    const res = await fetch('https://api.elevenlabs.io/v2/voices?page_size=100', { headers: { 'xi-api-key': key }, cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return NextResponse.json({ voices: [], error: data?.detail?.message || `ElevenLabs HTTP ${res.status}` });
    const voices = (data.voices || []).map((v: { voice_id: string; name: string; category?: string; labels?: { gender?: string; age?: string } }) => ({
      id: v.voice_id,
      name: v.name,
      gender: v.labels?.gender || '',
      paidOnly: v.category !== 'premade',
    }));
    return NextResponse.json({ voices });
  } catch (error) {
    return jsonError(error);
  }
}
