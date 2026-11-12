'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, FilePlus2, Loader2, Mic, PenLine, Play, XCircle } from 'lucide-react';
import { api, card, field, ghostBtn, jsonBody, label } from '@/components/cartoon/ui';
import { SCRIPT_MODEL_INFO, fmtCost, fmtTokens, scriptEstimate } from '@/lib/cartoon/models';
import type { CartoonSeries } from '@/lib/cartoon/spec';
import type { EpisodeSummary } from '@/lib/cartoon/store';

type Slot = { number: number; topic: string; episode: EpisodeSummary | null };
type Data = { series: CartoonSeries; group: string; why: string; model: string; slots: Slot[] };

/** What one episode slot shows: its state, a colour and the next action. */
function slotState(s: Slot) {
  const e = s.episode;
  if (!e) return { kind: 'unwritten' as const, label: 'No script yet', tone: 'text-slate-500' };
  if (e.status.stage === 'done') return { kind: 'done' as const, label: `✅ Video ready · ${e.recorded}/${e.shots} lines in your voice`, tone: 'text-emerald-300' };
  if (!['idle', 'failed'].includes(e.status.stage)) return { kind: 'working' as const, label: `⏳ Rendering ${Math.round(e.status.progress * 100)}%`, tone: 'text-sky-300' };
  if (e.status.stage === 'failed') return { kind: 'working' as const, label: '⚠️ Render failed, open to see why', tone: 'text-rose-300' };
  if (e.shots > 0 && e.recorded === e.shots) return { kind: 'working' as const, label: '🎙 All lines recorded · render next', tone: 'text-amber-300' };
  if (e.recorded > 0) return { kind: 'working' as const, label: `🎙 ${e.recorded}/${e.shots} lines recorded`, tone: 'text-amber-200' };
  return { kind: 'script' as const, label: `📝 Script ready · ${e.shots} lines to record`, tone: 'text-slate-400' };
}

/** One series: every planned episode, what is done and what is left. */
export default function SeriesPage() {
  const { seriesId } = useParams<{ seriesId: string }>();
  const router = useRouter();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [model, setModel] = useState('gpt-6.1-sol');
  const [writing, setWriting] = useState<number | null>(null);

  const load = useCallback(() => {
    api<Data>(`/api/cartoon/library/${seriesId}`)
      .then(setData)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, [seriesId]);
  useEffect(() => {
    const t = window.setTimeout(load, 0);
    return () => window.clearTimeout(t);
  }, [load]);

  const studio = (episodeId?: string) => `/cartoon/studio?series=${seriesId}${episodeId ? `&episode=${episodeId}` : ''}`;

  async function writeScript(n: number) {
    const est = scriptEstimate(model, 1);
    if (!window.confirm(`Write the script for episode ${n} with ${est.model.label}? Cost: about ${fmtCost(est.cost)} of OpenAI credit.`)) return;
    setError(null);
    setWriting(n);
    try {
      const { id } = await api<{ id: string }>(`/api/cartoon/library/${seriesId}/write`, jsonBody('POST', { number: n, model }));
      load();
      router.push(studio(id));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setWriting(null);
    }
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <Link href="/cartoon" className={ghostBtn}>
          <ArrowLeft size={14} /> All series
        </Link>
        {error ? <p className="text-sm text-rose-300">{error}</p> : <Loader2 className="animate-spin text-slate-500" />}
      </div>
    );
  }

  const { series, slots } = data;
  const total = slots.length;
  const done = slots.filter((s) => slotState(s).kind === 'done').length;
  const written = slots.filter((s) => s.episode).length;
  const unwritten = total - written;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link href="/cartoon" className={ghostBtn}>
        <ArrowLeft size={14} /> All series
      </Link>

      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
          {series.language === 'ur' ? 'Urdu' : 'English'} · {series.audience === 'kids' ? 'Kids' : 'Everyone'} · {series.episodeSeconds}s episodes
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold text-white">{series.name}</h1>
        {data.why && <p className="mt-2 max-w-3xl text-sm text-slate-400">{data.why}</p>}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {series.characters.map((c) => (
            <span key={c.id} className="rounded-full bg-white/[0.06] px-2.5 py-1 text-xs text-slate-300">
              {c.name}
            </span>
          ))}
        </div>
      </header>

      {error && (
        <div className="flex items-start gap-2 rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
          <XCircle size={16} className="mt-0.5 shrink-0" /> {error}
        </div>
      )}

      <section className={`${card} grid gap-4 sm:grid-cols-3`}>
        {[
          ['🎬 Videos made', done, 'bg-emerald-400'],
          ['📝 Scripts written', written, 'bg-sky-400'],
          ['⬜ Still to make', total - done, 'bg-white/30'],
        ].map(([k, v, c]) => (
          <div key={String(k)}>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">{k}</span>
              <span className="font-semibold text-white">
                {v}/{total}
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
              <div className={`h-full ${c}`} style={{ width: `${total ? (Number(v) / total) * 100 : 0}%` }} />
            </div>
          </div>
        ))}
      </section>

      <section className={card}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <label className="min-w-[240px] flex-1">
            <span className={label}>AI model for writing scripts</span>
            <select className={field} value={model} onChange={(e) => setModel(e.target.value)}>
              {SCRIPT_MODEL_INFO.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}: {fmtCost(scriptEstimate(m.id, 1).cost)} per episode · {m.note}
                </option>
              ))}
            </select>
          </label>
          <Link href={studio()} className={ghostBtn}>
            <FilePlus2 size={14} /> New episode from my own idea
          </Link>
        </div>
        {unwritten > 0 && (
          <div className="mt-4 rounded-2xl bg-black/25 p-3 text-xs text-slate-400">
            <p className="font-semibold text-slate-200">Cost to write the {unwritten} scripts not written yet:</p>
            <ul className="mt-1.5 grid gap-1 sm:grid-cols-2">
              {SCRIPT_MODEL_INFO.map((m) => {
                const est = scriptEstimate(m.id, unwritten);
                return (
                  <li key={m.id}>
                    {m.label}: <b className="text-slate-200">{fmtCost(est.cost)}</b> ({fmtTokens(est.tokens)})
                  </li>
                );
              })}
            </ul>
            <p className="mt-1.5">Scripts are only written when you press “Write script” on an episode. Prices: OpenAI list prices, November 2026.</p>
          </div>
        )}
      </section>

      <section>
        <h2 className="font-display text-lg font-bold text-white">Episodes</h2>
        <ol className="mt-3 space-y-2">
          {slots.map((s) => {
            const st = slotState(s);
            const dim = st.kind === 'unwritten' ? 'opacity-50' : st.kind === 'done' ? '' : 'opacity-90';
            return (
              <li
                key={s.number}
                className={`flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-3 ${
                  st.kind === 'done' ? 'border-emerald-400/30 bg-emerald-400/[0.06]' : 'border-white/[0.07] bg-[var(--panel)]'
                } ${dim}`}
              >
                <span
                  className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-sm font-bold ${
                    st.kind === 'done' ? 'bg-emerald-400 text-slate-950' : 'bg-white/[0.06] text-slate-300'
                  }`}
                >
                  {st.kind === 'done' ? <CheckCircle2 size={18} /> : s.number}
                </span>
                <div className="min-w-0 flex-1">
                  <p dir="auto" className="text-sm font-semibold text-white">
                    Episode {s.number}: {s.episode?.title || s.topic.split(/[.:]/)[0]}
                  </p>
                  <p className={`mt-0.5 text-xs ${st.tone}`}>{st.label}</p>
                </div>
                {st.kind === 'unwritten' ? (
                  <button className={ghostBtn} onClick={() => writeScript(s.number)} disabled={writing !== null}>
                    {writing === s.number ? <Loader2 size={14} className="animate-spin" /> : <PenLine size={14} />}
                    {writing === s.number ? 'Writing…' : `Write script (${fmtCost(scriptEstimate(model, 1).cost)})`}
                  </button>
                ) : (
                  <Link
                    href={studio(s.episode!.id)}
                    className={
                      st.kind === 'done'
                        ? ghostBtn
                        : 'inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-[var(--accent)] px-3 text-xs font-bold text-slate-950 transition hover:brightness-110'
                    }
                  >
                    {st.kind === 'done' ? <Play size={14} /> : <Mic size={14} />}
                    {st.kind === 'done' ? 'Watch' : 'Record & make'}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
