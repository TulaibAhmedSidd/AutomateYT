'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, Clapperboard, FolderOpen, Layers } from 'lucide-react';
import type { MotionSpec } from '@/lib/motion/spec';
import type { MotionSeries } from '@/lib/motion/series';

type Props = {
  /** Loads an episode into the editor. `check` lists facts to confirm before posting. */
  onOpen: (spec: MotionSpec, check?: string) => void;
  /** Changes whenever the render list changes, so "made" ticks stay current. */
  version: string;
};

const card = 'rounded-3xl border border-white/[0.07] bg-[var(--panel)] p-5';

function made(ep: MotionSeries['episodes'][number]) {
  return ep.job?.status.stage === 'done';
}

/** Ready-written motion graphics series: pick a series, then open an episode in the editor. */
export function MotionSeriesPanel({ onOpen, version }: Props) {
  const [series, setSeries] = useState<MotionSeries[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/motion/series', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => (d.error ? setError(d.error) : setSeries(d.series || [])))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, [version]);

  if (!series.length && !error) return null;
  const open = series.find((s) => s.id === openId);

  return (
    <section className={card}>
      {!open ? (
        <>
          <div className="flex items-center gap-2">
            <Layers size={18} className="text-[var(--accent)]" />
            <h2 className="font-display text-lg font-bold text-white">Series</h2>
          </div>
          <p className="mt-0.5 text-sm text-slate-400">Ready-written episodes. Open one, check it, then press Render.</p>
          {error && <p className="mt-2 text-sm text-rose-300">{error}</p>}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {series.map((s) => {
              const done = s.episodes.filter(made).length;
              return (
                <button
                  key={s.id}
                  onClick={() => setOpenId(s.id)}
                  className="rounded-2xl border border-white/10 bg-black/20 p-4 text-left transition hover:border-[var(--accent)]/50 hover:bg-white/[0.03]"
                >
                  <p className="font-bold text-white">{s.name}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-slate-400">{s.description}</p>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${(done / Math.max(1, s.episodes.length)) * 100}%` }} />
                  </div>
                  <p className="mt-1.5 text-[11px] text-slate-400">
                    {done} of {s.episodes.length} videos made
                  </p>
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <>
          <button onClick={() => setOpenId(null)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-slate-300 hover:bg-white/[0.06]">
            <ArrowLeft size={14} /> All series
          </button>
          <h2 className="mt-2 font-display text-lg font-bold text-white">{open.name}</h2>
          <p className="mt-0.5 text-sm text-slate-400">{open.description}</p>
          <ol className="mt-4 space-y-2">
            {open.episodes.map((ep) => {
              const st = ep.job?.status;
              const label = !st
                ? 'Not made yet'
                : st.stage === 'done'
                  ? '✅ Video ready (see Renders below)'
                  : st.stage === 'failed'
                    ? '⚠️ Last render failed'
                    : `⏳ Rendering ${Math.round(st.progress * 100)}%`;
              return (
                <li
                  key={ep.number}
                  className={`flex flex-wrap items-center gap-3 rounded-2xl border p-3 ${made(ep) ? 'border-emerald-400/25 bg-emerald-400/[0.04]' : 'border-white/[0.07] bg-black/20'}`}
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/10 text-sm font-bold text-white">{ep.number}</span>
                  <div className="min-w-[10rem] flex-1">
                    <p className="text-sm font-semibold text-white">{ep.spec.title}</p>
                    <p className={`text-[11px] ${made(ep) ? 'text-emerald-300' : 'text-slate-500'}`}>{label}</p>
                    {ep.check && <p className="mt-0.5 text-[11px] text-amber-300">Check before posting: {ep.check}</p>}
                  </div>
                  <button
                    onClick={() => onOpen(ep.spec, ep.check)}
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-[var(--accent)] px-3 text-xs font-bold text-slate-950 hover:brightness-110"
                  >
                    {made(ep) ? <FolderOpen size={14} /> : <Clapperboard size={14} />} Open
                  </button>
                </li>
              );
            })}
          </ol>
        </>
      )}
    </section>
  );
}
