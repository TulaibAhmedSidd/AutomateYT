// Script models with prices and measured token use, for cost estimates in the Studio. Browser-safe (no imports).
// Prices are US$ per 1 million tokens, from public price lists checked on 2026-11-13; check openai.com/api/pricing.
// Tokens per episode were measured on real episodes (2026-11-13: GPT-6.1 Sol averaged 700 in + 1,580 out over 24 episodes).

/** One script-writing model. `price` is null when no confirmed public price was found. */
export type ScriptModel = {
  id: string;
  label: string;
  note: string;
  price: { input: number; output: number } | null;
  outTokens: number;
};

/** Best first. */
export const SCRIPT_MODEL_INFO: ScriptModel[] = [
  { id: 'gpt-6.1-sol', label: 'GPT-6.1 Sol', note: 'Best stories and Urdu. Recommended.', price: { input: 2, output: 10 }, outTokens: 1580 },
  { id: 'gpt-6.1-terra', label: 'GPT-6.1 Terra', note: 'Good, a bit plainer. Price not confirmed.', price: null, outTokens: 1550 },
  { id: 'gpt-4o', label: 'GPT-4o', note: 'Older. Made spelling mistakes in Urdu.', price: { input: 2.5, output: 10 }, outTokens: 870 },
  { id: 'gpt-4o-mini', label: 'GPT-4o mini', note: 'Cheapest. Flat stories, weak Urdu.', price: { input: 0.15, output: 0.6 }, outTokens: 970 },
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', note: 'Needs a Gemini key. Not tested here.', price: { input: 0.3, output: 2.5 }, outTokens: 1000 },
];

const IN_TOKENS = 700;
/** About 1 in 5 episodes needs one retry (rule check), so estimates add 20%. */
const RETRY = 1.2;

/** Estimated tokens and US$ for writing `episodes` episodes with a model. cost is null when the price is unknown. */
export function scriptEstimate(modelId: string, episodes: number) {
  const m = SCRIPT_MODEL_INFO.find((x) => x.id === modelId) || SCRIPT_MODEL_INFO[0];
  const tokens = Math.round((IN_TOKENS + m.outTokens) * RETRY * episodes);
  const cost = m.price ? ((IN_TOKENS * m.price.input + m.outTokens * m.price.output) / 1_000_000) * RETRY * episodes : null;
  return { model: m, tokens, cost };
}

/** "$0.02" / "$5.40" / "under $0.01" / "price unknown". */
export function fmtCost(cost: number | null) {
  if (cost === null) return 'price unknown';
  if (cost < 0.01) return 'under $0.01';
  return `$${cost.toFixed(2)}`;
}

/** "45k tokens" / "1.2M tokens". */
export function fmtTokens(tokens: number) {
  return tokens >= 1_000_000 ? `${(tokens / 1_000_000).toFixed(1)}M tokens` : `${Math.round(tokens / 1000)}k tokens`;
}
