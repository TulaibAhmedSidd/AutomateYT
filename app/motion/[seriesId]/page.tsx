'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, CalendarClock, CheckCircle2, Clapperboard, Loader2, PlaySquare, XCircle } from 'lucide-react';
import { episodeState, fmtWhen } from '@/components/motion/episodeState';
import type { MotionSeries } from '@/lib/motion/series';

const card = 'rounded-3xl border border-white/[0.07] bg-[var(--panel)] p-5';
const ghostBtn =
  'inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:bg-white/[0.06]';

/** One motion series: every episode, what is made, what is on YouTube, and what to do next. */
export default function MotionSeriesPage() {
  const { seriesId } = useParams<{ seriesId: string }>();
  const [series, setSeries] = useState<MotionSeries | null>(null);
  const [nextSlot, setNextSlot] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch('/api/motion/series', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d: { series?: MotionSeries[]; nextSlot?: string; error?: string }) => {
        if (d.error) return setError(d.error);
        const s = d.series?.find((x) => x.id === seriesId);
        if (!s) return setError('Series not found');
        setSeries(s);
        setNextSlot(d.nextSlot || null);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, [seriesId]);
  useEffect(() => {
    const t = window.setTimeout(load, 0);
    return () => window.clearTimeout(t);
  }, [load]);
  // Keep rendering episodes up to date.
  useEffect(() => {
    if (!series?.episodes.some((e) => episodeState(e).kind === 'working')) return;
    const t = window.setInterval(load, 3000);
    return () => window.clearInterval(t);
  }, [series, load]);

  if (!series) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <Link href="/motion" className={ghostBtn}>
          <ArrowLeft size={14} /> All series
        </Link>
        {error ? <p className="text-sm text-rose-300">{error}</p> : <Loader2 className="animate-spin text-slate-500" />}
      </div>
    );
  }

  const states = series.episodes.map(episodeState);
  const total = states.length;
  const made = states.filter((x) => ['ready', 'posted', 'scheduled'].includes(x.kind)).length;
  const posted = states.filter((x) => ['posted', 'scheduled'].includes(x.kind)).length;
  const nextToMake = series.episodes.find((_, i) => ['todo', 'failed'].includes(states[i].kind));
  const nextToPost = series.episodes.find((_, i) => states[i].kind === 'ready');

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link href="/motion" className={ghostBtn}>
        <ArrowLeft size={14} /> All series
      </Link>

      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
          Motion graphics · {series.language === 'ur' ? 'Urdu' : 'English'} · {total} episodes
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold text-white">{series.name}</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">{series.description}</p>
      </header>

      {error && (
        <div className="flex items-start gap-2 rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
          <XCircle size={16} className="mt-0.5 shrink-0" /> {error}
        </div>
      )}

      <section className={`${card} grid gap-4 sm:grid-cols-3`}>
        {[
          ['🎬 Videos made', made, 'bg-emerald-400'],
          ['▶ On YouTube', posted, 'bg-red-500'],
          ['⬜ Still to make', total - made, 'bg-white/30'],
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

      <section className={`${card} space-y-2 text-sm`}>
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--accent)]">What to do next</p>
        {nextToPost && (
          <p className="text-slate-200">
            <PlaySquare size={14} className="mr-1 inline text-red-400" /> Post <b>episode {nextToPost.number}</b> on YouTube
            {nextSlot ? (
              <>
                {' '}
                at <b className="text-white">{fmtWhen(nextSlot)}</b>
              </>
            ) : null}
            .
          </p>
        )}
        {nextToMake && (
          <p className="text-slate-200">
            <Clapperboard size={14} className="mr-1 inline text-[var(--accent)]" /> Make <b>episode {nextToMake.number}</b>: {nextToMake.spec.title}.
          </p>
        )}
        {!nextToPost && !nextToMake && <p className="text-emerald-300">Every episode is made and on YouTube. 🎉</p>}
        {nextSlot && (
          <p className="flex items-center gap-1.5 text-xs text-slate-500">
            <CalendarClock size={13} /> Next free YouTube slot: {fmtWhen(nextSlot)} (change the posting plan in Step 4 of any episode).
          </p>
        )}
      </section>

      <section>
        <h2 className="font-display text-lg font-bold text-white">Episodes</h2>
        <ol className="mt-3 space-y-2">
          {series.episodes.map((ep, i) => {
            const st = states[i];
            const good = ['ready', 'posted', 'scheduled'].includes(st.kind);
            return (
              <li
                key={ep.number}
                className={`flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-3 ${
                  good ? 'border-emerald-400/30 bg-emerald-400/[0.06]' : 'border-white/[0.07] bg-[var(--panel)]'
                } ${st.kind === 'todo' ? 'opacity-80' : ''}`}
              >
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-sm font-bold ${good ? 'bg-emerald-400 text-slate-950' : 'bg-white/[0.06] text-slate-300'}`}>
                  {st.kind === 'posted' || st.kind === 'scheduled' ? <CheckCircle2 size={18} /> : ep.number}
                </span>
                <div className="min-w-[12rem] flex-1">
                  <p className="text-sm font-semibold text-white">
                    Episode {ep.number}: {ep.spec.title}
                  </p>
                  <p className={`mt-0.5 text-xs ${st.tone}`}>{st.label}</p>
                  {ep.check && !good && <p className="mt-0.5 text-[11px] text-amber-300/90">Check before posting: {ep.check}</p>}
                  {ep.post?.url && (
                    <a href={ep.post.url} target="_blank" rel="noreferrer" className="mt-0.5 inline-block text-[11px] text-sky-300 underline">
                      Open on YouTube
                    </a>
                  )}
                </div>
                <Link
                  href={`/motion/studio?series=${series.id}&episode=${ep.number}`}
                  className={
                    st.kind === 'todo' || st.kind === 'failed' || st.kind === 'ready'
                      ? 'inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-[var(--accent)] px-3 text-xs font-bold text-slate-950 transition hover:brightness-110'
                      : ghostBtn
                  }
                >
                  {st.kind === 'ready' ? (
                    <>
                      <PlaySquare size={14} /> Post on YouTube
                    </>
                  ) : st.kind === 'todo' || st.kind === 'failed' ? (
                    <>
                      <Clapperboard size={14} /> Make video
                    </>
                  ) : (
                    'Open'
                  )}
                </Link>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
