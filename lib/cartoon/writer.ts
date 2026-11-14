import { jsonAsker, mostlyUrduScript } from '@/lib/llm-json';
import { CAMERAS, TRANSITION_SECONDS, isTransition, sanitizeEpisode, shotCountFor, spokenText, type CartoonEpisode, type CartoonSeries } from './spec';

// The AI episode writer. Server only. Costs OpenAI/Gemini credit (about 1.7 cents per episode with gpt-6.1-sol).

/** Rules that depend on the language and on the narrator's voice. */
function extraRules(series: CartoonSeries) {
  const rules: string[] = [];
  if (series.language === 'ur') {
    rules.push(
      'Write natural spoken Pakistani Urdu, the way people really talk at home. Everyday English words people use inside Urdu (phone, school, WhatsApp, sorry, please, okay) may stay in English letters.',
    );
  }
  if (series.voice.provider === 'elevenlabs') {
    rules.push(
      'The narrator is an expressive AI voice. In about every third line, add ONE audio tag in square brackets where the feeling fits: [laughs], [chuckles], [giggles], [sighs], [excited], [whispers], [surprised], [sarcastic]. Tags are performed, not spoken, and do not count as words.',
    );
  }
  return rules.map((r, i) => `${9 + i}. ${r}\n`).join('');
}

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
${extraRules(series)}
Return JSON only:
{"title": "...", "description": "2-3 sentence YouTube description", "tags": ["..."], "endHook": "one line teasing the next episode",
 "shots": [{"narration": "...", "characters": ["id"], "scene": "...", "action": "...", "camera": "push-in", "mood": "..."}]}
${urdu ? '"title" and "endHook" may be Roman Urdu; "description" in Urdu script.' : ''}`;
}

function problems(ep: CartoonEpisode, shots: number) {
  const out: string[] = [];
  if (Math.abs(ep.shots.length - shots) > 2) out.push(`Write ${shots} shots, not ${ep.shots.length}.`);
  ep.shots.forEach((s, i) => {
    const words = spokenText(s.narration).split(/\s+/).filter(Boolean).length;
    if (words > 14) out.push(`Shot ${i + 1} narration has ${words} words; keep it to 12 or fewer.`);
    if (!s.narration) out.push(`Shot ${i + 1} has no narration.`);
  });
  return out;
}

function transitionPrompt(series: CartoonSeries) {
  return `You plan short vertical (9:16) TRANSITION reels for Instagram Reels and YouTube Shorts: a fast sequence of AI pictures
that change step by step (then → now, evolution, growth, seasons), with a flash cut between pictures and no voice.

SERIES: ${series.name}
LOOK: ${series.style}
SERIES RULES:
${series.rules.map((r) => `- ${r}`).join('\n') || '- (none)'}

HARD RULES:
1. 6 to 10 stages ("shots") in a clear order. The first stage is instantly recognisable; the last is the most impressive.
2. "narration" is the on-screen LABEL for that stage, at most 5 words (e.g. "1947", "Seed", "Year 2100"). It is not spoken.
3. "scene" and "action" are image prompts in English: the same subject and the same camera angle in every stage, so the change is easy to see. One visible difference per stage.
4. "camera" is "static" or "push-in". No text, letters or logos inside the pictures. No real people.
5. Only well-known facts in labels; never invent dates or numbers.

Return JSON only:
{"title": "catchy title, max 60 characters", "description": "1-2 sentences + 5 hashtags", "tags": ["..."], "endHook": "a short question for the comments",
 "shots": [{"narration": "label", "characters": [], "scene": "...", "action": "...", "camera": "static", "mood": "..."}]}`;
}

/** Writes one transition reel draft: 6-10 labelled pictures, each shown for TRANSITION_SECONDS. */
async function writeTransition(series: CartoonSeries, topic: string, model: string): Promise<CartoonEpisode> {
  const ask = await jsonAsker(model, transitionPrompt(series));
  const parse = (text: string) => {
    const ep = sanitizeEpisode(JSON.parse(text), series.id);
    for (const s of ep.shots) {
      s.characters = [];
      s.duration = TRANSITION_SECONDS;
    }
    return ep;
  };
  let ep = parse(await ask(`Reel idea: ${topic}`));
  const long = ep.shots.filter((s) => s.narration.split(/\s+/).filter(Boolean).length > 6).length;
  if (ep.shots.length < 5 || ep.shots.length > 12 || long) {
    ep = parse(await ask(`Reel idea: ${topic}\n\nYour last answer broke the rules: use 6-10 stages and labels of at most 5 words. Rewrite it.`));
  }
  if (!ep.shots.length) throw new Error('The model returned no stages. Try again.');
  return ep;
}

/** Writes one episode draft (not saved) for a series from an idea. Retries once if the rules are broken. */
export async function writeEpisode(series: CartoonSeries, topic: string, model: string): Promise<CartoonEpisode> {
  if (isTransition(series)) return writeTransition(series, topic, model);
  const shots = shotCountFor(series.episodeSeconds);
  const ask = await jsonAsker(model, systemPrompt(series, shots));
  const prompt = `Episode idea: ${topic}`;
  const known = new Set(series.characters.map((c) => c.id));
  const parse = (text: string) => {
    const raw = JSON.parse(text) as { shots?: { characters?: unknown }[] };
    // Keep only character ids that exist in this series.
    for (const s of raw.shots || []) s.characters = Array.isArray(s.characters) ? s.characters.filter((c) => known.has(String(c))) : [];
    return sanitizeEpisode(raw, series.id);
  };
  const urduOk = (ep: CartoonEpisode) => series.language !== 'ur' || mostlyUrduScript(ep.shots.map((s) => s.narration).join(' '));

  let episode = parse(await ask(prompt));
  const issues = problems(episode, shots);
  if (!urduOk(episode)) issues.push('Narration must be in Urdu script (اردو), not Roman Urdu or English.');
  if (issues.length) {
    episode = parse(await ask(`${prompt}\n\nYour last answer broke these rules. Rewrite the whole episode and fix them:\n- ${issues.join('\n- ')}`));
    if (!urduOk(episode)) throw new Error('The model kept writing Roman Urdu. Try again, or pick another model.');
  }
  if (!episode.shots.length) throw new Error('The model returned no shots. Try again.');
  return episode;
}
