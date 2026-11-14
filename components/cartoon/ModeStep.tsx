'use client';

import { useEffect, useState } from 'react';
import { Clapperboard, Film, Image as ImageIcon } from 'lucide-react';
import { GPU_MINUTES, RENDER_MODES, keyShotIds, type CartoonEpisode, type RenderMode } from '@/lib/cartoon/spec';
import { api } from './ui';

/** What the studio knows about ComfyUI on this PC. */
export type ComfyStatus = { reachable: boolean; url: string; gpu: string | null; canAutoStart: boolean; workflows: { clip: boolean; keyframe: boolean } };

type Props = {
  episode: CartoonEpisode;
  mode: RenderMode;
  onMode: (m: RenderMode) => void;
  onToggleAnimate: (shotId: string) => void;
  onStatus: (s: ComfyStatus | null) => void;
  /** True when a line has its own picture or a character picture (needed to start a moving clip). */
  hasPicture: (shotId: string) => boolean;
};

const ICONS = { pictures: ImageIcon, 'key-shots': Film, animated: Clapperboard } as const;

/** Rough minutes on the home GPU for an episode in a mode (2-second clip measured at 21 min; picture estimated). */
export function estimateMinutes(ep: CartoonEpisode, mode: RenderMode, comfy: ComfyStatus | null) {
  const gpu = Boolean(comfy && (comfy.reachable || comfy.canAutoStart));
  const pictures = gpu && comfy?.workflows.keyframe ? ep.shots.filter((s) => !s.keyframe).length : 0;
  const clips = mode === 'animated' ? ep.shots.length : mode === 'key-shots' ? keyShotIds(ep).length : 0;
  return { minutes: pictures * GPU_MINUTES.picture + clips * GPU_MINUTES.clip + 3, pictures, clips };
}

function fmt(min: number) {
  return min < 60 ? `about ${Math.round(min)} min` : `about ${(min / 60).toFixed(1)} hours`;
}

/** Step 2 of an episode: choose how the pictures are made, with tabs, time estimates and the GPU status. */
export function ModeStep({ episode, mode, onMode, onToggleAnimate, onStatus, hasPicture }: Props) {
  const [comfy, setComfy] = useState<ComfyStatus | null>(null);
  useEffect(() => {
    api<ComfyStatus>('/api/cartoon/comfy')
      .then((s) => {
        setComfy(s);
        onStatus(s);
      })
      .catch(() => onStatus(null));
  }, [onStatus]);

  const gpuOk = Boolean(comfy && (comfy.reachable || comfy.canAutoStart));
  const current = RENDER_MODES.find((m) => m.id === mode)!;
  const est = estimateMinutes(episode, mode, comfy);
  const keyIds = new Set(keyShotIds(episode));
  const animated = mode === 'animated' ? episode.shots.map((s) => s.id) : mode === 'key-shots' ? [...keyIds] : [];
  const noPicture = animated.filter((id) => !hasPicture(id)).length;

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-black/20 p-4">
      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--accent)]">Step 2 · Video type</p>
      <div role="tablist" className="mt-3 grid grid-cols-3 gap-1 rounded-2xl bg-black/30 p-1">
        {RENDER_MODES.map((m) => {
          const Icon = ICONS[m.id];
          return (
            <button
              key={m.id}
              role="tab"
              aria-selected={mode === m.id}
              onClick={() => onMode(m.id)}
              className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-2 text-center text-xs font-semibold transition ${
                mode === m.id ? 'bg-[var(--accent)] text-slate-950' : 'text-slate-400 hover:bg-white/[0.06] hover:text-white'
              }`}
            >
              <Icon size={16} />
              {m.label}
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-sm text-slate-300">{current.note}</p>
      <p className="mt-1 text-xs text-slate-400">
        Time on the GPU PC: <b className="text-slate-200">{fmt(est.minutes)}</b>
        {est.pictures > 0 && ` · ${est.pictures} AI pictures`}
        {est.clips > 0 && ` · ${est.clips} moving clips (≈${GPU_MINUTES.clip} min each)`}
      </p>

      {mode === 'key-shots' && (
        <div className="mt-3">
          <p className="text-xs text-slate-400">Tap the lines that should move (default: start, middle and end):</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {episode.shots.map((s, i) => (
              <button
                key={s.id}
                onClick={() => onToggleAnimate(s.id)}
                className={`min-h-9 min-w-9 rounded-lg px-2 text-xs font-bold transition ${
                  keyIds.has(s.id) ? 'bg-[var(--accent)] text-slate-950' : 'border border-white/10 text-slate-400 hover:text-white'
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-3 rounded-xl bg-black/25 p-2.5 text-xs">
        {comfy === null ? (
          <span className="text-slate-500">Checking ComfyUI…</span>
        ) : comfy.reachable ? (
          <span className="text-emerald-300">✅ ComfyUI is running{comfy.gpu ? ` · ${comfy.gpu}` : ''}</span>
        ) : comfy.canAutoStart ? (
          <span className="text-emerald-300">✅ ComfyUI will start by itself when you press Make the video</span>
        ) : (
          <span className="text-amber-300">
            ComfyUI is not on this PC. “Pictures” works here; the moving modes run on the GPU PC (set COMFY_START there so it starts by itself).
          </span>
        )}
        {comfy && !comfy.workflows.keyframe && (
          <span className="mt-1 block text-slate-500">
            AI pictures are not set up yet (no keyframe workflow): lines use your uploaded picture, the character picture, or a scene card.
          </span>
        )}
        {current.needsGpu && noPicture > 0 && !comfy?.workflows.keyframe && (
          <span className="mt-1 block text-amber-300">
            {noPicture} moving line(s) have no picture to start from and will stay still. Upload a picture for them, or add character pictures in Edit series.
          </span>
        )}
        {current.needsGpu && !gpuOk && comfy && <span className="mt-1 block text-rose-300">This mode needs ComfyUI: use it on the GPU PC.</span>}
      </div>
    </div>
  );
}
