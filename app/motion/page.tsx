'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, CalendarClock, Loader2, PenLine, RefreshCw, XCircle } from 'lucide-react';
import { PageHeader } from '@/components/format-ui';
import { episodeState, fmtWhen } from '@/components/motion/episodeState';
import type { MotionSeries } from '@/lib/motion/series';

const card = 'rounded-3xl border border-white/[0.07] bg-[var(--panel)] p-5';
const ghostBtn =
  'inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:bg-white/[0.06]';

function Bar({ value, total, className }: { value: number; total: number; className: string }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
      <div className={`h-full ${className}`} style={{ width: `${total ? (value / total) * 100 : 0}%` }} />
    </div>
  );
}

/** Motion Studio home: every motion series with how many videos are made and posted, and a single-video start. */
export default function MotionHomePage() {
  const [data, setData] = useState<{ series: MotionSeries[]; nextSlot: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    fetch('/api/motion/series', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => (d.error ? setError(d.error) : setData(d)))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  };
  useEffect(() => {
    const t = window.setTimeout(load, 0);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        eyebrow="Motion graphics"
        title="Motion Studio"
        description="Pick a series to see every episode: which videos are made, which are on YouTube, and what is next. Or make a single video from your own idea."
      >
        <button className={ghostBtn} onClick={load}>
          <RefreshCw size={13} /> Refresh
        </button>
      </PageHeader>

      {error && (
        <div className="flex items-start gap-2 rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
          <XCircle size={16} className="mt-0.5 shrink-0" /> {error}
        </div>
      )}
      {!data && !error && (
        <p className="flex items-center gap-2 text-sm text-slate-400">
          <Loader2 size={15} className="animate-spin" /> Loading…
        </p>
      )}

      {data?.nextSlot && (
        <p className={`${card} flex items-center gap-2 py-4 text-sm text-slate-300`}>
          <CalendarClock size={17} className="text-[var(--accent)]" /> Next YouTube upload should go up: <b className="text-white">{fmtWhen(data.nextSlot)}</b>
        </p>
      )}

      {data && (
        <section>
          <h2 className="font-display text-lg font-bold text-white">Series</h2>
          <p className="text-sm text-slate-500">Ready-written episodes. Tap a series to open its episodes.</p>
          <ul className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {data.series.map((s) => {
              const total = s.episodes.length;
              const states = s.episodes.map(episodeState);
              const made = states.filter((x) => ['ready', 'posted', 'scheduled'].includes(x.kind)).length;
              const posted = states.filter((x) => ['posted', 'scheduled'].includes(x.kind)).length;
              return (
                <li key={s.id}>
                  <Link
                    href={`/motion/${s.id}`}
                    className="group flex h-full flex-col rounded-3xl border border-white/[0.07] bg-[var(--panel)] p-5 transition hover:border-[var(--accent)]/50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-display text-base font-bold text-white">{s.name}</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {s.language === 'ur' ? 'Urdu' : 'English'} · {total} episodes
                        </p>
                      </div>
                      <ArrowRight size={16} className="mt-1 shrink-0 text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-white" />
                    </div>
                    <p className="mt-2 line-clamp-3 text-xs text-slate-400">{s.description}</p>
                    <dl className="mt-auto space-y-2 pt-4 text-xs">
                      <div>
                        <div className="mb-1 flex justify-between text-slate-400">
                          <dt>🎬 Videos made</dt>
                          <dd className="font-semibold text-white">
                            {made}/{total}
                          </dd>
                        </div>
                        <Bar value={made} total={total} className="bg-emerald-400" />
                      </div>
                      <div>
                        <div className="mb-1 flex justify-between text-slate-400">
                          <dt>▶ On YouTube (posted or scheduled)</dt>
                          <dd className="font-semibold text-white">
                            {posted}/{total}
                          </dd>
                        </div>
                        <Bar value={posted} total={total} className="bg-red-500" />
                      </div>
                    </dl>
                  </Link>
                </li>
              );
            })}
            <li>
              <Link
                href="/motion/studio"
                className="group flex h-full min-h-48 flex-col justify-between rounded-3xl border border-dashed border-white/15 p-5 transition hover:border-[var(--accent)]/50"
              >
                <div>
                  <p className="flex items-center gap-2 font-display text-base font-bold text-white">
                    <PenLine size={16} className="text-violet-300" /> Single video
                  </p>
                  <p className="mt-2 text-xs text-slate-400">Your own idea: write the scenes yourself, start from a template, or let AI write them.</p>
                </div>
                <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent)]">
                  Start <ArrowRight size={14} />
                </span>
              </Link>
            </li>
          </ul>
        </section>
      )}
    </div>
  );
}
