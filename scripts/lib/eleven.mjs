// ElevenLabs text-to-speech with word timings. Used by the cartoon worker. Costs ElevenLabs credits
// (about 1 credit per character with eleven_v4, half with eleven_v4_turbo).
import fs from 'node:fs';

const TAG = /\[[^\]]{1,30}\]/;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Turns ElevenLabs character timings into word timings, skipping audio tags like [laughs]. */
function wordsFromAlignment(a) {
  if (!a?.characters?.length) return [];
  const words = [];
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

/**
 * Speaks `text` (audio tags allowed) with an ElevenLabs voice into `outFile` (MP3).
 * Returns the length in seconds and word timings. Retries twice on network errors; never retries a 4xx.
 */
export async function speakEleven(text, voiceId, model, outFile) {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error('ELEVENLABS_API_KEY is not set in .env.local');
  for (let attempt = 1; ; attempt += 1) {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps?output_format=mp3_44100_128`, {
      method: 'POST',
      headers: { 'xi-api-key': key, 'content-type': 'application/json' },
      body: JSON.stringify({ text, model_id: model }),
    }).catch((e) => ({ ok: false, status: 0, json: async () => ({ detail: { message: e.message } }) }));
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.audio_base64) {
      const buf = Buffer.from(data.audio_base64, 'base64');
      fs.writeFileSync(outFile, buf);
      const words = wordsFromAlignment(data.alignment || data.normalized_alignment);
      const last = data.alignment?.character_end_times_seconds?.at(-1) || 0;
      return { seconds: Math.max(last, (buf.length * 8) / 128000), words };
    }
    const message = data?.detail?.message || data?.detail || `HTTP ${res.status}`;
    if (res.status === 402) throw new Error(`ElevenLabs: ${message} (pick a voice your plan allows, or upgrade the plan)`);
    if (res.status === 401) throw new Error(`ElevenLabs key problem: ${message}`);
    if ((res.status >= 400 && res.status < 500) || attempt >= 3) throw new Error(`ElevenLabs failed: ${message}`);
    await sleep(3000 * attempt);
  }
}

/** True when the text has an audio tag like [laughs]. */
export function hasTag(text) {
  return TAG.test(text);
}
