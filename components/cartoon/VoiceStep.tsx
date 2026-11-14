'use client';

import { useEffect, useState } from 'react';
import { Bot, CheckCircle2, FlaskConical, Loader2, Mic, Sparkles } from 'lucide-react';
import { VOICES } from '@/lib/motion/spec';
import { ELEVEN_MODELS, spokenText, type CartoonEpisode, type CartoonSeries } from '@/lib/cartoon/spec';
import { api, field, jsonBody, label } from './ui';
import { VoiceSamples, type ElevenVoice } from './VoiceSamples';
export type VoiceMode = 'ai' | 'own';

type Props = {
  episode: CartoonEpisode;
  series: CartoonSeries;
  mode: VoiceMode;
  onMode: (m: VoiceMode) => void;
  disabled: boolean;
  /** Selected AI voice, e.g. 'eleven:<voiceId>' or 'edge:ur-PK-AsadNeural', and the ElevenLabs model. */
  choice: string;
  model: string;
  onChoice: (c: string) => void;
  onModel: (m: string) => void;
  onLineDone: (shotId: string, updated: CartoonEpisode) => void;
  onError: (message: string) => void;
};

/** The voice a series starts with, as a choice string for the voice list. */
export function defaultVoiceChoice(series: CartoonSeries) {
  return series.voice.provider === 'edge' || !series.voice.elevenVoiceId ? `edge:${series.voice.edgeVoice}` : `eleven:${series.voice.elevenVoiceId}`;
}

/** Step 1 of an episode: pick AI voice or own voice; for AI, pick the voice and make every line with one button. */
export function VoiceStep({ episode, series, mode, onMode, disabled, choice, model, onChoice, onModel, onLineDone, onError }: Props) {
  const [elevenVoices, setElevenVoices] = useState<ElevenVoice[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  useEffect(() => {
    api<{ voices: ElevenVoice[] }>('/api/cartoon/eleven/voices')
      .then((d) => setElevenVoices(d.voices))
      .catch(() => setElevenVoices([]));
  }, []);

  const edgeVoices = VOICES.filter((v) => v.id !== 'none' && (v.lang === series.language || v.lang === 'any'));
  const [kind, voiceId] = choice.split(':');
  const isEleven = kind === 'eleven';
  const missing = episode.shots.filter((s) => s.narration.trim() && !s.recording);
  const withVoice = episode.shots.length - episode.shots.filter((s) => !s.recording).length;
  const chars = (list: typeof episode.shots) => list.reduce((n, s) => n + spokenText(s.narration).length, 0);
  const multiplier = ELEVEN_MODELS.find((m) => m.id === model)?.multiplier ?? 1;

  /** Makes only the first line, then plays it: hear the voice on your own script before paying for every line. */
  async function tryFirst() {
    const first = episode.shots.find((s) => s.narration.trim());
    if (!first) return;
    setProgress({ done: 0, total: 1 });
    try {
      const d = await api<{ episode: CartoonEpisode }>(
        `/api/cartoon/episodes/${episode.id}/voice?shot=${first.id}`,
        jsonBody('POST', { provider: isEleven ? 'elevenlabs' : 'edge', voiceId, model }),
      );
      onLineDone(first.id, d.episode);
      const rec = d.episode.shots.find((s) => s.id === first.id)?.recording;
      if (rec) void new Audio(`/api/cartoon/files/episodes/${episode.id}/recordings/${rec.file}?v=${encodeURIComponent(rec.at)}`).play().catch(() => {});
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      setProgress(null);
    }
  }

  async function generate(all: boolean) {
    const shots = all ? episode.shots.filter((s) => s.narration.trim()) : missing;
    if (!shots.length) return;
    if (all && withVoice > 0 && !window.confirm(`Make all ${shots.length} lines again? The current voice of every line will be replaced.`)) return;
    setProgress({ done: 0, total: shots.length });
    try {
      for (let i = 0; i < shots.length; i += 1) {
        const d = await api<{ episode: CartoonEpisode }>(
          `/api/cartoon/episodes/${episode.id}/voice?shot=${shots[i].id}`,
          jsonBody('POST', { provider: isEleven ? 'elevenlabs' : 'edge', voiceId, model }),
        );
        onLineDone(shots[i].id, d.episode);
        setProgress({ done: i + 1, total: shots.length });
      }
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      setProgress(null);
    }
  }

  return (
    <div className="rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent)]/[0.05] p-4">
      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--accent)]">Step 1 · Voice</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {(
          [
            ['ai', Bot, 'AI voice', 'The app speaks every line for you.'],
            ['own', Mic, 'My own voice', 'Record or upload each line yourself.'],
          ] as const
        ).map(([m, Icon, title, note]) => (
          <button
            key={m}
            onClick={() => onMode(m)}
            className={`flex min-h-16 items-center gap-3 rounded-2xl border p-3 text-left transition ${
              mode === m ? 'border-[var(--accent)] bg-[var(--accent)]/15' : 'border-white/10 bg-black/20 hover:border-white/25'
            }`}
          >
            <Icon size={22} className={mode === m ? 'text-[var(--accent)]' : 'text-slate-400'} />
            <span>
              <span className="block text-sm font-bold text-white">{title}</span>
              <span className="block text-xs text-slate-400">{note}</span>
            </span>
          </button>
        ))}
      </div>

      {mode === 'ai' ? (
        <div className="mt-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className={label}>Voice</span>
              <select className={field} value={choice} onChange={(e) => onChoice(e.target.value)}>
                <optgroup label="ElevenLabs: natural, free plan (speaks Urdu and English)">
                  {elevenVoices
                    .filter((v) => !v.paidOnly)
                    .map((v) => (
                      <option key={v.id} value={`eleven:${v.id}`}>
                        {v.name}
                      </option>
                    ))}
                </optgroup>
                <optgroup label="Free Microsoft voices (no credits, more robotic)">
                  {edgeVoices.map((v) => (
                    <option key={v.id} value={`edge:${v.id}`}>
                      {v.label}
                    </option>
                  ))}
                </optgroup>
                {elevenVoices.some((v) => v.paidOnly) && (
                  <optgroup label="ElevenLabs: needs a paid plan">
                    {elevenVoices
                      .filter((v) => v.paidOnly)
                      .map((v) => (
                        <option key={v.id} value={`eleven:${v.id}`} disabled>
                          {v.name} (paid plan only)
                        </option>
                      ))}
                  </optgroup>
                )}
              </select>
            </label>
            {isEleven && (
              <label className="block">
                <span className={label}>ElevenLabs model</span>
                <select className={field} value={model} onChange={(e) => onModel(e.target.value)}>
                  {ELEVEN_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <VoiceSamples language={series.language} elevenVoices={elevenVoices} edgeVoices={edgeVoices} selected={choice} onPick={onChoice} />
          <p className="text-xs text-slate-400">
            {missing.length > 0 ? `${missing.length} line(s) still need a voice` : '✅ Every line has a voice'}
            {isEleven
              ? ` · about ${Math.round(chars(missing.length ? missing : episode.shots) * multiplier)} ElevenLabs credits (free plan: about 10,000 a month)`
              : ' · free'}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => generate(false)}
              disabled={disabled || progress !== null || missing.length === 0}
              className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-sm font-bold text-slate-950 transition hover:brightness-110 disabled:opacity-40"
            >
              {progress ? <Loader2 size={16} className="animate-spin" /> : missing.length ? <Sparkles size={16} /> : <CheckCircle2 size={16} />}
              {progress ? `Making line ${progress.done + 1} of ${progress.total}…` : missing.length ? `Generate voice (${missing.length} lines)` : 'Voice ready'}
            </button>
            {isEleven && withVoice === 0 && missing.length > 1 && !progress && (
              <button
                onClick={tryFirst}
                disabled={disabled}
                title="Makes only line 1 and plays it, so you hear this voice on your own script first"
                className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-xl border border-[var(--accent)]/40 px-4 text-xs font-semibold text-[var(--accent)] hover:bg-[var(--accent)]/10 disabled:opacity-40"
              >
                <FlaskConical size={15} /> Try on line 1 only (≈{Math.round(spokenText(missing[0].narration).length * multiplier)} credits)
              </button>
            )}
            {withVoice > 0 && !progress && (
              <button
                onClick={() => generate(true)}
                disabled={disabled}
                className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/10 px-4 text-xs font-semibold text-slate-300 hover:bg-white/[0.06] disabled:opacity-40"
              >
                Make all lines again
              </button>
            )}
          </div>
        </div>
      ) : (
        <p className="mt-4 text-sm text-slate-300">
          Press <b>🎙 Record</b> on each line below, or <b>⬆ Upload</b> an audio file (from your phone, WhatsApp voice note, etc.). The app cleans the sound for you.
        </p>
      )}
    </div>
  );
}
