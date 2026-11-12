import Link from 'next/link';
import { ArrowRight, Clapperboard, Clock, Coins, Images, Rabbit, Shapes, type LucideIcon } from 'lucide-react';
import { STATUS_LABEL, type FormatStatus, type VideoFormat } from '@/lib/video-formats';

export const FORMAT_ICONS: Record<string, LucideIcon> = {
  'animated-cartoon': Rabbit,
  'motion-graphics': Shapes,
  'image-voiceover': Images,
  'ai-cinematic': Clapperboard,
};

// Literal class strings so Tailwind keeps them.
export const ACCENT = {
  amber: {
    text: 'text-amber-300',
    soft: 'bg-amber-400/10',
    border: 'border-amber-400/25',
    ring: 'hover:border-amber-400/50',
    glow: 'from-amber-500/15',
    dot: 'bg-amber-400',
    button: 'bg-amber-400 text-slate-950 hover:bg-amber-300',
  },
  violet: {
    text: 'text-violet-300',
    soft: 'bg-violet-400/10',
    border: 'border-violet-400/25',
    ring: 'hover:border-violet-400/50',
    glow: 'from-violet-500/15',
    dot: 'bg-violet-400',
    button: 'bg-violet-400 text-slate-950 hover:bg-violet-300',
  },
  sky: {
    text: 'text-sky-300',
    soft: 'bg-sky-400/10',
    border: 'border-sky-400/25',
    ring: 'hover:border-sky-400/50',
    glow: 'from-sky-500/15',
    dot: 'bg-sky-400',
    button: 'bg-sky-400 text-slate-950 hover:bg-sky-300',
  },
  rose: {
    text: 'text-rose-300',
    soft: 'bg-rose-400/10',
    border: 'border-rose-400/25',
    ring: 'hover:border-rose-400/50',
    glow: 'from-rose-500/15',
    dot: 'bg-rose-400',
    button: 'bg-rose-400 text-slate-950 hover:bg-rose-300',
  },
} as const;

const STATUS_STYLE: Record<FormatStatus, string> = {
  live: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
  next: 'border-violet-400/30 bg-violet-400/10 text-violet-200',
  'needs-gpu': 'border-amber-400/30 bg-amber-400/10 text-amber-200',
  'paid-api': 'border-rose-400/30 bg-rose-400/10 text-rose-200',
};

export function StatusPill({ status }: { status: FormatStatus }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${STATUS_STYLE[status]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${status === 'live' ? 'bg-emerald-400' : 'bg-current opacity-70'}`} />
      {STATUS_LABEL[status]}
    </span>
  );
}

export function Meter({ label, value, dotClass }: { label: string; value: number; dotClass: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-slate-400">{label}</span>
      <span className="flex gap-1" aria-label={`${label} ${value} out of 5`}>
        {[1, 2, 3, 4, 5].map((n) => (
          <span key={n} className={`h-1.5 w-4 rounded-full ${n <= value ? dotClass : 'bg-slate-800'}`} />
        ))}
      </span>
    </div>
  );
}

export function FormatCard({ format, recommended = false }: { format: VideoFormat; recommended?: boolean }) {
  const accent = ACCENT[format.accent];
  const Icon = FORMAT_ICONS[format.id] || Shapes;
  const primaryHref = format.studioHref || `/formats/${format.id}#setup`;
  const primaryLabel = format.status === 'live' ? 'Create video' : 'Setup plan';

  return (
    <article
      className={`group relative flex h-full flex-col overflow-hidden rounded-3xl border border-white/[0.07] bg-[var(--panel)] p-5 transition ${accent.ring}`}
    >
      <div className={`pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b ${accent.glow} to-transparent`} />
      <div className="relative flex items-start justify-between gap-3">
        <span className={`grid h-11 w-11 place-items-center rounded-2xl border ${accent.border} ${accent.soft}`}>
          <Icon size={20} className={accent.text} />
        </span>
        <div className="flex flex-wrap justify-end gap-1.5">
          {recommended && (
            <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-slate-950">Start here</span>
          )}
          <StatusPill status={format.status} />
        </div>
      </div>

      <div className="relative mt-4">
        <p className={`text-[11px] font-semibold uppercase tracking-[0.2em] ${accent.text}`}>{format.shortName}</p>
        <h3 className="mt-1 text-lg font-bold leading-snug text-white">{format.name}</h3>
        <p className="mt-2 text-sm leading-6 text-slate-400">{format.tagline}</p>
      </div>

      <div className="relative mt-4 space-y-2 rounded-2xl border border-white/[0.06] bg-black/20 p-3">
        <Meter label="Viewer retention" value={format.retention} dotClass={accent.dot} />
        <Meter label="Automation" value={format.automation} dotClass={accent.dot} />
      </div>

      <dl className="relative mt-3 grid grid-cols-1 gap-2 text-xs">
        <div className="flex items-start gap-2 text-slate-400">
          <Coins size={14} className="mt-0.5 shrink-0 text-slate-500" />
          <dd>{format.costPerVideo}</dd>
        </div>
        <div className="flex items-start gap-2 text-slate-400">
          <Clock size={14} className="mt-0.5 shrink-0 text-slate-500" />
          <dd>{format.timePerVideo}</dd>
        </div>
      </dl>

      <div className="relative mt-3 flex flex-wrap gap-1.5">
        {format.bestFor.slice(0, 3).map((item) => (
          <span key={item} className="rounded-full border border-white/[0.07] bg-white/[0.03] px-2.5 py-1 text-[11px] text-slate-300">
            {item}
          </span>
        ))}
      </div>

      <div className="relative mt-auto flex gap-2 pt-5">
        <Link href={primaryHref} className={`inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-semibold transition ${accent.button}`}>
          {primaryLabel}
          <ArrowRight size={15} />
        </Link>
        <Link
          href={`/formats/${format.id}`}
          className="inline-flex items-center justify-center whitespace-nowrap rounded-xl border border-white/10 px-3 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.06]"
        >
          Playbook
        </Link>
      </div>
    </article>
  );
}

export function PageHeader({ eyebrow, title, description, children }: { eyebrow: string; title: string; description?: string; children?: React.ReactNode }) {
  return (
    <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[var(--accent)]">{eyebrow}</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-white md:text-4xl">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">{description}</p>}
      </div>
      {children && <div className="flex shrink-0 flex-wrap gap-2">{children}</div>}
    </header>
  );
}
