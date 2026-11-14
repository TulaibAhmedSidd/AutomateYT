'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Headphones, Loader2, Lock, Pause, Play } from 'lucide-react';
import type { VoiceOption } from '@/lib/motion/spec';
import { sampleLabel, sampleLang, type CartoonLang } from '@/lib/cartoon/spec';

/** An ElevenLabs voice as /api/cartoon/eleven/voices returns it. */
export type ElevenVoice = {
  id: string;
  name: string;
  gender: string;
  accent?: string;
  style?: string;
  language?: string;
  paidOnly: boolean;
  sampleLangs?: string[];
};

type Props = {
  language: CartoonLang;
  elevenVoices: ElevenVoice[];
  edgeVoices: VoiceOption[];
  /** The chosen voice: 'eleven:<id>', 'edge:<id>' or 'recorded'. */
  selected: string;
  /** Called with a choice string when the owner taps "Use this voice". */
  onPick: (choice: string) => void;
};

type Row = { choice: string; name: string; tags: string; sample: string; url: string; paid: boolean; group: string };

function rows(language: CartoonLang, eleven: ElevenVoice[], edge: VoiceOption[]): Row[] {
  const fromEleven = eleven.map((v) => {
    const lang = sampleLang(v.sampleLangs || [], language);
    return {
      choice: `eleven:${v.id}`,
      name: v.name,
      tags: [v.language === 'ur' ? 'native Urdu' : '', v.gender, v.accent, v.style].filter(Boolean).join(' · '),
      sample: sampleLabel(lang),
      url: `/api/cartoon/voice-sample?kind=eleven&id=${encodeURIComponent(v.id)}&lang=${language}`,
      paid: v.paidOnly,
      group: v.paidOnly ? 'ElevenLabs · needs a paid plan' : 'ElevenLabs · free plan',
    };
  });
  const fromEdge = edge.map((v) => ({
    choice: `edge:${v.id}`,
    name: v.label,
    tags: 'Microsoft · robotic but free',
    sample: v.lang === 'ur' ? 'Urdu sample' : 'English sample',
    url: `/api/cartoon/voice-sample?kind=edge&id=${encodeURIComponent(v.id)}`,
    paid: false,
    group: 'Free Microsoft voices · no credits ever',
  }));
  return [...fromEleven.filter((r) => !r.paid), ...fromEdge, ...fromEleven.filter((r) => r.paid)];
}

/**
 * "Listen" buttons for every voice, so the owner hears a voice before spending credits on it.
 * Samples are free: ElevenLabs' own demo clips, or one short line from the free Microsoft voice.
 * The server downloads each sample once and keeps it in storage/voice-samples/.
 */
export function VoiceSamples({ language, elevenVoices, edgeVoices, selected, onPick }: Props) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => () => audio.current?.pause(), []);

  const all = rows(language, elevenVoices, edgeVoices);
  const current = all.find((r) => r.choice === selected);

  function toggle(row: Row) {
    if (playing === row.choice) {
      audio.current?.pause();
      setPlaying(null);
      return;
    }
    audio.current?.pause();
    const a = new Audio(row.url);
    audio.current = a;
    setFailed(null);
    setLoading(row.choice);
    a.onplaying = () => {
      setLoading(null);
      setPlaying(row.choice);
    };
    a.onended = () => setPlaying((p) => (p === row.choice ? null : p));
    a.onerror = () => {
      setLoading(null);
      setPlaying(null);
      setFailed(row.choice);
    };
    a.play().catch(() => {
      setLoading(null);
      setFailed(row.choice);
    });
  }

  const playBtn = (row: Row, big = false) => (
    <button
      type="button"
      onClick={() => toggle(row)}
      aria-label={playing === row.choice ? `Stop ${row.name}` : `Listen to ${row.name}`}
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/10 font-semibold text-white transition hover:bg-white/[0.08] ${
        big ? 'min-h-10 max-w-full px-3 py-1.5 text-left text-xs' : 'h-10 w-10 shrink-0'
      } ${playing === row.choice ? 'border-[var(--accent)] bg-[var(--accent)]/15' : ''}`}
    >
      {loading === row.choice ? <Loader2 size={15} className="animate-spin" /> : playing === row.choice ? <Pause size={15} /> : <Play size={15} />}
      {big && (playing === row.choice ? 'Stop' : `Listen · ${row.sample}`)}
    </button>
  );

  return (
    <div className="rounded-xl bg-black/25 p-2.5">
      <div className="flex flex-wrap items-center gap-2">
        {current && playBtn(current, true)}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-xl px-2 text-xs font-semibold text-[var(--accent)] hover:bg-white/[0.06]"
        >
          <Headphones size={15} /> Hear all {all.length} voices first
          <ChevronDown size={14} className={`transition ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>
      {failed && <p className="mt-1 text-xs text-rose-300">Could not play that sample. Check the internet and try again.</p>}
      <p className="mt-1 text-[11px] text-slate-500">Samples are free (no credits). They are each voice&apos;s demo clip, not your script.</p>

      {open && (
        <ul className="mt-2 max-h-96 space-y-1 overflow-y-auto pr-1">
          {all.map((row, i) => {
            const heading = i === 0 || all[i - 1].group !== row.group ? row.group : null;
            return (
              <li key={row.choice}>
                {heading && <p className="mb-1 mt-3 text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500 first:mt-0">{heading}</p>}
                <div className={`flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl p-1.5 ${row.choice === selected ? 'bg-[var(--accent)]/10' : 'hover:bg-white/[0.03]'}`}>
                  {playBtn(row)}
                  <div className="min-w-[9rem] flex-1">
                    <p className={`text-sm font-semibold leading-tight ${row.paid ? 'text-slate-400' : 'text-white'}`}>{row.name}</p>
                    <p className="text-[11px] leading-snug text-slate-500">
                      {row.sample}
                      {row.tags && ` · ${row.tags}`}
                    </p>
                  </div>
                  {row.paid ? (
                    <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-amber-300">
                      <Lock size={12} /> paid plan
                    </span>
                  ) : row.choice === selected ? (
                    <span className="shrink-0 px-2 text-[11px] font-bold text-[var(--accent)]">In use</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onPick(row.choice)}
                      className="min-h-9 shrink-0 rounded-lg border border-white/10 px-2.5 text-[11px] font-semibold text-slate-300 hover:bg-white/[0.06]"
                    >
                      Use this voice
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
