import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import { spokenText, type Word } from './spec';

// AI voices for one line at a time. Server only.
// ElevenLabs costs credits (about 1 per character with eleven_v4); Microsoft Edge voices are free.

export type TtsResult = { audio: Buffer; seconds: number; words: Word[] };

/** Character timings from ElevenLabs → word timings, skipping audio tags like [laughs]. */
function wordsFromAlignment(a?: { characters: string[]; character_start_times_seconds: number[]; character_end_times_seconds: number[] }): Word[] {
  if (!a?.characters?.length) return [];
  const words: Word[] = [];
  let text = '';
  let start = 0;
  let end = 0;
  let inTag = false;
  const flush = () => {
    if (text && /[\p{L}\p{N}]/u.test(text)) words.push({ text, start, end });
    text = '';
  };
  a.characters.forEach((ch, i) => {
    if (ch === '[') {
      flush();
      inTag = true;
      return;
    }
    if (inTag) {
      if (ch === ']') inTag = false;
      return;
    }
    if (/\s/.test(ch)) return flush();
    if (!text) start = a.character_start_times_seconds[i];
    text += ch;
    end = a.character_end_times_seconds[i];
  });
  flush();
  return words;
}

/** Speaks a line (audio tags allowed) with an ElevenLabs voice. Throws a plain-English error on plan or key problems. */
export async function elevenTts(text: string, voiceId: string, model: string): Promise<TtsResult> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error('ELEVENLABS_API_KEY is not set in .env.local');
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}/with-timestamps?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'content-type': 'application/json' },
    body: JSON.stringify({ text, model_id: model }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.audio_base64) {
    const message = data?.detail?.message || data?.detail || `HTTP ${res.status}`;
    if (res.status === 402) throw new Error(`ElevenLabs: this voice needs a paid plan. Pick a voice from the "free plan" group. (${message})`);
    if (res.status === 401) throw new Error(`ElevenLabs key problem: ${message}`);
    if (res.status === 429) throw new Error(`ElevenLabs is busy or out of credits: ${message}`);
    throw new Error(`ElevenLabs failed: ${message}`);
  }
  const audio = Buffer.from(data.audio_base64, 'base64');
  const words = wordsFromAlignment(data.alignment || data.normalized_alignment);
  const last = data.alignment?.character_end_times_seconds?.at(-1) || 0;
  return { audio, seconds: Math.max(last, (audio.length * 8) / 128_000), words };
}

/** Speaks a line with a free Microsoft Edge voice (audio tags are removed first). */
export async function edgeTts(text: string, voice: string): Promise<TtsResult> {
  const tts = new MsEdgeTTS();
  try {
    await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
    const { audioStream } = tts.toStream(spokenText(text), { rate: '+4%' });
    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      audioStream.on('data', (c: Buffer) => chunks.push(c));
      audioStream.on('end', () => resolve());
      audioStream.on('close', () => resolve());
      audioStream.on('error', reject);
    });
    const audio = Buffer.concat(chunks);
    if (!audio.length) throw new Error('The free voice returned no audio. Try again.');
    return { audio, seconds: (audio.length * 8) / 96_000, words: [] };
  } finally {
    tts.close();
  }
}
