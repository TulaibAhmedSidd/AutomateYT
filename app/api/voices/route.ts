import { NextResponse } from 'next/server';
import axios from 'axios';
import connectToDatabase from '@/lib/mongodb';
import { Settings } from '@/models/Settings';

export async function GET() {
  try {
    await connectToDatabase();
    const settings = await Settings.findOne();
    const apiKey = settings?.apiKeys?.elevenlabs || process.env.ELEVENLABS_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ voices: [], error: 'ElevenLabs API Key missing' }, { status: 200 });
    }

    const response = await axios.get('https://api.elevenlabs.io/v1/voices', {
      headers: {
        'xi-api-key': apiKey,
        Accept: 'application/json',
      },
    });

    const voices = Array.isArray(response.data?.voices)
      ? response.data.voices.map((voice: { voice_id?: string; name?: string; category?: string; labels?: Record<string, string> }) => ({
          id: voice.voice_id || '',
          name: voice.name || 'Unnamed voice',
          category: voice.category || 'account',
          accent: voice.labels?.accent || '',
          gender: voice.labels?.gender || '',
        })).filter((voice: { id: string }) => Boolean(voice.id))
      : [];

    return NextResponse.json({ voices });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to load ElevenLabs voices';
    return NextResponse.json({ voices: [], error: message }, { status: 200 });
  }
}
