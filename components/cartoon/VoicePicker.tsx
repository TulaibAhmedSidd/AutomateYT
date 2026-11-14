'use client';

import { useEffect, useState } from 'react';
import { VOICES } from '@/lib/motion/spec';
import { ELEVEN_MODELS, type CartoonLang } from '@/lib/cartoon/spec';
import { api, field, label } from './ui';
import { VoiceSamples, type ElevenVoice } from './VoiceSamples';

type Props = {
  language: CartoonLang;
  /** 'eleven:<voiceId>', 'edge:<voiceId>', 'recorded' or 'none'. */
  value: string;
  onChange: (choice: string) => void;
  /** When given, an ElevenLabs model list is shown next to the voice while an ElevenLabs voice is picked. */
  model?: string;
  onModel?: (model: string) => void;
  /** Extra choices: "My own voice" (Cartoon series) and "No voice" (Motion). */
  allowRecorded?: boolean;
  allowNone?: boolean;
  /** Text under the label, e.g. a hint about credits. */
  title?: string;
};

/**
 * The one voice picker used everywhere (Cartoon Step 1, Edit series, Motion Studio): ElevenLabs voices the free
 * plan can use, free Microsoft voices, optional "own voice" / "no voice", paid ElevenLabs voices shown but locked,
 * the ElevenLabs model, and a free Listen sample for every voice.
 */
export function VoicePicker({ language, value, onChange, model, onModel, allowRecorded = false, allowNone = false, title = 'Voice' }: Props) {
  const [elevenVoices, setElevenVoices] = useState<ElevenVoice[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api<{ voices: ElevenVoice[]; error?: string }>('/api/cartoon/eleven/voices')
      .then((d) => {
        setElevenVoices(d.voices);
        setError(d.error || null);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  const edgeVoices = VOICES.filter((v) => v.id !== 'none' && (v.lang === language || v.lang === 'any'));
  const free = elevenVoices.filter((v) => !v.paidOnly);
  const paid = elevenVoices.filter((v) => v.paidOnly);
  const isEleven = value.startsWith('eleven:');

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={`block ${isEleven && onModel ? '' : 'sm:col-span-2'}`}>
          <span className={label}>{title}</span>
          <select className={field} value={value} onChange={(e) => onChange(e.target.value)}>
            {free.length > 0 && (
              <optgroup label="ElevenLabs: natural, works on the free plan (speaks Urdu and English)">
                {free.map((v) => (
                  <option key={v.id} value={`eleven:${v.id}`}>
                    {v.name}
                  </option>
                ))}
              </optgroup>
            )}
            <optgroup label="Free Microsoft voices (no credits, more robotic)">
              {edgeVoices.map((v) => (
                <option key={v.id} value={`edge:${v.id}`}>
                  {v.label}
                </option>
              ))}
            </optgroup>
            {(allowRecorded || allowNone) && (
              <optgroup label="Other">
                {allowRecorded && <option value="recorded">My own voice (I record each line)</option>}
                {allowNone && <option value="none">No voice (music only)</option>}
              </optgroup>
            )}
            {paid.length > 0 && (
              <optgroup label="ElevenLabs: needs a paid plan (native Urdu voices)">
                {paid.map((v) => (
                  <option key={v.id} value={`eleven:${v.id}`} disabled>
                    {v.name} (paid plan only)
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </label>
        {isEleven && onModel && (
          <label className="block">
            <span className={label}>ElevenLabs model</span>
            <select className={field} value={model || 'eleven_v4'} onChange={(e) => onModel(e.target.value)}>
              {ELEVEN_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {error && <p className="text-xs text-amber-300">ElevenLabs voices could not load: {error}</p>}
      <VoiceSamples language={language} elevenVoices={elevenVoices} edgeVoices={edgeVoices} selected={value} onPick={onChange} />
      {paid.some((v) => v.language === 'ur') && (
        <p className="text-[11px] text-slate-500">
          Native Urdu ElevenLabs voices ({paid.filter((v) => v.language === 'ur').map((v) => v.name.split(/\s[-–]\s/)[0]).join(', ')}) can be heard with
          Listen, but making lines with them needs a paid ElevenLabs plan. The free-plan voices speak Urdu with a slight accent.
        </p>
      )}
    </div>
  );
}
