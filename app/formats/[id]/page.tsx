import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight, ArrowUpRight, CheckCircle2, Circle, Clock, Coins, Cpu, ShieldAlert, Telescope, Target } from 'lucide-react';
import { ACCENT, FORMAT_ICONS, Meter, StatusPill } from '@/components/format-ui';
import { getFormat, VIDEO_FORMATS } from '@/lib/video-formats';
import { REEL_INSIGHTS, VERDICT_LABEL } from '@/lib/research';

export function generateStaticParams() {
  return VIDEO_FORMATS.map((format) => ({ id: format.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const format = getFormat(id);
  return { title: format ? `${format.name} · AutoVid Studio` : 'Format · AutoVid Studio' };
}

export default async function FormatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const format = getFormat(id);
  if (!format) notFound();

  const accent = ACCENT[format.accent];
  const Icon = FORMAT_ICONS[format.id];
  const reels = REEL_INSIGHTS.filter((reel) => reel.formatIds.includes(format.id));
  const doneCount = format.setup.filter((s) => s.done).length;

  return (
    <div className="space-y-8">
      <Link href="/formats" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white">
        <ArrowLeft size={15} /> All formats
      </Link>

      {/* Hero */}
      <section className={`relative overflow-hidden rounded-3xl border ${accent.border} bg-[var(--panel)] p-6 md:p-8`}>
        <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${accent.glow} to-transparent`} />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-3">
              <span className={`grid h-12 w-12 place-items-center rounded-2xl border ${accent.border} ${accent.soft}`}>
                <Icon size={22} className={accent.text} />
              </span>
              <StatusPill status={format.status} />
            </div>
            <h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-white md:text-4xl">{format.name}</h1>
            <p className="mt-3 text-base leading-7 text-slate-300">{format.tagline}</p>
          </div>
          <div className="w-full shrink-0 space-y-2 rounded-2xl border border-white/[0.07] bg-black/30 p-4 lg:w-72">
            <Meter label="Viewer retention" value={format.retention} dotClass={accent.dot} />
            <Meter label="Automation" value={format.automation} dotClass={accent.dot} />
            <p className="flex items-start gap-2 pt-2 text-xs text-slate-400"><Coins size={14} className="mt-0.5 shrink-0" />{format.costPerVideo}</p>
            <p className="flex items-start gap-2 text-xs text-slate-400"><Clock size={14} className="mt-0.5 shrink-0" />{format.timePerVideo}</p>
            {format.studioHref && (
              <Link href={format.studioHref} className={`mt-3 flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold ${accent.button}`}>
                Create video <ArrowRight size={15} />
              </Link>
            )}
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          {/* Why */}
          <section className="rounded-3xl border border-white/[0.07] bg-[var(--panel)] p-6">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-white"><Target size={18} className={accent.text} /> Why it works</h2>
            <p className="mt-3 text-sm leading-7 text-slate-300">{format.whyItWorks}</p>
            <p className="mt-4 rounded-2xl border border-white/[0.06] bg-black/20 p-4 text-sm leading-6 text-slate-400">
              <span className="font-semibold text-slate-200">Evidence: </span>{format.evidence}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {format.bestFor.map((item) => (
                <span key={item} className="rounded-full border border-white/[0.07] bg-white/[0.03] px-3 py-1 text-xs text-slate-300">{item}</span>
              ))}
            </div>
          </section>

          {/* Pipeline */}
          <section className="rounded-3xl border border-white/[0.07] bg-[var(--panel)] p-6">
            <h2 className="font-display text-lg font-bold text-white">Production pipeline</h2>
            <ol className="relative mt-5 space-y-5 border-l border-white/[0.08] pl-6">
              {format.pipeline.map((p, i) => (
                <li key={p.step} className="relative">
                  <span className={`absolute -left-[37px] grid h-6 w-6 place-items-center rounded-full border ${accent.border} bg-[var(--panel)] text-[11px] font-bold ${accent.text}`}>{i + 1}</span>
                  <p className="text-sm font-semibold text-white">{p.step}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-400">{p.detail}</p>
                </li>
              ))}
            </ol>
          </section>

          {/* Engines */}
          {format.engines && (
            <section className="rounded-3xl border border-white/[0.07] bg-[var(--panel)] p-6">
              <h2 className="flex items-center gap-2 font-display text-lg font-bold text-white"><Cpu size={18} className={accent.text} /> Where to render</h2>
              <div className="mt-4 grid gap-3">
                {format.engines.map((engine) => (
                  <div key={engine.name} className="rounded-2xl border border-white/[0.06] bg-black/20 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-white">{engine.name}</p>
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${engine.fitsThisPc ? 'bg-emerald-400/10 text-emerald-300' : 'bg-rose-400/10 text-rose-300'}`}>
                        {engine.fitsThisPc ? 'Works from this PC' : 'Not on this PC'}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-400">{engine.verdict}</p>
                    <p className="mt-1 text-xs text-slate-500">{engine.cost}</p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="space-y-6">
          {/* Setup */}
          <section id="setup" className="scroll-mt-24 rounded-3xl border border-white/[0.07] bg-[var(--panel)] p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-white">Setup checklist</h2>
              <span className="text-xs text-slate-500">{doneCount}/{format.setup.length} done</span>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
              <div className={`h-full ${accent.dot}`} style={{ width: `${(doneCount / format.setup.length) * 100}%` }} />
            </div>
            <ul className="mt-4 space-y-3">
              {format.setup.map((s) => (
                <li key={s.item} className="flex items-start gap-3 text-sm">
                  {s.done ? <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-emerald-400" /> : <Circle size={17} className="mt-0.5 shrink-0 text-slate-600" />}
                  <span className={s.done ? 'text-slate-400 line-through decoration-slate-600' : 'text-slate-200'}>{s.item}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Tools */}
          <section className="rounded-3xl border border-white/[0.07] bg-[var(--panel)] p-6">
            <h2 className="font-display text-lg font-bold text-white">Tool stack</h2>
            <ul className="mt-4 divide-y divide-white/[0.05]">
              {format.tools.map((tool) => (
                <li key={tool.name} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between gap-2">
                    {tool.link ? (
                      <a href={tool.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-white hover:underline">
                        {tool.name} <ArrowUpRight size={13} />
                      </a>
                    ) : (
                      <span className="text-sm font-semibold text-white">{tool.name}</span>
                    )}
                    <span className="text-right text-xs text-slate-500">{tool.cost}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">{tool.role}</p>
                </li>
              ))}
            </ul>
          </section>

          {/* Risks */}
          <section className="rounded-3xl border border-white/[0.07] bg-[var(--panel)] p-6">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-white"><ShieldAlert size={18} className="text-rose-300" /> Watch out</h2>
            <ul className="mt-3 space-y-3">
              {format.risks.map((risk) => (
                <li key={risk} className="text-sm leading-6 text-slate-400">{risk}</li>
              ))}
            </ul>
          </section>

          {reels.length > 0 && (
            <section className="rounded-3xl border border-white/[0.07] bg-[var(--panel)] p-6">
              <h2 className="flex items-center gap-2 font-display text-lg font-bold text-white"><Telescope size={18} className={accent.text} /> Source reels</h2>
              <ul className="mt-3 space-y-3">
                {reels.map((reel) => (
                  <li key={reel.id}>
                    <a href={reel.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-slate-200 hover:underline">
                      {reel.creator} <ArrowUpRight size={13} />
                    </a>
                    <span className="ml-2 text-xs text-slate-500">{VERDICT_LABEL[reel.verdict]}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
