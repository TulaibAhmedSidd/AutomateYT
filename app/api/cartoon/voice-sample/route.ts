import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import { VOICES } from '@/lib/motion/spec';
import { sampleLang } from '@/lib/cartoon/spec';
import { edgeTts } from '@/lib/cartoon/tts';
import { jsonError } from '@/lib/cartoon/http';
import { fileResponse } from '@/lib/media-response';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// A short demo clip of a voice, so the owner can listen before spending credits. Always free:
// - ElevenLabs: ElevenLabs' own demo clip (no credits), in Urdu when the voice has one.
// - Microsoft: one short line made with the free Edge voice.
// Downloaded or made once, then kept in storage/voice-samples/.
// GET ?kind=eleven&id=<voiceId>&lang=ur  |  ?kind=edge&id=ur-PK-AsadNeural
const SAMPLE_DIR = path.join(process.cwd(), 'storage', 'voice-samples');
const EDGE_TEXT: Record<string, string> = {
  ur: 'السلام علیکم! یہ میری آواز ہے۔ آج ہم آپ کو ایک مزے کی کہانی سنائیں گے۔',
  en: 'Hi there! This is how I sound. Today I have a fun little story for you.',
};

type VoiceInfo = { preview_url?: string; verified_languages?: { language?: string; preview_url?: string }[] };

async function elevenPreviewUrl(id: string, want: string) {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error('ELEVENLABS_API_KEY is not set in .env.local');
  const res = await fetch(`https://api.elevenlabs.io/v1/voices/${encodeURIComponent(id)}`, { headers: { 'xi-api-key': key }, cache: 'no-store' });
  if (!res.ok) throw new Error(`ElevenLabs could not find this voice (HTTP ${res.status})`);
  const v = (await res.json()) as VoiceInfo;
  const clips = (v.verified_languages || []).filter((l) => l.preview_url && l.language);
  const lang = sampleLang(clips.map((l) => String(l.language)), want);
  const url = clips.find((l) => l.language === lang)?.preview_url || v.preview_url;
  if (!url || !url.startsWith('https://')) throw new Error('This voice has no demo clip.');
  return url;
}

export async function GET(req: Request) {
  try {
    const q = new URL(req.url).searchParams;
    const kind = q.get('kind');
    const id = q.get('id') || '';
    const lang = /^[a-z]{2,3}$/.test(q.get('lang') || '') ? String(q.get('lang')) : 'en';
    fs.mkdirSync(SAMPLE_DIR, { recursive: true });

    let file: string;
    if (kind === 'edge') {
      const voice = VOICES.find((v) => v.id === id && v.id !== 'none');
      if (!voice) return NextResponse.json({ error: 'Unknown voice' }, { status: 400 });
      file = path.join(SAMPLE_DIR, `edge-${voice.id}.mp3`);
      if (!fs.existsSync(file)) {
        const { audio } = await edgeTts(EDGE_TEXT[voice.lang] || EDGE_TEXT.en, voice.id);
        fs.writeFileSync(file, audio);
      }
    } else if (kind === 'eleven') {
      if (!/^[A-Za-z0-9]{10,40}$/.test(id)) return NextResponse.json({ error: 'Unknown voice' }, { status: 400 });
      file = path.join(SAMPLE_DIR, `eleven-${id}-${lang}.mp3`);
      if (!fs.existsSync(file)) {
        const clip = await fetch(await elevenPreviewUrl(id, lang), { cache: 'no-store' });
        if (!clip.ok) throw new Error(`Could not download the demo clip (HTTP ${clip.status})`);
        fs.writeFileSync(file, Buffer.from(await clip.arrayBuffer()));
      }
    } else {
      return NextResponse.json({ error: 'kind must be eleven or edge' }, { status: 400 });
    }
    return fileResponse(req, { full: file, type: 'audio/mpeg', size: fs.statSync(file).size });
  } catch (error) {
    return jsonError(error);
  }
}
