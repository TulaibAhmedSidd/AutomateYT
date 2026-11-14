'use client';

import { ImagePlus, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { VOICES } from '@/lib/motion/spec';
import { ELEVEN_MODELS, type CartoonSeries, type Character, type ElevenModel } from '@/lib/cartoon/spec';
import { api, field, ghostBtn, jsonBody, label } from './ui';
import { VoiceSamples, type ElevenVoice } from './VoiceSamples';

/** A 45-60 s episode is roughly 600-700 characters of narration. */
const CHARS_PER_EPISODE = 650;

type Props = {
  series: CartoonSeries;
  onSaved: (s: CartoonSeries) => void;
  onError: (message: string) => void;
};

/** Edits a series bible: look, characters (with reference pictures), narrator voice and story rules. */
export function SeriesEditor({ series, onSaved, onError }: Props) {
  const [draft, setDraft] = useState<CartoonSeries>(series);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [elevenVoices, setElevenVoices] = useState<ElevenVoice[]>([]);
  const [elevenError, setElevenError] = useState<string | null>(null);
  useEffect(() => {
    api<{ voices: ElevenVoice[]; error?: string }>('/api/cartoon/eleven/voices')
      .then((d) => {
        setElevenVoices(d.voices);
        if (d.error) setElevenError(d.error);
      })
      .catch((e: unknown) => setElevenError(e instanceof Error ? e.message : String(e)));
  }, []);
  const set =(patch: Partial<CartoonSeries>) => setDraft((d) => ({ ...d, ...patch }));
  const setChar = (i: number, patch: Partial<Character>) =>
    setDraft((d) => ({ ...d, characters: d.characters.map((c, j) => (j === i ? { ...c, ...patch } : c)) }));

  async function save() {
    setSaving(true);
    try {
      const { series: saved } = await api<{ series: CartoonSeries }>('/api/cartoon/series', jsonBody('POST', { series: draft }));
      setDraft(saved);
      onSaved(saved);
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function uploadRef(characterId: string, file: File) {
    setUploading(characterId);
    try {
      const { series: saved } = await api<{ series: CartoonSeries }>(
        `/api/cartoon/series/${draft.id}/reference?character=${encodeURIComponent(characterId)}`,
        { method: 'POST', headers: { 'content-type': file.type }, body: file },
      );
      setDraft((d) => ({ ...d, characters: d.characters.map((c) => ({ ...c, reference: saved.characters.find((x) => x.id === c.id)?.reference })) }));
      onSaved(saved);
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(null);
    }
  }

  const voiceChoice =
    draft.voice.provider === 'elevenlabs' ? `eleven:${draft.voice.elevenVoiceId}` : draft.voice.provider === 'edge' ? `edge:${draft.voice.edgeVoice}` : 'recorded';
  function pickVoice(value: string) {
    const [kind, id] = value.split(':');
    if (kind === 'eleven') set({ voice: { ...draft.voice, provider: 'elevenlabs', elevenVoiceId: id, elevenModel: draft.voice.elevenModel || 'eleven_v4' } });
    else if (kind === 'edge') set({ voice: { ...draft.voice, provider: 'edge', edgeVoice: id } });
    else set({ voice: { ...draft.voice, provider: 'recorded' } });
  }
  const voices = VOICES.filter((v) => v.id !== 'none' && (v.lang === draft.language || v.lang === 'any'));

  return (
    <div className="mt-4 space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className={label}>Series name</span>
          <input dir="auto" className={field} value={draft.name} onChange={(e) => set({ name: e.target.value })} />
        </label>
        <label className="block">
          <span className={label}>Language</span>
          <select className={field} value={draft.language} onChange={(e) => set({ language: e.target.value === 'ur' ? 'ur' : 'en' })}>
            <option value="en">English</option>
            <option value="ur">Urdu</option>
          </select>
        </label>
        <label className="block">
          <span className={label}>Episode length</span>
          <select className={field} value={draft.episodeSeconds} onChange={(e) => set({ episodeSeconds: Number(e.target.value) as 45 | 60 | 75 })}>
            {[45, 60, 75].map((s) => (
              <option key={s} value={s}>
                {s} seconds (~{Math.round(s / 5)} shots)
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={label}>Audience</span>
          <select className={field} value={draft.audience} onChange={(e) => set({ audience: e.target.value === 'general' ? 'general' : 'kids' })}>
            <option value="kids">Kids</option>
            <option value="general">Everyone</option>
          </select>
        </label>
        <label className="flex min-h-11 items-center gap-2 self-end text-sm text-slate-300">
          <input type="checkbox" checked={draft.madeForKids} onChange={(e) => set({ madeForKids: e.target.checked })} className="h-4 w-4" />
          Made for kids (YouTube setting)
        </label>
        <label className="block sm:col-span-2">
          <span className={label}>Look (added to every picture)</span>
          <textarea className={`${field} min-h-[64px]`} value={draft.style} onChange={(e) => set({ style: e.target.value })} />
        </label>
        <label className="block sm:col-span-2">
          <span className={label}>Never show</span>
          <input className={field} value={draft.negative} onChange={(e) => set({ negative: e.target.value })} />
        </label>
      </div>

      <div>
        <span className={label}>Characters</span>
        <ul className="space-y-3">
          {draft.characters.map((c, i) => {
            const saved = series.characters.some((x) => x.id === c.id);
            return (
              <li key={i} className="flex flex-wrap gap-3 rounded-2xl border border-white/[0.07] bg-black/20 p-3">
                {c.reference ? (
                  // eslint-disable-next-line @next/next/no-img-element -- local reference picture
                  <img src={`/api/cartoon/files/series/${draft.id}/refs/${c.reference}`} alt={c.name} className="h-24 w-[54px] rounded-lg object-cover" />
                ) : (
                  <div className="grid h-24 w-[54px] place-items-center rounded-lg border border-dashed border-white/15 text-[10px] text-slate-500">no pic</div>
                )}
                <div className="min-w-0 flex-1 space-y-2">
                  <input className={field} placeholder="Name" value={c.name} onChange={(e) => setChar(i, { name: e.target.value })} />
                  <textarea
                    className={`${field} min-h-[56px]`}
                    placeholder="Fixed look: age, hair, clothes, colours…"
                    value={c.look}
                    onChange={(e) => setChar(i, { look: e.target.value })}
                  />
                  <div className="flex flex-wrap gap-2">
                    <label className={`${ghostBtn} ${saved ? 'cursor-pointer' : 'pointer-events-none opacity-40'}`} title={saved ? '' : 'Save the series first'}>
                      {uploading === c.id ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />}
                      {c.reference ? 'Change picture' : 'Upload picture'}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="sr-only"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) uploadRef(c.id, f);
                          e.target.value = '';
                        }}
                      />
                    </label>
                    <button className={`${ghostBtn} hover:text-rose-300`} onClick={() => set({ characters: draft.characters.filter((_, j) => j !== i) })}>
                      <Trash2 size={14} /> Remove
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        {draft.characters.length < 6 && (
          <button className={`${ghostBtn} mt-2`} onClick={() => set({ characters: [...draft.characters, { id: '', name: '', look: '' }] })}>
            <Plus size={14} /> Add character
          </button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className={label}>Narrator voice</span>
          <select
            className={field}
            value={voiceChoice}
            onChange={(e) => pickVoice(e.target.value)}
          >
            <optgroup label="ElevenLabs: natural, works on your free plan (speaks Urdu and English)">
              {elevenVoices
                .filter((v) => !v.paidOnly)
                .map((v) => (
                  <option key={v.id} value={`eleven:${v.id}`}>
                    {v.name}
                    {v.gender ? ` · ${v.gender}` : ''}
                  </option>
                ))}
            </optgroup>
            <optgroup label="Free Microsoft voices (no credits, sounds more robotic)">
              {voices.map((v) => (
                <option key={v.id} value={`edge:${v.id}`}>
                  {v.label}
                </option>
              ))}
            </optgroup>
            <optgroup label="Me">
              <option value="recorded">My own voice (I record each line)</option>
            </optgroup>
            {elevenVoices.some((v) => v.paidOnly) && (
              <optgroup label="ElevenLabs: needs a paid plan (native Urdu voices)">
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
          <div className="mt-2">
            <VoiceSamples language={draft.language} elevenVoices={elevenVoices} edgeVoices={voices} selected={voiceChoice} onPick={pickVoice} />
          </div>
          {elevenError && <span className="mt-1 block text-xs text-amber-300">{elevenError}</span>}
          {draft.voice.provider === 'elevenlabs' && draft.language === 'ur' && (
            <span className="mt-1 block text-xs text-slate-500">
              These voices speak Urdu with a slight foreign accent. Native Pakistani voices (Kamran, Naqsh, Saira…) need a paid ElevenLabs plan.
            </span>
          )}
        </label>
        {draft.voice.elevenVoiceId && draft.voice.provider === 'elevenlabs' && (
          <label className="block sm:col-span-2">
            <span className={label}>ElevenLabs model</span>
            <select
              className={field}
              value={draft.voice.elevenModel || 'eleven_v4'}
              onChange={(e) => set({ voice: { ...draft.voice, elevenModel: e.target.value as ElevenModel } })}
            >
              {ELEVEN_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label} · about {Math.round(CHARS_PER_EPISODE * m.multiplier)} credits per episode
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs text-slate-500">
              Free plan: about 10,000 credits a month and no commercial use. A monetised channel needs a paid ElevenLabs plan.
            </span>
          </label>
        )}
        <label className="block sm:col-span-2">
          <span className={label}>Story rules (one per line)</span>
          <textarea
            className={`${field} min-h-[96px]`}
            value={draft.rules.join('\n')}
            onChange={(e) => set({ rules: e.target.value.split('\n') })}
          />
        </label>
        <div className="flex items-end gap-3">
          <label className="block">
            <span className={label}>Background</span>
            <input type="color" className="h-11 w-16 rounded-lg border border-white/10 bg-transparent" value={draft.palette.bg} onChange={(e) => set({ palette: { ...draft.palette, bg: e.target.value } })} />
          </label>
          <label className="block">
            <span className={label}>Accent</span>
            <input type="color" className="h-11 w-16 rounded-lg border border-white/10 bg-transparent" value={draft.palette.accent} onChange={(e) => set({ palette: { ...draft.palette, accent: e.target.value } })} />
          </label>
        </div>
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-bold text-slate-950 transition hover:bg-slate-200 disabled:opacity-40"
      >
        {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Save series
      </button>
    </div>
  );
}
