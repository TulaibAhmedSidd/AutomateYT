'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { CalendarClock, Check, Copy, Download, ExternalLink, Loader2, PlaySquare, ShieldAlert, Upload } from 'lucide-react';

type Target = { kind: 'motion'; jobId: string } | { kind: 'cartoon'; episodeId: string };
type Entry = { key: string; title: string; method: 'api' | 'manual'; privacy: string; publishAt?: string; url?: string; at: string };
type State = {
  entry: Entry | null;
  nextSlots: string[];
  plan: { times: string[]; audited: boolean };
  connected: boolean;
  channelTitle: string | null;
  error?: string;
};

type Props = {
  target: Target;
  /** Prefill: the script's title, description and tags. Made for kids is "No" unless the series says otherwise. */
  defaults: { title: string; description?: string; tags?: string[]; madeForKids?: boolean; categoryId?: '24' | '27' };
  downloadUrl: string;
  heading?: string;
};

const field =
  'w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none transition focus:border-[var(--accent)]/60';
const label = 'mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500';
const AUDIT_FORM = 'https://support.google.com/youtube/contact/yt_api_form';

/** "Sun 16 Nov, 7:00 pm" in this PC's time. */
export function fmtWhen(iso?: string) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

/** ISO → value for <input type="datetime-local"> (local time). */
function toLocalInput(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** #Shorts first, then up to 4 tags as hashtags. */
function hashtagLine(tags: string[]) {
  const clean = tags.map((t) => t.replace(/^#/, '').replace(/[^\p{L}\p{N}]+/gu, '')).filter((t) => t.length > 1);
  return ['#Shorts', ...[...new Set(clean)].slice(0, 4).map((t) => `#${t}`)].join(' ');
}

/**
 * Publish a finished video to YouTube, the same way in every studio:
 *  - from the app (title, description with hashtags, tags, Made for kids = No, category, now / scheduled / private), or
 *  - by hand in YouTube Studio (copy buttons + "Mark as posted"), which is the way that works before the API audit.
 * Every post is logged, so lists show what is on YouTube, and the next free slot of the posting plan is suggested.
 */
export function YoutubePublish({ target, defaults, downloadUrl, heading = 'Step 4 · Publish to YouTube' }: Props) {
  const id = target.kind === 'motion' ? target.jobId : target.episodeId;
  const [s, setS] = useState<State | null>(null);
  const [title, setTitle] = useState(defaults.title);
  const [description, setDescription] = useState(() => `${(defaults.description || defaults.title).replace(/(\s*#\S+)+\s*$/, '').trim()}\n\n${hashtagLine(defaults.tags || [])}`);
  const [tags, setTags] = useState((defaults.tags || []).join(', '));
  const [kids, setKids] = useState(defaults.madeForKids === true);
  const [category, setCategory] = useState<'24' | '27'>(defaults.categoryId || '24');
  const [when, setWhen] = useState<'slot' | 'pick' | 'public' | 'private'>('slot');
  const [picked, setPicked] = useState('');
  const [manual, setManual] = useState(false);
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [times, setTimes] = useState('');

  const load = useCallback(() => {
    fetch(`/api/youtube/publish?kind=${target.kind}&id=${encodeURIComponent(id)}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d: State) => {
        if (d.error) setError(d.error);
        else {
          setS(d);
          setTimes(d.plan.times.join(', '));
        }
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, [target.kind, id]);
  useEffect(() => {
    const t = window.setTimeout(load, 0);
    return () => window.clearTimeout(t);
  }, [load]);

  async function post(body: Record<string, unknown>, what: string) {
    setBusy(what);
    setError(null);
    try {
      const res = await fetch('/api/youtube/publish', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const d = await res.json();
      if (!res.ok || d.error) throw new Error(d.error || `Request failed (${res.status})`);
      setS(d);
      setTimes(d.plan.times.join(', '));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function forget() {
    if (!s?.entry || !window.confirm('Remove this record? (The video on YouTube is not touched.)')) return;
    await fetch(`/api/youtube/publish?key=${encodeURIComponent(s.entry.key)}`, { method: 'DELETE' });
    load();
  }

  function copy(text: string, what: string) {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(what);
      window.setTimeout(() => setCopied(null), 1500);
    });
  }

  if (!s) {
    return (
      <section className="rounded-3xl border border-white/[0.07] bg-[var(--panel)] p-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--accent)]">{heading}</p>
        {error ? <p className="mt-2 text-sm text-rose-300">{error}</p> : <Loader2 className="mt-2 animate-spin text-slate-500" size={18} />}
      </section>
    );
  }

  const slot = s.nextSlots[0];
  const publishAt = when === 'slot' ? slot : when === 'pick' && picked ? new Date(picked).toISOString() : undefined;
  const tagList = tags.split(',').map((t) => t.trim()).filter(Boolean);
  const whenText = when === 'public' ? 'right now' : when === 'private' ? 'private (only you)' : publishAt ? fmtWhen(publishAt) : 'pick a time';

  return (
    <section className="rounded-3xl border border-red-500/25 bg-[var(--panel)] p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-red-400">
          <PlaySquare size={15} /> {heading}
        </p>
        <p className="text-xs text-slate-400">
          {s.connected ? (
            <>
              Channel: <b className="text-white">{s.channelTitle || 'connected'}</b>
            </>
          ) : (
            <>
              YouTube not connected ·{' '}
              <Link href="/connections" className="text-sky-300 underline">
                Connect
              </Link>
            </>
          )}
        </p>
      </div>

      {s.entry ? (
        <div className="mt-3 space-y-2">
          <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/[0.07] p-4">
            <p className="text-sm font-bold text-emerald-200">
              {s.entry.privacy === 'scheduled'
                ? `✅ Scheduled: goes live ${fmtWhen(s.entry.publishAt)}`
                : s.entry.privacy === 'private' || s.entry.privacy === 'unlisted'
                  ? `✅ Uploaded as ${s.entry.privacy} (${fmtWhen(s.entry.at)})`
                  : `✅ Posted ${fmtWhen(s.entry.publishAt || s.entry.at)}`}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {s.entry.method === 'manual' ? 'Uploaded by you in YouTube Studio.' : 'Uploaded by the app.'}{' '}
              {s.entry.url && (
                <a href={s.entry.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sky-300 underline">
                  Open on YouTube <ExternalLink size={11} />
                </a>
              )}
            </p>
          </div>
          <p className="flex items-center gap-2 rounded-xl bg-black/25 px-3 py-2 text-sm text-slate-200">
            <CalendarClock size={15} className="text-[var(--accent)]" /> Next video should go up: <b className="text-white">{fmtWhen(slot)}</b>
          </p>
          <button onClick={forget} className="text-[11px] text-slate-500 underline hover:text-slate-300">
            Remove this record (made by mistake)
          </button>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <label className="block">
            <span className={label}>Title ({title.length}/100)</span>
            <input dir="auto" className={field} value={title} maxLength={100} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="block">
            <span className={label}>Description with hashtags</span>
            <textarea dir="auto" rows={5} className={`${field} resize-y`} value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <label className="block">
            <span className={label}>Tags (comma between)</span>
            <input dir="auto" className={field} value={tags} onChange={(e) => setTags(e.target.value)} />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <span className={label}>Made for kids?</span>
              <div className="grid grid-cols-2 gap-1 rounded-xl bg-black/30 p-1">
                {([false, true] as const).map((v) => (
                  <button
                    key={String(v)}
                    onClick={() => setKids(v)}
                    className={`min-h-10 rounded-lg text-xs font-semibold ${kids === v ? 'bg-white text-slate-950' : 'text-slate-400 hover:text-white'}`}
                  >
                    {v ? 'Yes, made for kids' : 'No (normal)'}
                  </button>
                ))}
              </div>
            </div>
            <label className="block">
              <span className={label}>Category</span>
              <select className={field} value={category} onChange={(e) => setCategory(e.target.value as '24' | '27')}>
                <option value="27">Education</option>
                <option value="24">Entertainment</option>
              </select>
            </label>
          </div>

          <div>
            <span className={label}>When should it go live?</span>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {(
                [
                  ['slot', `Next free slot: ${fmtWhen(slot)}`],
                  ['pick', 'Pick a date and time'],
                  ['public', 'Public right now'],
                  ['private', 'Private (only me)'],
                ] as const
              ).map(([v, text]) => (
                <button
                  key={v}
                  onClick={() => setWhen(v)}
                  className={`min-h-11 rounded-xl border px-3 text-left text-xs font-semibold ${
                    when === v ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-white' : 'border-white/10 text-slate-400 hover:text-white'
                  }`}
                >
                  {text}
                </button>
              ))}
            </div>
            {when === 'pick' && <input type="datetime-local" className={`${field} mt-2`} value={picked} min={toLocalInput(new Date().toISOString())} onChange={(e) => setPicked(e.target.value)} />}
          </div>

          {!s.plan.audited && (
            <div className="flex gap-2 rounded-2xl border border-amber-400/30 bg-amber-400/[0.07] p-3 text-xs text-amber-100">
              <ShieldAlert size={16} className="mt-0.5 shrink-0 text-amber-300" />
              <div>
                <p>
                  <b>Until your Google project passes YouTube&apos;s API audit</b>, YouTube locks every video the app uploads as <b>private</b>, even
                  scheduled ones, and it cannot be changed later. So for now upload it yourself in YouTube Studio (button below): it takes one minute.
                </p>
                <p className="mt-1">
                  The audit is free:{' '}
                  <a href={AUDIT_FORM} target="_blank" rel="noreferrer" className="underline">
                    YouTube API audit form
                  </a>
                  .{' '}
                  <button onClick={() => post({ action: 'plan', audited: true }, 'plan')} className="underline">
                    My project passed the audit
                  </button>
                </p>
              </div>
            </div>
          )}

          <div className="grid gap-2 sm:grid-cols-2">
            <button
              onClick={() => setManual((m) => !m)}
              className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold ${
                s.plan.audited ? 'border border-white/10 text-slate-200 hover:bg-white/[0.06]' : 'bg-red-600 text-white hover:bg-red-500'
              }`}
            >
              <Upload size={15} /> I&apos;ll upload in YouTube Studio
            </button>
            <button
              onClick={() =>
                post(
                  {
                    action: 'upload',
                    target,
                    title,
                    description,
                    tags: tagList,
                    madeForKids: kids,
                    categoryId: category,
                    when: when === 'slot' || when === 'pick' ? 'schedule' : when,
                    publishAt,
                  },
                  'upload',
                )
              }
              disabled={!s.connected || busy !== null || !title.trim() || (when === 'pick' && !picked)}
              className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold disabled:opacity-40 ${
                s.plan.audited ? 'bg-red-600 text-white hover:bg-red-500' : 'border border-white/10 text-slate-300 hover:bg-white/[0.06]'
              }`}
            >
              {busy === 'upload' ? <Loader2 size={15} className="animate-spin" /> : <PlaySquare size={15} />}
              {busy === 'upload' ? 'Uploading…' : s.plan.audited ? `Upload from the app · ${whenText}` : 'Upload from the app (stays private)'}
            </button>
          </div>

          {manual && (
            <ol className="space-y-2 rounded-2xl bg-black/25 p-4 text-sm text-slate-300">
              <li>
                1.{' '}
                <a href={downloadUrl} className="inline-flex items-center gap-1 font-semibold text-white underline">
                  <Download size={13} /> Download the MP4
                </a>
              </li>
              <li>
                2. Open{' '}
                <a href="https://studio.youtube.com" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-white underline">
                  YouTube Studio <ExternalLink size={12} />
                </a>{' '}
                → Create → Upload videos → pick the MP4.
              </li>
              <li className="flex flex-wrap items-center gap-1.5">
                3. Paste:
                {(
                  [
                    ['title', 'Title', title],
                    ['description', 'Description', description],
                    ['tags', 'Tags', tagList.join(', ')],
                  ] as const
                ).map(([k, text, value]) => (
                  <button key={k} onClick={() => copy(value, k)} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-white/10 px-2.5 text-xs font-semibold hover:bg-white/[0.06]">
                    {copied === k ? <Check size={13} className="text-emerald-300" /> : <Copy size={13} />} {copied === k ? 'Copied' : `Copy ${text.toLowerCase()}`}
                  </button>
                ))}
              </li>
              <li>
                4. Audience: <b className="text-white">{kids ? 'Yes, it is made for kids' : 'No, it is not made for kids'}</b>. Visibility:{' '}
                <b className="text-white">{when === 'public' ? 'Public' : when === 'private' ? 'Private' : `Schedule → ${whenText}`}</b>.
              </li>
              <li className="space-y-2">
                <span>5. Paste the video link (optional) and mark it posted:</span>
                <input className={field} placeholder="https://youtube.com/shorts/…" value={link} onChange={(e) => setLink(e.target.value)} />
                <button
                  onClick={() => post({ action: 'manual', target, title, publishAt: when === 'public' ? undefined : publishAt, url: link }, 'manual')}
                  disabled={busy !== null || (when === 'pick' && !picked)}
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 text-sm font-bold text-slate-950 hover:bg-emerald-400 disabled:opacity-40"
                >
                  {busy === 'manual' ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Mark as posted ({whenText})
                </button>
              </li>
            </ol>
          )}
          {error && <p className="text-sm text-rose-300">{error}</p>}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-3 text-xs text-slate-400">
        <CalendarClock size={14} /> Posting plan: one video at
        <input
          className="w-36 rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white"
          value={times}
          onChange={(e) => setTimes(e.target.value)}
          aria-label="Posting times, like 19:00 or 13:00, 19:00"
        />
        every day
        <button onClick={() => post({ action: 'plan', times: times.split(',').map((t) => t.trim()) }, 'plan')} className="rounded-lg border border-white/10 px-2 py-1.5 font-semibold hover:bg-white/[0.06]">
          {busy === 'plan' ? 'Saving…' : 'Save'}
        </button>
        {s.plan.audited && (
          <button onClick={() => post({ action: 'plan', audited: false }, 'plan')} className="ml-auto text-[11px] text-slate-500 underline">
            Audit not passed yet
          </button>
        )}
      </div>
    </section>
  );
}
