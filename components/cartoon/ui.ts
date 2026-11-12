// Shared styles and a small fetch helper for Cartoon Studio (same look as Motion Studio).

/** Text inputs, selects and textareas. */
export const field =
  'w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none transition focus:border-[var(--accent)]/60 focus:ring-2 focus:ring-[var(--accent)]/15';
/** Section cards. */
export const card = 'rounded-3xl border border-white/[0.07] bg-[var(--panel)] p-5';
/** Small uppercase labels above inputs. */
export const label = 'mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500';
/** Secondary buttons (at least 40 px tall for touch). */
export const ghostBtn =
  'inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:bg-white/[0.06] disabled:opacity-40';

/** Fetches JSON and throws the server's plain-English `error` message when the request fails. */
export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: 'no-store', ...init });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) throw new Error(data.error || `Request failed (${res.status})`);
  return data as T;
}

/** JSON body helper for api(). */
export function jsonBody(method: string, body: unknown): RequestInit {
  return { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) };
}

/** "3.4 s" / "1:05". */
export function fmtSeconds(s: number) {
  if (s < 60) return `${s.toFixed(1)} s`;
  return `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
}
