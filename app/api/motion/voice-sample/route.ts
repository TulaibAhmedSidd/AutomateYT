import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import { VOICES } from '@/lib/motion/spec';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SAMPLE: Record<string, string> = {
  en: 'Ninety percent of Shorts die in the first two seconds. Here is how yours survives.',
  ur: 'زیادہ تر ویڈیوز پہلے دو سیکنڈ میں ہی ختم ہو جاتی ہیں۔ آپ کی ویڈیو کیسے بچے گی، دیکھیں۔',
};

// Plays a short line in a free Edge neural voice, so the voice can be picked by ear.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const voice = VOICES.find((v) => v.id === body.voice && v.id !== 'none');
  if (!voice) return Response.json({ error: 'Unknown voice' }, { status: 400 });
  const text = typeof body.text === 'string' && body.text.trim() ? body.text.trim().slice(0, 300) : SAMPLE[voice.lang === 'ur' ? 'ur' : 'en'];

  const tts = new MsEdgeTTS();
  try {
    await tts.setMetadata(voice.id, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
    const { audioStream } = tts.toStream(text, { rate: '+4%' });
    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      audioStream.on('data', (c: Buffer) => chunks.push(c));
      audioStream.on('end', () => resolve());
      audioStream.on('close', () => resolve());
      audioStream.on('error', reject);
    });
    return new Response(new Uint8Array(Buffer.concat(chunks)), { headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' } });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'Voice service failed' }, { status: 502 });
  } finally {
    tts.close();
  }
}
