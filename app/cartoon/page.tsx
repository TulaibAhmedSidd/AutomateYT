'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, Loader2, RefreshCw, XCircle } from 'lucide-react';
import { PageHeader } from '@/components/format-ui';
import { api, card, ghostBtn } from '@/components/cartoon/ui';
import { fmtCost, scriptEstimate } from '@/lib/cartoon/models';

type Row = {
  id: string;
  name: string;
  language: 'en' | 'ur';
  audience: 'kids' | 'general';
  group: string;
  why: string;
  characters: { name: string; reference?: string }[];
  planned: number;
  written: number;
  recorded: number;
  rendered: number;
};

const GROUPS: { id: string; title: string; note: string }[] = [
  { id: 'islamic', title: 'Islamic history (Urdu)', note: 'Child-friendly, peaceful history and science. No holy figures shown.' },
  { id: 'kids', title: 'Kids', note: 'Stories and facts for children and families.' },
  { id: 'grown-ups', title: 'Grown-ups', note: 'Family comedy for adults.' },
  { id: 'horror', title: 'Horror', note: 'Spooky Urdu stories with a twist. No gore.' },
  { id: 'transition', title: 'Transition videos', note: 'Short, fast before→after and evolution reels for Instagram and Shorts. No voice: add a trending sound in the app.' },
  { id: 'trending', title: 'Trending', note: 'Formats doing well on Shorts right now.' },
  { id: 'earning', title: 'Earning', note: 'Topics that advertisers pay more for.' },
  { id: 'mine', title: 'My other series', note: 'Starter series and series you made in the app.' },
];

function Bar({ value, total, className }: { value: number; total: number; className: string }) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
      <div className={`h-full ${className}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Series Library: every cartoon series with how many episodes are written, recorded and rendered. */
export default function CartoonSeriesPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    api<{ series: Row[] }>('/api/cartoon/library')
      .then((d) => setRows(d.series))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  };
  useEffect(() => {
    const t = window.setTimeout(load, 0);
    return () => window.clearTimeout(t);
  }, []);

  const totals = (rows || []).reduce(
    (t, r) => ({ planned: t.planned + r.planned, written: t.written + r.written, recorded: t.recorded + r.recorded, rendered: t.rendered + r.rendered }),
    { planned: 0, written: 0, recorded: 0, rendered: 0 },
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        eyebrow="Cartoon Studio"
        title="Your cartoon series"
        description="All your cartoon series. Tap a series to see every episode: which are done and which are left. Then record the lines in your voice and make the video."
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

      {!rows && !error && (
        <p className="flex items-center gap-2 text-sm text-slate-400">
          <Loader2 size={15} className="animate-spin" /> Loading…
        </p>
      )}

      {rows && (
        <section className={`${card} grid grid-cols-2 gap-3 sm:grid-cols-4`}>
          {[
            ['Episodes planned', totals.planned],
            ['Scripts written', totals.written],
            ['Fully recorded', totals.recorded],
            ['Videos made', totals.rendered],
          ].map(([k, v]) => (
            <div key={k} className="rounded-2xl bg-black/25 px-4 py-3">
              <p className="text-[11px] uppercase tracking-wider text-slate-500">{k}</p>
              <p className="mt-1 font-display text-2xl font-bold text-white">{v}</p>
            </div>
          ))}
        </section>
      )}

      {rows &&
        GROUPS.map((g) => {
          const list = rows.filter((r) => r.group === g.id || (g.id === 'mine' && !GROUPS.some((x) => x.id === r.group)));
          if (!list.length) return null;
          return (
            <section key={g.id}>
              <h2 className="font-display text-lg font-bold text-white">{g.title}</h2>
              <p className="text-sm text-slate-500">{g.note}</p>
              <ul className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {list.map((r) => (
                  <li key={r.id}>
                    <Link
                      href={`/cartoon/${r.id}`}
                      className="group flex h-full flex-col rounded-3xl border border-white/[0.07] bg-[var(--panel)] p-5 transition hover:border-[var(--accent)]/50"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-display text-base font-bold text-white">{r.name}</p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {r.language === 'ur' ? 'Urdu' : 'English'} · {r.audience === 'kids' ? 'Kids' : 'Everyone'}
                          </p>
                        </div>
                        <ArrowRight size={16} className="mt-1 shrink-0 text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-white" />
                      </div>
                      {r.why && <p className="mt-2 line-clamp-2 text-xs text-slate-400">{r.why}</p>}
                      {r.characters.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {r.characters.map((c) => (
                            <span key={c.name} className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] text-slate-300">
                              {c.name}
                            </span>
                          ))}
                        </div>
                      )}
                      {r.planned > r.written && (
                        <p className="mt-3 text-[11px] text-slate-500">
                          {r.planned - r.written} scripts left to write · about {fmtCost(scriptEstimate('gpt-6.1-sol', r.planned - r.written).cost)} with GPT-6.1 Sol, or{' '}
                          {fmtCost(scriptEstimate('gpt-4o-mini', r.planned - r.written).cost)} with GPT-4o mini
                        </p>
                      )}
                      <dl className="mt-auto space-y-2 pt-4 text-xs">
                        <div>
                          <div className="mb-1 flex justify-between text-slate-400">
                            <dt>📝 Scripts written</dt>
                            <dd className="font-semibold text-white">
                              {r.written}/{r.planned}
                            </dd>
                          </div>
                          <Bar value={r.written} total={r.planned} className="bg-sky-400" />
                        </div>
                        <div>
                          <div className="mb-1 flex justify-between text-slate-400">
                            <dt>🎙 Fully recorded</dt>
                            <dd className="font-semibold text-white">
                              {r.recorded}/{r.planned}
                            </dd>
                          </div>
                          <Bar value={r.recorded} total={r.planned} className="bg-amber-400" />
                        </div>
                        <div>
                          <div className="mb-1 flex justify-between text-slate-400">
                            <dt>🎬 Videos made</dt>
                            <dd className="font-semibold text-white">
                              {r.rendered}/{r.planned}
                            </dd>
                          </div>
                          <Bar value={r.rendered} total={r.planned} className="bg-emerald-400" />
                        </div>
                      </dl>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
    </div>
  );
}
