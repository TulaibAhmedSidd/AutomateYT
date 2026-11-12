// Free Microsoft Edge neural voice with word timings. Shared by the Motion and Cartoon workers.
import fs from 'node:fs';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

const KBPS = 96; // AUDIO_24KHZ_96KBITRATE_MONO_MP3 is constant bit rate, so length = bytes / rate.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Speaks `text` with an Edge voice into `outDir`. Returns the MP3 path, its length in seconds and word timings
 * (seconds from the start). Retries 5 times because the online service drops connections now and then.
 */
export async function speakEdge(text, voice, outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  for (let attempt = 1; ; attempt += 1) {
    const tts = new MsEdgeTTS();
    try {
      await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3, { wordBoundaryEnabled: true });
      const { audioFilePath, metadataFilePath } = await tts.toFile(outDir, text, { rate: '+4%' });
      const bytes = fs.statSync(audioFilePath).size;
      if (!bytes) throw new Error('empty audio');
      let words = [];
      if (metadataFilePath && fs.existsSync(metadataFilePath)) {
        const meta = JSON.parse(fs.readFileSync(metadataFilePath, 'utf8'));
        words = (meta.Metadata || [])
          .filter((m) => m.Type === 'WordBoundary')
          .map((m) => ({ text: m.Data.text.Text, start: m.Data.Offset / 1e7, end: (m.Data.Offset + m.Data.Duration) / 1e7 }))
          .filter((w) => /[\p{L}\p{N}]/u.test(w.text));
      }
      return { file: audioFilePath, seconds: (bytes * 8) / (KBPS * 1000), words };
    } catch (e) {
      if (attempt >= 5) throw new Error(`Voice failed: ${e?.message || e}`);
      await sleep(2500 * attempt);
    } finally {
      tts.close();
    }
  }
}
