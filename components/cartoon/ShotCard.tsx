'use client';

import { ArrowDown, ArrowUp, CheckCircle2, ImagePlus, Loader2, Mic, Square, Trash2, X } from 'lucide-react';
import { CAMERAS, type Camera, type CartoonSeries, type CartoonShot } from '@/lib/cartoon/spec';
import { field, ghostBtn, label } from './ui';

type Props = {
  shot: CartoonShot;
  index: number;
  total: number;
  series: CartoonSeries;
  urdu: boolean;
  canRecord: boolean;
  recording: boolean;
  recSeconds: number;
  busy: string | null;
  audioUrl?: string;
  pictureUrl?: string;
  onChange: (patch: Partial<CartoonShot>) => void;
  onMove: (dir: -1 | 1) => void;
  onDelete: () => void;
  onRecord: () => void;
  onStop: () => void;
  onDeleteRecording: () => void;
  onPicture: (file: File) => void;
  onRemovePicture: () => void;
};

/** Editor for one shot: the line to record, what is on screen, and the owner's recording. */
export function ShotCard(p: Props) {
  const { shot, series } = p;
  const words = shot.narration.split(/\s+/).filter(Boolean).length;
  return (
    <li className={`rounded-2xl border bg-black/20 p-4 ${p.recording ? 'border-rose-400/60' : shot.recording ? 'border-emerald-400/25' : 'border-white/[0.07]'}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2 text-sm font-bold text-white">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-white/10 text-xs">{p.index + 1}</span>
          Shot {p.index + 1}
          {shot.recording && <CheckCircle2 size={15} className="text-emerald-400" aria-label="Recorded" />}
        </span>
        <div className="flex gap-1">
          <button className={ghostBtn} onClick={() => p.onMove(-1)} disabled={p.index === 0} aria-label="Move up">
            <ArrowUp size={14} />
          </button>
          <button className={ghostBtn} onClick={() => p.onMove(1)} disabled={p.index === p.total - 1} aria-label="Move down">
            <ArrowDown size={14} />
          </button>
          <button className={`${ghostBtn} hover:text-rose-300`} onClick={p.onDelete} aria-label="Delete shot">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* The line the owner reads */}
      <label className="mt-3 block">
        <span className={label}>Line to say {words > 12 && <span className="normal-case tracking-normal text-amber-300">· {words} words, try 12 or fewer</span>}</span>
        <textarea
          dir="auto"
          rows={2}
          className={`${field} resize-y text-base ${p.urdu ? 'leading-loose' : ''}`}
          value={shot.narration}
          onChange={(e) => p.onChange({ narration: e.target.value })}
        />
      </label>

      {/* Voice */}
      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-white/[0.03] p-2">
        {p.recording ? (
          <button
            onClick={p.onStop}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-rose-500 px-4 text-sm font-bold text-white"
          >
            <Square size={14} fill="currentColor" /> Stop · {p.recSeconds.toFixed(1)} s
            <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
          </button>
        ) : (
          <button
            onClick={p.onRecord}
            disabled={!p.canRecord || p.busy !== null}
            title={p.canRecord ? 'Record this line in your voice' : 'Saving… one moment'}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-sm font-bold text-slate-950 transition hover:brightness-110 disabled:opacity-40"
          >
            {p.busy === 'voice' ? <Loader2 size={15} className="animate-spin" /> : <Mic size={15} />}
            {p.busy === 'voice' ? 'Cleaning…' : shot.recording ? 'Record again' : 'Record'}
          </button>
        )}
        {shot.recording && p.audioUrl && !p.recording && (
          <>
            <audio src={p.audioUrl} controls preload="none" className="h-10 min-w-0 flex-1" />
            <span className="text-xs text-slate-400">{shot.recording.seconds.toFixed(1)} s</span>
            <button className={`${ghostBtn} hover:text-rose-300`} onClick={p.onDeleteRecording} aria-label="Delete recording">
              <X size={14} />
            </button>
          </>
        )}
        {!shot.recording && !p.recording && <span className="text-xs text-slate-500">Not recorded yet</span>}
      </div>

      {/* What is on screen */}
      <details className="mt-3 group">
        <summary className="cursor-pointer select-none text-xs font-semibold text-slate-400 hover:text-white">Picture & scene</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className={label}>Where</span>
            <input className={field} value={shot.scene} onChange={(e) => p.onChange({ scene: e.target.value })} />
          </label>
          <label className="block">
            <span className={label}>Action (one thing that moves)</span>
            <input className={field} value={shot.action} onChange={(e) => p.onChange({ action: e.target.value })} />
          </label>
          <label className="block">
            <span className={label}>Camera</span>
            <select className={field} value={shot.camera} onChange={(e) => p.onChange({ camera: e.target.value as Camera })}>
              {CAMERAS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <div>
            <span className={label}>Characters in shot</span>
            <div className="flex flex-wrap gap-1.5">
              {series.characters.map((c) => {
                const on = shot.characters.includes(c.id);
                return (
                  <button
                    key={c.id}
                    onClick={() => p.onChange({ characters: on ? shot.characters.filter((x) => x !== c.id) : [...shot.characters, c.id] })}
                    className={`min-h-9 rounded-full px-3 text-xs font-semibold transition ${on ? 'bg-white text-slate-950' : 'border border-white/10 text-slate-400 hover:text-white'}`}
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
            {p.pictureUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- local preview of an uploaded file
              <img src={p.pictureUrl} alt="" className="h-20 w-12 rounded-lg object-cover" />
            )}
            <label className={`${ghostBtn} cursor-pointer`}>
              {p.busy === 'picture' ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />}
              {shot.keyframe ? 'Change picture' : 'Upload picture'}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                disabled={!p.canRecord}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) p.onPicture(f);
                  e.target.value = '';
                }}
              />
            </label>
            {shot.keyframe && (
              <button className={ghostBtn} onClick={p.onRemovePicture}>
                Remove picture
              </button>
            )}
            <span className="text-xs text-slate-500">
              {shot.keyframe ? 'Uses this picture.' : 'No picture: uses the character picture, or a scene card.'}
            </span>
          </div>
        </div>
      </details>
    </li>
  );
}
