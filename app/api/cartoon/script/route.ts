import { NextResponse } from 'next/server';
import { getSeries } from '@/lib/cartoon/store';
import { jsonError } from '@/lib/cartoon/http';
import { jsonAsker, mostlyUrduScript, SCRIPT_MODELS } from '@/lib/llm-json';
import { CAMERAS, sanitizeEpisode, shotCountFor, type CartoonEpisode, type CartoonSeries } from '@/lib/cartoon/spec';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function systemPrompt(series: CartoonSeries, shots: number) {
  const urdu = series.language === 'ur';
  return `You write episodes of a vertical (9:16) 3D animated cartoon series for YouTube Shorts.
The owner records the narration in their own voice, and every shot becomes one ~5 second animated clip.

SERIES: ${series.name}
AUDIENCE: ${series.audience === 'kids' ? 'children (keep it gentle and safe)' : 'general audience'}
LOOK: ${series.style}
CHARACTERS (use these ids only):
${series.characters.map((c) => `- ${c.id}: ${c.look}`).join('\n') || '- (none: narrate over places and objects)'}
SERIES RULES (must follow every one):
${series.rules.map((r) => `- ${r}`).join('\n') || '- (none)'}

HARD RULES:
1. Exactly ${shots} shots (±1). Shot 1 is a hook that makes people stay; the last shot sets up the next episode.
2. "narration" is what the narrator says in that shot: one short sentence, at most 12 words.${
    urdu ? ' Write narration in Urdu script (اردو) only, never Roman Urdu, never Hindi/Devanagari.' : ''
  }
3. "scene" (where), "action" (ONE visible action, who does what) and "mood" are image prompts: write them in English, concrete and visual.
4. "characters" lists the ids of characters visible in the shot (0–3). Never invent new characters.
5. No text, signs, letters or captions inside the pictures. No brand names. No real celebrities.
6. "camera" is one of: ${CAMERAS.map((c) => c.id).join(', ')}. Vary it.
7. The story has a beginning, a problem and a payoff, and makes sense with sound off (captions are shown).
8. No invented facts, statistics or quotes.

Return JSON only:
{"title": "...", "description": "2-3 sentence YouTube description", "tags": ["..."], "endHook": "one line teasing the next episode",
 "shots": [{"narration": "...", "characters": ["id"], "scene": "...", "action": "...", "camera": "push-in", "mood": "..."}]}
${urdu ? '"title" and "endHook" may be Roman Urdu; "description" in Urdu script.' : ''}`;
}

function problems(ep: CartoonEpisode, series: CartoonSeries, shots: number) {
  const out: string[] = [];
  const ids = new Set(series.characters.map((c) => c.id));
  if (Math.abs(ep.shots.length - shots) > 2) out.push(`Write ${shots} shots, not ${ep.shots.length}.`);
  ep.shots.forEach((s, i) => {
    const words = s.narration.split(/\s+/).filter(Boolean).length;
    if (words > 14) out.push(`Shot ${i + 1} narration has ${words} words; keep it to 12 or fewer.`);
    if (!s.narration) out.push(`Shot ${i + 1} has no narration.`);
  });
  return { out, ids };
}

// Writes a new episode for a series from a topic: { seriesId, topic, model }. Returns a draft (not saved).
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const series = getSeries(String(body.seriesId || ''));
    if (!series) return NextResponse.json({ error: 'Pick a series first.' }, { status: 400 });
    const topic = typeof body.topic === 'string' ? body.topic.trim().slice(0, 600) : '';
    if (!topic) return NextResponse.json({ error: 'Write what the episode is about first.' }, { status: 400 });
    const model = SCRIPT_MODELS.includes(body.model) ? String(body.model) : 'gpt-4o-mini';
    const shots = shotCountFor(series.episodeSeconds);

    const ask = await jsonAsker(model, systemPrompt(series, shots));
    const prompt = `Episode idea: ${topic}`;
    const parse = (text: string) => {
      const raw = JSON.parse(text) as { shots?: { characters?: unknown }[] };
      // Keep only character ids that exist in this series.
      const known = new Set(series.characters.map((c) => c.id));
      for (const s of raw.shots || []) s.characters = Array.isArray(s.characters) ? s.characters.filter((c) => known.has(String(c))) : [];
      return sanitizeEpisode(raw, series.id);
    };

    let episode = parse(await ask(prompt));
    const issues = problems(episode, series, shots).out;
    if (series.language === 'ur' && !mostlyUrduScript(episode.shots.map((s) => s.narration).join(' '))) {
      issues.push('Narration must be in Urdu script (اردو), not Roman Urdu or English.');
    }
    if (issues.length) {
      episode = parse(await ask(`${prompt}\n\nYour last answer broke these rules. Rewrite the whole episode and fix them:\n- ${issues.join('\n- ')}`));
      if (series.language === 'ur' && !mostlyUrduScript(episode.shots.map((s) => s.narration).join(' '))) {
        throw new Error('The model kept writing Roman Urdu. Try again, or pick Gemini or GPT-4o.');
      }
    }
    if (!episode.shots.length) throw new Error('The model returned no shots. Try again.');
    return NextResponse.json({ episode });
  } catch (error) {
    return jsonError(error);
  }
}
