import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import connectToDatabase from '@/lib/mongodb';
import { Settings } from '@/models/Settings';

// Asks OpenAI or Gemini for a JSON answer. Keys come from Mongo Settings first, then .env. Server only.

/** Script models the Studios offer (best first). Newer OpenAI models are reasoning models: see usesReasoning(). */
export const SCRIPT_MODELS: readonly string[] = ['gpt-6.1-sol', 'gpt-6.1-terra', 'gpt-5.5', 'gpt-5.4-mini', 'gpt-4o', 'gpt-4o-mini', 'gemini-2.5-flash'];

/** GPT-5+, GPT-6+ and o-series reject a custom temperature; they take a reasoning effort instead. */
function usesReasoning(model: string) {
  return /^(gpt-[5-9]|o\d)/.test(model);
}

/** A function that sends the user prompt (plus an optional correction) and returns the model's raw JSON text. */
export type JsonAsker = (prompt: string) => Promise<string>;

async function savedKeys(): Promise<{ openai?: string; gemini?: string }> {
  try {
    await connectToDatabase();
    const settings = await Settings.findOne().lean<{ apiKeys?: { openai?: string; gemini?: string } }>();
    return settings?.apiKeys || {};
  } catch {
    return {}; // Database down: fall back to .env keys.
  }
}

/** Builds an asker for `model` with a fixed system prompt. Throws a plain-English error when the key is missing. */
export async function jsonAsker(model: string, system: string, temperature = 0.8): Promise<JsonAsker> {
  const keys = await savedKeys();
  if (model.startsWith('gemini')) {
    const key = keys.gemini || process.env.GEMINI_API_KEY;
    if (!key) throw new Error('No Gemini key in Settings or .env');
    const m = new GoogleGenerativeAI(key).getGenerativeModel({ model, generationConfig: { responseMimeType: 'application/json', temperature } });
    return async (prompt) => (await m.generateContent(`${system}\n\n${prompt}`)).response.text();
  }
  const key = keys.openai || process.env.OPENAI_API_KEY;
  if (!key) throw new Error('No OpenAI key in Settings or .env');
  const openai = new OpenAI({ apiKey: key });
  return async (prompt) => {
    const res = await openai.chat.completions.create({
      model,
      ...(usesReasoning(model) ? { reasoning_effort: 'low' as const } : { temperature }),
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt },
      ],
    });
    const u = res.usage;
    if (u) console.log(`[llm] ${model} in=${u.prompt_tokens} out=${u.completion_tokens}`);
    return res.choices[0]?.message?.content || '{}';
  };
}

/** True when text is mostly Urdu (Arabic) script, not Roman Urdu. */
export function mostlyUrduScript(text: string) {
  const arabic = (text.match(/[؀-ۿ]/g) || []).length;
  const latin = (text.match(/[A-Za-z]/g) || []).length;
  return arabic > 0 && arabic >= latin * 3;
}
