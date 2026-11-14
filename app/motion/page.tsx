'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Clapperboard,
  Download,
  Loader2,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  Wand2,
  XCircle,
} from 'lucide-react';
import { PageHeader } from '@/components/format-ui';
import { MotionSeriesPanel } from '@/components/motion/MotionSeriesPanel';
import { VoicePicker } from '@/components/cartoon/VoicePicker';
import {
  PRESETS,
  SCENE_KINDS,
  THEMES,
  VOICES,
  sceneSeconds,
  totalFrames,
  isElevenVoice,
  FPS,
  type MotionScene,
  type MotionSpec,
  type SceneKind,
  type ThemeId,
} from '@/lib/motion/spec';

const PlayerPanel = dynamic(() => import('@/components/motion/PlayerPanel'), {
  ssr: false,
  loading: () => <div className="grid aspect-[9/16] w-full place-items-center rounded-[28px] bg-black/40 text-sm text-slate-500">Loading preview…</div>,
});

type JobStatus = { stage: string; progress: number; error?: string | null; seconds?: number; bytes?: number; finishedAt?: string };
type Job = { id: string; title: string; theme: ThemeId; language: string; createdAt: string; status: JobStatus };

const STAGE_LABEL: Record<string, string> = {
  queued: 'Starting',
  voice: 'Recording voice',
  bundle: 'Preparing',
  render: 'Rendering frames',
  done: 'Ready',
  failed: 'Failed',
};

const field =
  'w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none transition focus:border-[var(--accent)]/60 focus:ring-2 focus:ring-[var(--accent)]/15';
const card = 'rounded-3xl border border-white/[0.07] bg-[var(--panel)] p-5';
const label = 'mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500';

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

function newScene(kind: SceneKind): MotionScene {
  const base: Record<SceneKind, MotionScene> = {
    hook: { kind, heading: 'A bold *claim* here', voice: 'Say the hook in one breath.' },
    stat: { kind, value: '75%', heading: 'of people never knew this', voice: 'Seventy five percent of people never knew this.' },
    list: { kind, heading: 'Three things', items: ['First point', 'Second point', 'Third point'], voice: 'Three things. First. Second. Third.' },
    compare: { kind, heading: 'Do this, not that', items: ['The old way', 'The better way'], voice: 'Stop doing it the old way. Do it the better way.' },
    quote: { kind, heading: 'A line worth remembering.', voice: 'A line worth remembering.' },
    statement: { kind, heading: 'One strong *sentence*', voice: 'One strong sentence.' },
    timeline: {
      kind,
      heading: 'How it *changed*',
      points: [
        { label: '1990', value: '10' },
        { label: '2010', value: '40' },
        { label: '2025', value: '100' },
      ],
      voice: 'In nineteen ninety it was ten. By twenty ten, forty. Today, one hundred.',
    },
    cta: { kind, heading: 'Follow for part 2', sub: 'Comment a keyword', voice: 'Follow for part two.' },
  };
  return clone(base[kind]);
}

function fmtSeconds(s: number) {
  return `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
}

export default function MotionStudioPage() {
  const [spec, setSpec] = useState<MotionSpec>(() => clone(PRESETS[0].spec));
  const [topic, setTopic] = useState('');
  const [seconds, setSeconds] = useState(35);
  const [model, setModel] = useState('gpt-4o-mini');
  const [writing, setWriting] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState('');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [watching, setWatching] = useState<string | null>(null);
  /** Facts to confirm before posting, shown while a series episode is open. */
  const [check, setCheck] = useState<string | undefined>();
  const elevenChars = isElevenVoice(spec.voice) ? spec.scenes.reduce((n, s) => n + s.voice.replace(/\*/g, '').length, 0) : 0;

  const total = useMemo(() => totalFrames(spec) / FPS, [spec]);
  const active = jobs.some((j) => !['done', 'failed'].includes(j.status.stage));

  const loadJobs = useCallback(async () => {
    try {
      const res = await fetch('/api/motion/jobs', { cache: 'no-store' });
      const data = await res.json();
      setJobs(data.jobs || []);
    } catch {
      /* keep the last list */
    }
  }, []);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  useEffect(() => {
    if (!active) return;
    const t = setInterval(loadJobs, 2000);
    return () => clearInterval(t);
  }, [active, loadJobs]);

  const update = (patch: Partial<MotionSpec>) => setSpec((s) => ({ ...s, ...patch }));
  const updateScene = (i: number, patch: Partial<MotionScene>) =>
    setSpec((s) => ({ ...s, scenes: s.scenes.map((sc, k) => (k === i ? { ...sc, ...patch, audio: undefined, words: undefined, duration: undefined } : sc)) }));
  const moveScene = (i: number, dir: -1 | 1) =>
    setSpec((s) => {
      const scenes = [...s.scenes];
      const j = i + dir;
      if (j < 0 || j >= scenes.length) return s;
      [scenes[i], scenes[j]] = [scenes[j], scenes[i]];
      return { ...s, scenes };
    });
  const removeScene = (i: number) => setSpec((s) => ({ ...s, scenes: s.scenes.filter((_, k) => k !== i) }));
  const addScene = (kind: SceneKind) => setSpec((s) => ({ ...s, scenes: [...s.scenes.slice(0, Math.max(0, s.scenes.length - 1)), newScene(kind), ...s.scenes.slice(-1)] }));

  const setLanguage = (language: 'en' | 'ur') => {
    const voice = VOICES.find((v) => v.lang === language)?.id || spec.voice;
    // ElevenLabs voices speak both languages, so they are kept; a Microsoft voice switches to one of the new language.
    const keep = isElevenVoice(spec.voice) || spec.voice === 'none' || VOICES.find((v) => v.id === spec.voice)?.lang === language;
    update({ language, voice: keep ? spec.voice : voice });
  };

  async function writeWithAi() {
    setError('');
    setWriting(true);
    try {
      const res = await fetch('/api/motion/script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, language: spec.language, seconds, model, theme: spec.theme, voice: spec.voice }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Script failed');
      setSpec(data.spec);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Script failed');
    } finally {
      setWriting(false);
    }
  }

  async function render() {
    setError('');
    setRendering(true);
    try {
      const res = await fetch('/api/motion/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spec }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Render failed to start');
      await loadJobs();
      document.getElementById('renders')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Render failed to start');
    } finally {
      setRendering(false);
    }
  }

  async function editJob(id: string) {
    const res = await fetch(`/api/motion/jobs/${id}`, { cache: 'no-store' });
    const data = await res.json();
    if (data.spec) {
      const { assetBase: _assetBase, ...rest } = data.spec as MotionSpec;
      void _assetBase;
      setSpec({ ...rest, scenes: rest.scenes.map((s) => ({ kind: s.kind, voice: s.voice, heading: s.heading, sub: s.sub, value: s.value, items: s.items, points: s.points })) });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  async function deleteJob(id: string) {
    if (!window.confirm('Delete this render and its files from this PC?')) return;
    await fetch(`/api/motion/jobs/${id}`, { method: 'DELETE' });
    if (watching === id) setWatching(null);
    loadJobs();
  }

  const urdu = spec.language === 'ur';

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        eyebrow="Motion graphics · Live"
        title="Motion Studio"
        description="Write or generate the scenes, hear the voice, watch the live preview, then render a 1080×1920 MP4 on this PC. Free voice, no image credits."
      >
        <select
          aria-label="Start from a template"
          className="rounded-xl border border-white/10 bg-[var(--panel)] px-3 py-2.5 text-sm font-semibold text-slate-200"
          value=""
          onChange={(e) => {
            const p = PRESETS.find((x) => x.id === e.target.value);
            if (p) setSpec(clone(p.spec));
          }}
        >
          <option value="" disabled>
            Templates…
          </option>
          {PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </PageHeader>

      {error && (
        <div className="flex items-start gap-2 rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
          <XCircle size={16} className="mt-0.5 shrink-0" /> {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-6">
          <MotionSeriesPanel
            version={jobs.map((j) => `${j.id}:${j.status.stage}`).join(',')}
            onOpen={(s, note) => {
              setSpec(clone(s));
              setCheck(note);
              document.getElementById('scenes')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
          />

          {/* AI writer */}
          <section className={`${card} bg-gradient-to-br from-violet-500/[0.08] to-transparent`}>
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-white">
              <Sparkles size={18} className="text-violet-300" /> Write with AI
            </h2>
            <p className="mt-1 text-sm text-slate-400">One line about the video. The AI writes a hook-first scene list you can edit below.</p>
            <textarea
              dir="auto"
              className={`${field} mt-4 min-h-[84px] resize-y`}
              placeholder="e.g. Why the Titanic's sister ship survived a torpedo — or — 3 money habits that keep you broke"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            />
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <div>
                <span className={label}>Language</span>
                <div className="flex rounded-xl border border-white/10 bg-black/30 p-1">
                  {(['en', 'ur'] as const).map((l) => (
                    <button
                      key={l}
                      onClick={() => setLanguage(l)}
                      className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${spec.language === l ? 'bg-white text-slate-950' : 'text-slate-400 hover:text-white'}`}
                    >
                      {l === 'en' ? 'English' : 'اردو'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <span className={label}>Length</span>
                <div className="flex rounded-xl border border-white/10 bg-black/30 p-1">
                  {[25, 35, 50].map((s) => (
                    <button
                      key={s}
                      onClick={() => setSeconds(s)}
                      className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${seconds === s ? 'bg-white text-slate-950' : 'text-slate-400 hover:text-white'}`}
                    >
                      {s}s
                    </button>
                  ))}
                </div>
              </div>
              <div className="min-w-[180px] flex-1">
                <span className={label}>Model</span>
                <select className={field} value={model} onChange={(e) => setModel(e.target.value)}>
                  <option value="gpt-4o-mini">GPT-4o mini (OpenAI)</option>
                  <option value="gpt-4o">GPT-4o (OpenAI)</option>
                  <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                </select>
              </div>
              <button
                onClick={writeWithAi}
                disabled={writing || !topic.trim()}
                className="inline-flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-violet-400 px-4 py-2.5 text-sm font-bold sm:flex-none text-slate-950 transition hover:bg-violet-300 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {writing ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
                {writing ? 'Writing…' : 'Write scenes'}
              </button>
            </div>
          </section>

          {/* Look & voice */}
          <section className={card}>
            <h2 className="font-display text-lg font-bold text-white">Look & voice</h2>
            <div className="mt-4 grid gap-4 xl:grid-cols-2">
              <div className="xl:col-span-2">
                <span className={label}>Title</span>
                <input dir="auto" className={field} value={spec.title} onChange={(e) => update({ title: e.target.value })} />
              </div>
              <div>
                <span className={label}>Colour theme</span>
                <div className="flex gap-2">
                  {(Object.keys(THEMES) as ThemeId[]).map((id) => {
                    const t = THEMES[id];
                    return (
                      <button
                        key={id}
                        onClick={() => update({ theme: id })}
                        title={t.name}
                        aria-label={`${t.name} theme`}
                        className={`h-11 flex-1 rounded-xl border-2 transition ${spec.theme === id ? 'border-white' : 'border-transparent opacity-70 hover:opacity-100'}`}
                        style={{ background: `linear-gradient(135deg, ${t.bg2}, ${t.accent} 70%, ${t.accent2})` }}
                      />
                    );
                  })}
                </div>
              </div>
              <div className="xl:col-span-2">
                {/* Same picker as Cartoon Studio. Motion stores Edge voices without the "edge:" prefix. */}
                <VoicePicker
                  language={spec.language}
                  value={spec.voice === 'none' || isElevenVoice(spec.voice) ? spec.voice : `edge:${spec.voice}`}
                  onChange={(c) => update({ voice: c.startsWith('edge:') ? c.slice(5) : c })}
                  model={spec.elevenModel || 'eleven_v4'}
                  onModel={(m) => update({ elevenModel: m })}
                  allowNone
                />
              </div>
              <label className="flex cursor-pointer items-center gap-3 text-sm text-slate-300 xl:col-span-2">
                <input type="checkbox" checked={spec.captions} onChange={(e) => update({ captions: e.target.checked })} className="h-4 w-4 accent-[var(--accent)]" />
                Word-by-word captions (most viewers watch with the sound off)
              </label>
            </div>
          </section>

          {/* Scenes */}
          <section id="scenes" className={`${card} scroll-mt-6`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-bold text-white">Scenes</h2>
                <p className="mt-0.5 text-sm text-slate-400">
                  {spec.scenes.length} scenes · about {fmtSeconds(total)}. Wrap a word in *stars* to colour it.
                </p>
                {check && spec.series && (
                  <p className="mt-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
                    Check before posting (prices change): {check}
                  </p>
                )}
              </div>
              <select
                aria-label="Add a scene"
                className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm font-semibold text-slate-200"
                value=""
                onChange={(e) => e.target.value && addScene(e.target.value as SceneKind)}
              >
                <option value="">+ Add scene…</option>
                {SCENE_KINDS.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.label}
                  </option>
                ))}
              </select>
            </div>

            <ol className="mt-4 space-y-3">
              {spec.scenes.map((scene, i) => {
                const kind = SCENE_KINDS.find((k) => k.id === scene.kind);
                return (
                  <li key={i} className="rounded-2xl border border-white/[0.07] bg-black/20 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="grid h-7 w-7 place-items-center rounded-lg bg-white/10 text-xs font-bold text-white">{i + 1}</span>
                      <select
                        className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm font-semibold text-white"
                        value={scene.kind}
                        onChange={(e) => updateScene(i, { kind: e.target.value as SceneKind })}
                      >
                        {SCENE_KINDS.map((k) => (
                          <option key={k.id} value={k.id}>
                            {k.label}
                          </option>
                        ))}
                      </select>
                      <span className="hidden text-xs text-slate-500 md:inline">{kind?.hint}</span>
                      <span className="ml-auto text-xs tabular-nums text-slate-500">{sceneSeconds(scene).toFixed(1)}s</span>
                      <div className="flex">
                        <button onClick={() => moveScene(i, -1)} disabled={i === 0} aria-label="Move up" className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-white disabled:opacity-30">
                          <ArrowUp size={15} />
                        </button>
                        <button
                          onClick={() => moveScene(i, 1)}
                          disabled={i === spec.scenes.length - 1}
                          aria-label="Move down"
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-white disabled:opacity-30"
                        >
                          <ArrowDown size={15} />
                        </button>
                        <button onClick={() => removeScene(i)} aria-label="Remove scene" className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-500/10 hover:text-rose-300">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <div className={scene.kind === 'stat' ? '' : 'md:col-span-2'}>
                        <span className={label}>On screen</span>
                        <input dir="auto" className={field} value={scene.heading || ''} onChange={(e) => updateScene(i, { heading: e.target.value })} />
                      </div>
                      {scene.kind === 'stat' && (
                        <div>
                          <span className={label}>Number</span>
                          <input className={field} value={scene.value || ''} placeholder="90%" onChange={(e) => updateScene(i, { value: e.target.value })} />
                        </div>
                      )}
                      {(scene.kind === 'list' || scene.kind === 'compare') && (
                        <div className="md:col-span-2">
                          <span className={label}>{scene.kind === 'compare' ? 'Wrong way · Right way' : 'Points (one per line)'}</span>
                          {scene.kind === 'compare' ? (
                            <div className="grid gap-2 sm:grid-cols-2">
                              {[0, 1].map((k) => (
                                <input
                                  key={k}
                                  dir="auto"
                                  className={field}
                                  value={scene.items?.[k] || ''}
                                  onChange={(e) => {
                                    const items = [...(scene.items || ['', ''])];
                                    items[k] = e.target.value;
                                    updateScene(i, { items });
                                  }}
                                />
                              ))}
                            </div>
                          ) : (
                            <textarea
                              dir="auto"
                              rows={3}
                              className={`${field} resize-y`}
                              value={(scene.items || []).join('\n')}
                              onChange={(e) => updateScene(i, { items: e.target.value.split('\n').slice(0, 4) })}
                            />
                          )}
                        </div>
                      )}
                      {scene.kind === 'timeline' && (
                        <div className="md:col-span-2">
                          <span className={label}>Steps · year (or era) and value, oldest first. Keep one unit for all values.</span>
                          <div className="space-y-2">
                            {[...(scene.points || []), ...((scene.points?.length || 0) < 6 ? [{ label: '', value: '' }] : [])].map((pt, k) => (
                              <div key={k} className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-2">
                                <input
                                  className={field}
                                  placeholder={k === 0 ? '1951' : 'year'}
                                  value={pt.label}
                                  onChange={(e) => {
                                    const points = [...(scene.points || [])];
                                    points[k] = { ...(points[k] || { value: '' }), label: e.target.value };
                                    updateScene(i, { points: points.filter((p) => p.label || p.value) });
                                  }}
                                />
                                <input
                                  dir="auto"
                                  className={field}
                                  placeholder={k === 0 ? '3.4 کروڑ' : 'value'}
                                  value={pt.value}
                                  onChange={(e) => {
                                    const points = [...(scene.points || [])];
                                    points[k] = { ...(points[k] || { label: '' }), value: e.target.value };
                                    updateScene(i, { points: points.filter((p) => p.label || p.value) });
                                  }}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {(scene.kind === 'cta' || scene.kind === 'hook' || scene.kind === 'statement' || scene.kind === 'quote' || scene.kind === 'timeline') && (
                        <div className="md:col-span-2">
                          <span className={label}>Small line (optional)</span>
                          <input dir="auto" className={field} value={scene.sub || ''} onChange={(e) => updateScene(i, { sub: e.target.value || undefined })} />
                        </div>
                      )}
                      <div className="md:col-span-2">
                        <span className={label}>Voice says</span>
                        <textarea
                          dir="auto"
                          rows={2}
                          className={`${field} resize-y ${urdu ? 'leading-8' : ''}`}
                          value={scene.voice}
                          onChange={(e) => updateScene(i, { voice: e.target.value })}
                        />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
            <button
              onClick={() => addScene('statement')}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 py-3 text-sm font-semibold text-slate-400 transition hover:border-white/30 hover:text-white"
            >
              <Plus size={15} /> Add a scene
            </button>
          </section>
        </div>

        {/* Preview + render */}
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className={`${card} p-4`}>
            <div className="mx-auto max-w-[340px]">
              <PlayerPanel spec={spec} />
            </div>
            <p className="mt-3 text-center text-xs text-slate-500">Preview uses estimated timing and no voice. The render adds the voice and exact sync.</p>
            <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
              {[
                ['Length', fmtSeconds(total)],
                ['Scenes', String(spec.scenes.length)],
                ['Size', '1080×1920'],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl bg-black/25 px-2 py-2">
                  <dt className="text-[10px] uppercase tracking-wider text-slate-500">{k}</dt>
                  <dd className="text-sm font-semibold text-white">{v}</dd>
                </div>
              ))}
            </dl>
            <button
              onClick={render}
              disabled={rendering || !spec.scenes.length}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--accent)] px-4 py-3.5 text-sm font-bold text-slate-950 shadow-[0_10px_40px_-10px_var(--accent)] transition hover:brightness-110 disabled:opacity-40"
            >
              {rendering ? <Loader2 size={16} className="animate-spin" /> : <Clapperboard size={16} />}
              Render MP4
            </button>
            <p className="mt-2 text-center text-[11px] text-slate-500">Renders on this PC · about 1-3 min per 30 s</p>
            {elevenChars > 0 && (
              <p className="mt-1 text-center text-[11px] text-amber-300">
                ElevenLabs voice: about {elevenChars} credits the first time. Lines already spoken are reused for free.
              </p>
            )}
          </div>
        </aside>
      </div>

      {/* Renders */}
      <section id="renders" className={`${card} scroll-mt-6`}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-bold text-white">Renders</h2>
          <button onClick={loadJobs} className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-white/[0.06]">
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
        {jobs.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-slate-500">
            No renders yet. Press <b className="text-slate-300">Render MP4</b> and it will show up here.
          </p>
        ) : (
          <ul className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {jobs.map((job) => {
              const t = THEMES[job.theme] || THEMES.ember;
              const done = job.status.stage === 'done';
              const failed = job.status.stage === 'failed';
              const pct = Math.round((job.status.progress || 0) * 100);
              const fileUrl = `/api/motion/files/${job.id}/video.mp4`;
              return (
                <li key={job.id} className="overflow-hidden rounded-2xl border border-white/[0.07] bg-black/20">
                  {done && watching === job.id ? (
                    <video src={fileUrl} controls autoPlay className="aspect-[9/16] max-h-[520px] w-full bg-black object-contain" />
                  ) : (
                    <button
                      onClick={() => done && setWatching(job.id)}
                      disabled={!done}
                      className="relative grid h-36 w-full place-items-center"
                      style={{ background: `linear-gradient(140deg, ${t.bg} 10%, ${t.bg2} 60%, ${t.accent}55)` }}
                      aria-label={done ? `Play ${job.title}` : undefined}
                    >
                      {done ? (
                        <span className="grid h-12 w-12 place-items-center rounded-full bg-white/90 text-slate-950">
                          <Play size={20} className="ml-0.5" />
                        </span>
                      ) : failed ? (
                        <XCircle size={28} className="text-rose-300" />
                      ) : (
                        <Loader2 size={28} className="animate-spin text-white/80" />
                      )}
                    </button>
                  )}
                  <div className="p-4">
                    <p dir="auto" className="line-clamp-1 text-sm font-semibold text-white">
                      {job.title}
                    </p>
                    <div className="mt-1 flex items-center gap-2 text-xs">
                      {done ? (
                        <span className="inline-flex items-center gap-1 text-emerald-300">
                          <CheckCircle2 size={13} /> Ready · {job.status.seconds ? fmtSeconds(job.status.seconds) : ''}
                          {job.status.bytes ? ` · ${(job.status.bytes / 1e6).toFixed(1)} MB` : ''}
                        </span>
                      ) : failed ? (
                        <span className="line-clamp-2 text-rose-300">{job.status.error || 'Failed'}</span>
                      ) : (
                        <span className="text-slate-400">
                          {STAGE_LABEL[job.status.stage] || job.status.stage} · {pct}%
                        </span>
                      )}
                    </div>
                    {!done && !failed && (
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                        <div className="h-full rounded-full bg-[var(--accent)] transition-all duration-500" style={{ width: `${pct}%` }} />
                      </div>
                    )}
                    <div className="mt-3 flex gap-2">
                      {done && (
                        <a
                          href={`${fileUrl}?download=1`}
                          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-white px-3 py-2 text-xs font-bold text-slate-950 hover:bg-slate-200"
                        >
                          <Download size={13} /> Download
                        </a>
                      )}
                      <button
                        onClick={() => editJob(job.id)}
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/[0.06]"
                      >
                        <Pencil size={13} /> Edit
                      </button>
                      <button
                        onClick={() => deleteJob(job.id)}
                        aria-label="Delete render"
                        className="inline-flex items-center justify-center rounded-xl border border-white/10 px-3 py-2 text-slate-400 hover:bg-rose-500/10 hover:text-rose-300"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
