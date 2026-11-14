'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Circle, Clapperboard, Loader2, Square, XCircle } from 'lucide-react';
import type { CartoonEpisode } from '@/lib/cartoon/spec';
import type { EpisodeStatus } from '@/lib/cartoon/store';

const FILES = '/api/cartoon/files';

const STEP_LABEL = {
  voice: 'Voice',
  refs: 'Character pictures',
  pictures: 'AI pictures',
  clips: 'Moving clips',
  video: 'Join into MP4',
} as const;

const STAGE_TEXT: Record<string, string> = {
  queued: 'Starting…',
  voice: 'Getting the voice of every line',
  visuals: 'Making the pictures',
  bundle: 'Getting ready to join the video',
  render: 'Joining everything into the MP4',
};

function minutes(m: number) {
  if (m < 1) return 'less than a minute';
  if (m < 60) return `${Math.round(m)} min`;
  return `${Math.floor(m / 60)} h ${Math.round(m % 60)} min`;
}

type Props = {
  status: EpisodeStatus;
  episode: CartoonEpisode;
  /** Stops the render (the page calls DELETE /render and reloads the status). */
  onStop: () => Promise<void>;
};

/**
 * The live "what is happening now" panel while a video is made: overall %, minutes left, every step with
 * done/total, the line being worked on, and the pictures already made (they appear one by one).
 */
export function RenderProgress({ status, episode, onStop }: Props) {
  const [now, setNow] = useState(() => Date.now());
  const [stopping, setStopping] = useState(false);
  async function stop() {
    if (!window.confirm('Stop making this video?\n\nPictures and voices already made are kept. Press "Make the video" again later to continue from there.')) return;
    setStopping(true);
    try {
      await onStop();
    } finally {
      setStopping(false);
    }
  }
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const failed = status.stage === 'failed';
  const pct = Math.round((status.progress || 0) * 100);
  const ran = status.startedAt ? (now - Date.parse(status.startedAt)) / 60000 : 0;
  const steps = status.steps;
  const cur = status.current;
  const curFor = cur ? (now - Date.parse(cur.startedAt)) / 60000 : 0;
  const text = status.note || (failed ? 'Stopped' : STAGE_TEXT[status.stage] || status.stage);
  const order = (['voice', 'refs', 'pictures', 'clips', 'video'] as const).filter((k) => k === 'voice' || k === 'video' || (steps?.[k].total ?? 0) > 0);
  const version = encodeURIComponent(status.startedAt || '');

  return (
    <section
      aria-live="polite"
      className={`rounded-3xl border p-4 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)] backdrop-blur ${
        failed ? 'border-rose-400/40 bg-rose-950/60' : 'sticky top-2 z-30 border-[var(--accent)]/40 bg-[var(--panel)]/95'
      }`}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {failed ? <XCircle size={18} className="text-rose-300" /> : <Loader2 size={18} className="animate-spin text-[var(--accent)]" />}
        <p className="text-sm font-bold text-white">{failed ? 'Making the video stopped' : `Making the video · ${pct}%`}</p>
        {!failed && (
          <p className="ml-auto text-xs text-slate-400">
            {ran > 0 && `running ${minutes(ran)}`}
            {status.etaMin != null && ` · about ${minutes(status.etaMin)} left`}
          </p>
        )}
        {!failed && (
          <button
            onClick={stop}
            disabled={stopping}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-rose-400/50 bg-rose-500/10 px-3 text-xs font-bold text-rose-200 transition hover:bg-rose-500/20 disabled:opacity-50"
          >
            {stopping ? <Loader2 size={14} className="animate-spin" /> : <Square size={13} />} {stopping ? 'Stopping…' : 'Stop'}
          </button>
        )}
      </div>
      {!failed && (
        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-[var(--accent)] transition-all duration-700" style={{ width: `${Math.max(2, pct)}%` }} />
        </div>
      )}
      <p className={`mt-2 text-sm ${failed ? 'text-rose-200' : 'text-slate-200'}`}>
        {failed ? status.error || text : text}
        {!failed && cur && curFor >= 1 && !status.note?.includes('so far') && <span className="text-slate-400"> ({Math.floor(curFor)} min so far)</span>}
      </p>

      {steps && (
        <ol className="mt-3 flex flex-wrap gap-1.5">
          {order.map((k) => {
            const s = steps[k];
            const done = s.done >= s.total && s.total > 0;
            const active = !failed && !done && (k === 'video' ? ['bundle', 'render'].includes(status.stage) : s.done > 0 || cur?.what === (k === 'refs' ? 'reference' : k === 'pictures' ? 'picture' : k === 'clips' ? 'clip' : 'voice'));
            return (
              <li
                key={k}
                className={`inline-flex min-h-9 items-center gap-1.5 rounded-xl px-2.5 text-xs font-semibold ${
                  done ? 'bg-emerald-400/15 text-emerald-200' : active ? 'bg-[var(--accent)]/20 text-white' : 'bg-white/[0.04] text-slate-500'
                }`}
              >
                {done ? <CheckCircle2 size={14} /> : active ? <Loader2 size={14} className="animate-spin" /> : <Circle size={14} />}
                {STEP_LABEL[k]} {k === 'video' ? `${s.done}%` : `${s.done}/${s.total}`}
              </li>
            );
          })}
        </ol>
      )}

      <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
        {episode.shots.map((shot, i) => {
          const made = status.shots?.[shot.id]?.image === 'keyframe' || Boolean(shot.keyframe);
          const working = !failed && cur && cur.line === i + 1 && cur.what !== 'voice';
          const clip = status.shots?.[shot.id]?.clip === 'done';
          const src = `${FILES}/episodes/${episode.id}/keyframes/${shot.keyframe || `${shot.id}.png`}?v=${version}`;
          return (
            <a
              key={shot.id}
              href={made ? src : undefined}
              target="_blank"
              rel="noreferrer"
              title={`Line ${i + 1}${made ? ': picture ready (tap to open)' : working ? ': working on it now' : ''}`}
              className={`relative flex h-24 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border text-xs font-bold ${
                working ? 'border-[var(--accent)] text-[var(--accent)]' : made ? 'border-emerald-400/40' : 'border-white/10 text-slate-600'
              }`}
            >
              {made ? (
                // eslint-disable-next-line @next/next/no-img-element -- local file served by the app, size is tiny
                <img src={src} alt={`Line ${i + 1}`} className="h-full w-full object-cover" />
              ) : working ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                i + 1
              )}
              {clip && (
                <span className="absolute bottom-0.5 right-0.5 rounded bg-black/70 p-0.5 text-white">
                  <Clapperboard size={10} />
                </span>
              )}
            </a>
          );
        })}
      </div>
      <p className="mt-1 text-[11px] text-slate-500">
        {failed
          ? 'Pictures already made are kept. Press "Make the video" to continue from here.'
          : 'Pictures appear here as they are made. You can close this page; the PC keeps working.'}
      </p>
    </section>
  );
}
