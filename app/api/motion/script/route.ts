import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import connectToDatabase from '@/lib/mongodb';
import { Settings } from '@/models/Settings';
import { sanitizeSpec, type MotionLang, type ThemeId } from '@/lib/motion/spec';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function systemPrompt(language: MotionLang, seconds: number) {
  const lang =
    language === 'ur'
      ? `Write ALL text (voice, heading, sub, items) in Urdu using Urdu (Perso-Arabic) script. Never use Hindi or Devanagari script. Keep the title in Roman Urdu.`
      : 'Write in simple, punchy English. Short words. No jargon.';
  const words = Math.round(seconds * 2.6);
  return `You write scripts for vertical motion-graphics YouTube Shorts (kinetic text, counters, lists — no images).
${lang}
Return ONLY a JSON object:
{
  "title": string (under 60 chars, curiosity-driven),
  "description": string (2-3 lines, with 3 hashtags),
  "tags": string[] (8-12),
  "scenes": [{ "kind": one of "hook"|"stat"|"list"|"compare"|"statement"|"timeline"|"cta",
               "voice": what the narrator says,
               "heading": big on-screen text, max 8 words; wrap the 1-2 key words in *stars*,
               "sub": optional small line,
               "value": for "stat" only, e.g. "90%", "$28K", "3x", "400 km",
               "items": for "list" (2-4 items, max 4 words each) or "compare" (exactly 2: the myth/wrong side first, the truth/right side second),
               "points": for "timeline" only: 3-6 steps, oldest first, each {"label": year or era like "1990", "value": number with unit like "Rs 35" or "3.4 crore"}; every value uses the same unit }]
}

HARD RULES
1. Length: the "voice" lines together must be ${words - 10} to ${words + 10} words (about ${seconds} seconds). Count them. Each scene's voice is 8 to 22 words. 6 to 8 scenes.
2. Truth: only facts that are well established and widely reported. A "stat" scene must use a real, checkable number (a size, distance, year, percentage from a known source). If you do not know a real number, use a "statement" scene instead. Never invent percentages.
3. Do not use quotes or attribute words to anyone (no "as X said"). Models misremember quotes.
4. The narrator must say what is on screen: a "list" voice names every item; a "compare" voice says both sides; a "timeline" voice says every step in order, starting with the first, so the year on screen matches the voice.
5. Headings are written for THIS topic. Never write template words like "Wrong way", "Right way", "Point 1". When the topic changes over time (prices, population, records), use one "timeline" scene with real, well-known numbers only; leave out any step you are not sure of.
6. Retention: scene 1 is "hook" — a surprising claim or direct question that works with the sound off. Then give the payoff with real detail. Change the scene kind every scene. Spell numbers as words in "voice", digits in "heading"/"value".
7. Last scene is "cta": follow for part 2, or comment one keyword (and put that keyword in "sub").

EXAMPLE (topic "How deep is the ocean", style only — do not copy):
{"title":"You could sink Everest in the ocean","scenes":[
{"kind":"hook","heading":"Drop *Everest* here and it vanishes","voice":"If you dropped Mount Everest into the deepest part of the ocean, its peak would still be under water."},
{"kind":"stat","value":"10,935 m","heading":"Deepest point: Challenger Deep","voice":"The Challenger Deep in the Mariana Trench goes down about ten thousand nine hundred metres."},
{"kind":"compare","heading":"Everest vs the trench","items":["Everest: 8,849 m tall","Trench: 10,935 m deep"],"voice":"Everest is eight thousand eight hundred metres tall. The trench is two kilometres deeper than that."},
{"kind":"list","heading":"What lives down there","items":["No sunlight","Crushing pressure","Glowing fish"],"voice":"Down there you get no sunlight, pressure a thousand times stronger than at the surface, and fish that make their own light."},
{"kind":"cta","heading":"Follow for *part 2*","sub":"Comment DEEP","voice":"Follow for part two, and comment deep if you want the creatures list."}]}`;
}

function mostlyUrduScript(parsed: { scenes?: { voice?: unknown }[] }) {
  const voices = (parsed.scenes || []).map((s) => String(s?.voice || '')).join(' ');
  const arabic = (voices.match(/[؀-ۿ]/g) || []).length;
  const latin = (voices.match(/[A-Za-z]/g) || []).length;
  return arabic > 0 && arabic >= latin * 3;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const topic = typeof body.topic === 'string' ? body.topic.trim().slice(0, 600) : '';
    if (!topic) return NextResponse.json({ error: 'Write a topic first.' }, { status: 400 });
    const language: MotionLang = body.language === 'ur' ? 'ur' : 'en';
    const seconds = Math.min(60, Math.max(20, Number(body.seconds) || 35));
    const model = typeof body.model === 'string' ? body.model : 'gpt-4o-mini';

    let keys: { openai?: string; gemini?: string } = {};
    try {
      await connectToDatabase();
      const settings = await Settings.findOne().lean<{ apiKeys?: { openai?: string; gemini?: string } }>();
      keys = settings?.apiKeys || {};
    } catch {
      // Database down: fall back to .env keys.
    }

    const prompt =
      language === 'ur'
        ? `Topic: ${topic}\n\nWrite every voice, heading, sub and item in Urdu script (اردو), even if the topic above is typed in Roman Urdu or English. Only "title" stays in Roman Urdu.`
        : `Topic: ${topic}`;

    let ask: (extra?: string) => Promise<string>;
    if (model.startsWith('gemini')) {
      const key = keys.gemini || process.env.GEMINI_API_KEY;
      if (!key) return NextResponse.json({ error: 'No Gemini key in Settings or .env' }, { status: 400 });
      const genAI = new GoogleGenerativeAI(key);
      const m = genAI.getGenerativeModel({ model, generationConfig: { responseMimeType: 'application/json', temperature: 0.8 } });
      ask = async (extra) => (await m.generateContent(`${systemPrompt(language, seconds)}\n\n${prompt}${extra ? `\n\n${extra}` : ''}`)).response.text();
    } else {
      const key = keys.openai || process.env.OPENAI_API_KEY;
      if (!key) return NextResponse.json({ error: 'No OpenAI key in Settings or .env' }, { status: 400 });
      const openai = new OpenAI({ apiKey: key });
      ask = async (extra) => {
        const res = await openai.chat.completions.create({
          model,
          temperature: 0.8,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemPrompt(language, seconds) },
            { role: 'user', content: prompt + (extra ? `\n\n${extra}` : '') },
          ],
        });
        return res.choices[0]?.message?.content || '{}';
      };
    }

    let parsed = JSON.parse(await ask());
    // Urdu voices cannot read Roman Urdu; if the model slipped into Latin letters, ask once more.
    if (language === 'ur' && !mostlyUrduScript(parsed)) {
      parsed = JSON.parse(
        await ask('Your last answer used Roman/Latin letters. That is wrong: the narrator only reads Urdu script. Rewrite it all in Urdu script (اردو). Never use Hindi/Devanagari.')
      );
      if (!mostlyUrduScript(parsed)) throw new Error('The model kept writing Roman Urdu. Try again, or try Gemini or GPT-4o.');
    }
    // The AI may not write quotes (it misattributes them); a quote scene can still be added by hand in the Studio.
    if (Array.isArray(parsed.scenes)) {
      for (const s of parsed.scenes) {
        if (s?.kind === 'quote') {
          s.kind = 'statement';
          delete s.sub;
        }
      }
    }
    const spec = sanitizeSpec({
      ...parsed,
      language,
      theme: (body.theme as ThemeId) || 'ember',
      voice: body.voice,
      captions: true,
    });
    if (!spec.scenes.length) throw new Error('The model returned no scenes. Try again.');
    return NextResponse.json({ spec });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Script failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
