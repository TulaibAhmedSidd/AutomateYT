import Link from 'next/link';
import { ArrowUpRight, Images, MessageCircle, PlayCircle } from 'lucide-react';
import { PageHeader } from '@/components/format-ui';
import { REEL_INSIGHTS, VERDICT_LABEL, type ReelVerdict } from '@/lib/research';
import { getFormat } from '@/lib/video-formats';

export const metadata = { title: 'Reel research · AutoVid Studio' };

const VERDICT_STYLE: Record<ReelVerdict, string> = {
  useful: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
  'partly-true': 'border-amber-400/30 bg-amber-400/10 text-amber-200',
  misleading: 'border-rose-400/30 bg-rose-400/10 text-rose-200',
  'not-reviewed': 'border-white/10 bg-white/[0.03] text-slate-400',
};

export default function ResearchPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Research"
        title="Reel research"
        description="Instagram reels about YouTube automation, opened with the /reel skill: speech transcribed, every frame read, links and repos pulled out, then checked against the real repos."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {REEL_INSIGHTS.map((reel) => (
          <article key={reel.id} className="flex flex-col rounded-3xl border border-white/[0.07] bg-[var(--panel)] p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/[0.05] text-slate-300">
                  {reel.kind === 'carousel' ? <Images size={18} /> : <PlayCircle size={18} />}
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">{reel.creator}</p>
                  <p className="text-xs text-slate-500">{[reel.date, reel.stats].filter(Boolean).join(' · ')}</p>
                </div>
              </div>
              <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${VERDICT_STYLE[reel.verdict]}`}>{VERDICT_LABEL[reel.verdict]}</span>
            </div>

            <div className="mt-4 space-y-3 text-sm leading-6">
              <p className="text-slate-300"><span className="font-semibold text-slate-100">Claim: </span>{reel.claim}</p>
              <p className="text-slate-400"><span className="font-semibold text-slate-200">What it really is: </span>{reel.whatItReallyIs}</p>
              <p className="rounded-2xl border border-white/[0.06] bg-black/20 p-3 text-slate-300"><span className="font-semibold text-white">Takeaway: </span>{reel.takeaway}</p>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              {reel.tools.map((tool) =>
                tool.url ? (
                  <a key={tool.name} href={tool.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2.5 py-1 text-xs text-slate-200 hover:bg-white/[0.06]">
                    {tool.name} <ArrowUpRight size={11} />
                  </a>
                ) : (
                  <span key={tool.name} className="rounded-full border border-white/[0.06] px-2.5 py-1 text-xs text-slate-400">{tool.name}</span>
                )
              )}
              {reel.commentBait && (
                <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.04] px-2.5 py-1 text-xs text-slate-400">
                  <MessageCircle size={11} /> Comment-bait: &ldquo;{reel.commentBait}&rdquo;
                </span>
              )}
            </div>

            <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-5">
              <div className="flex flex-wrap gap-2">
                {reel.formatIds.map((id) => {
                  const f = getFormat(id);
                  return f ? (
                    <Link key={id} href={`/formats/${id}`} className="text-xs font-semibold text-[var(--accent)] hover:underline">
                      {f.shortName}
                    </Link>
                  ) : null;
                })}
              </div>
              <a href={reel.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-white">
                Open on Instagram <ArrowUpRight size={12} />
              </a>
            </div>
          </article>
        ))}
      </div>

      <section className="rounded-3xl border border-dashed border-white/10 p-5 text-sm leading-6 text-slate-400">
        <p className="font-semibold text-slate-200">Add a new reel</p>
        <p className="mt-1">
          Paste the link to Claude: the <code className="rounded bg-white/[0.06] px-1.5 py-0.5 text-slate-200">/reel</code> skill downloads it, transcribes Urdu/Hindi speech in Urdu script, reads the frames and reports the tools, links and verdict. Age-restricted or private reels need you to save the mp4 first.
        </p>
      </section>
    </div>
  );
}
