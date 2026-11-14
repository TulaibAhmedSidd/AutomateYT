import { NextResponse } from 'next/server';
import { jsonError } from '@/lib/cartoon/http';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type RawVoice = {
  voice_id: string;
  name: string;
  category?: string;
  labels?: { gender?: string; age?: string; accent?: string; descriptive?: string; language?: string };
  verified_languages?: { language?: string; preview_url?: string }[];
};

// The ElevenLabs voices in the owner's account. "premade" voices work on every plan; library ("professional")
// voices need a paid plan when used through the API. Free to call (no credits).
// sampleLangs = languages with a free demo clip (played through /api/cartoon/voice-sample).
export async function GET() {
  try {
    const key = process.env.ELEVENLABS_API_KEY;
    if (!key) return NextResponse.json({ voices: [], error: 'ELEVENLABS_API_KEY is not set in .env.local' });
    const res = await fetch('https://api.elevenlabs.io/v2/voices?page_size=100', { headers: { 'xi-api-key': key }, cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return NextResponse.json({ voices: [], error: data?.detail?.message || `ElevenLabs HTTP ${res.status}` });
    const voices = ((data.voices || []) as RawVoice[]).map((v) => ({
      id: v.voice_id,
      name: v.name,
      gender: v.labels?.gender || '',
      accent: v.labels?.accent || '',
      style: v.labels?.descriptive || '',
      language: v.labels?.language || '',
      paidOnly: v.category !== 'premade',
      sampleLangs: [...new Set((v.verified_languages || []).filter((l) => l.preview_url && l.language).map((l) => String(l.language)))],
    }));
    // Native Urdu voices first, then by name.
    voices.sort((a, b) => Number(b.language === 'ur') - Number(a.language === 'ur') || a.name.localeCompare(b.name));
    return NextResponse.json({ voices });
  } catch (error) {
    return jsonError(error);
  }
}
