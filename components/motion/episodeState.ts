import type { MotionSeriesEpisode } from '@/lib/motion/series';

/** "Sun 16 Nov, 7:00 pm" in this PC's time. */
export function fmtWhen(iso?: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

export type EpisodeStateKind = 'posted' | 'scheduled' | 'ready' | 'working' | 'failed' | 'todo';

/** Where one motion episode stands, newest first: on YouTube, scheduled, video ready, rendering, failed, not made. */
export function episodeState(ep: MotionSeriesEpisode): { kind: EpisodeStateKind; label: string; tone: string } {
  const post = ep.post;
  if (post) {
    const live = post.publishAt ? Date.parse(post.publishAt) : Date.parse(post.at);
    if (post.privacy === 'scheduled' && live > Date.now()) return { kind: 'scheduled', label: `📅 Scheduled on YouTube · ${fmtWhen(post.publishAt)}`, tone: 'text-sky-300' };
    if (post.privacy === 'private' || post.privacy === 'unlisted') return { kind: 'posted', label: `🔒 On YouTube as ${post.privacy}`, tone: 'text-amber-300' };
    return { kind: 'posted', label: `▶ Live on YouTube · ${fmtWhen(post.publishAt || post.at)}`, tone: 'text-emerald-300' };
  }
  const st = ep.job?.status;
  if (!st) return { kind: 'todo', label: 'Not made yet', tone: 'text-slate-500' };
  if (st.stage === 'done') return { kind: 'ready', label: '🎬 Video ready · not on YouTube yet', tone: 'text-emerald-300' };
  if (st.stage === 'failed') return { kind: 'failed', label: '⚠️ Last render failed · open to try again', tone: 'text-rose-300' };
  return { kind: 'working', label: `⏳ Making the video · ${Math.round(st.progress * 100)}%`, tone: 'text-sky-300' };
}
