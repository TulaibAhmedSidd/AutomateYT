import React from 'react';
import { AbsoluteFill, Easing, Html5Audio, Img, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { inter, nastaliq, space } from './shared/fonts';
import { Captions } from './shared/Captions';
import {
  FPS,
  episodeFrames,
  shotFrames,
  shotWords,
  type Camera,
  type CartoonShot,
  type EpisodeRenderProps,
} from '../lib/cartoon/spec';

// One cartoon episode: each shot shows its clip (Phase 2), or its picture with a camera move, or a placeholder card,
// with the narrator's voice and karaoke captions. Used by the live preview and by scripts/render-cartoon.mjs.

const FADE = 8; // frames of crossfade between shots
const TITLE_FRAMES = Math.round(1.4 * FPS);

type Palette = EpisodeRenderProps['series']['palette'];

function src(assetBase: string | undefined, name: string) {
  return assetBase ? `${assetBase}/${name}` : staticFile(name);
}

/** Scale and offset over the shot for each camera move (p goes 0 → 1). */
function cameraStyle(camera: Camera, p: number): React.CSSProperties {
  const e = Easing.inOut(Easing.cubic)(p);
  const lerp = (a: number, b: number) => a + (b - a) * e;
  switch (camera) {
    case 'push-in':
      return { transform: `scale(${lerp(1, 1.18)})` };
    case 'pull-out':
      return { transform: `scale(${lerp(1.18, 1)})` };
    case 'pan-left':
      return { transform: `scale(1.15) translateX(${lerp(5, -5)}%)` };
    case 'pan-right':
      return { transform: `scale(1.15) translateX(${lerp(-5, 5)}%)` };
    case 'orbit':
      return { transform: `scale(1.1) rotate(${lerp(-1.5, 1.5)}deg)` };
    case 'low-angle':
      return { transform: `scale(1.12) translateY(${lerp(4, 0)}%)`, transformOrigin: '50% 100%' };
    default:
      return { transform: `scale(${lerp(1, 1.04)})` };
  }
}

/** Shown when a shot has no picture yet: says what the shot will show, so a stills test still makes sense. */
function PlaceholderCard({ shot, palette, names }: { shot: CartoonShot; palette: Palette; names: string[] }) {
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(900px 900px at 30% 25%, ${palette.accent}55, transparent 60%), radial-gradient(800px 800px at 80% 80%, ${palette.accent}22, transparent 60%), ${palette.bg}`,
        justifyContent: 'center',
        padding: '0 110px',
        gap: 34,
      }}
    >
      <div style={{ fontFamily: inter.fontFamily, fontWeight: 700, fontSize: 30, letterSpacing: 6, color: palette.accent, textTransform: 'uppercase' }}>
        {shot.scene || 'Scene'}
      </div>
      <div style={{ fontFamily: space.fontFamily, fontWeight: 700, fontSize: 76, lineHeight: 1.1, color: '#fff' }}>{shot.action || shot.narration}</div>
      {names.length > 0 && (
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {names.map((n) => (
            <span key={n} style={{ fontFamily: inter.fontFamily, fontWeight: 700, fontSize: 30, color: palette.bg, background: palette.accent, padding: '10px 26px', borderRadius: 999 }}>
              {n}
            </span>
          ))}
        </div>
      )}
    </AbsoluteFill>
  );
}

function ShotVisual({ shot, frames, first, palette, assetBase, names }: {
  shot: CartoonShot;
  frames: number;
  first: boolean;
  palette: Palette;
  assetBase?: string;
  names: string[];
}) {
  const frame = useCurrentFrame();
  const opacity = first ? 1 : interpolate(frame, [0, FADE], [0, 1], { extrapolateRight: 'clamp' });
  const p = Math.min(1, Math.max(0, frame / Math.max(1, frames)));
  let inner: React.ReactNode;
  if (shot.clip) {
    inner = <OffthreadVideo src={src(assetBase, shot.clip)} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />;
  } else if (shot.image) {
    inner = <Img src={src(assetBase, shot.image)} style={{ width: '100%', height: '100%', objectFit: 'cover', ...cameraStyle(shot.camera, p) }} />;
  } else {
    inner = (
      <AbsoluteFill style={cameraStyle(shot.camera, p)}>
        <PlaceholderCard shot={shot} palette={palette} names={names} />
      </AbsoluteFill>
    );
  }
  return <AbsoluteFill style={{ opacity, overflow: 'hidden', backgroundColor: palette.bg }}>{inner}</AbsoluteFill>;
}

function TitleCard({ title, seriesName, palette, urdu }: { title: string; seriesName: string; palette: Palette; urdu: boolean }) {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 6, TITLE_FRAMES - 8, TITLE_FRAMES], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const y = interpolate(frame, [0, 10], [30, 0], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  return (
    <AbsoluteFill style={{ justifyContent: 'flex-start', alignItems: 'center', paddingTop: 230, opacity }}>
      <div style={{ transform: `translateY(${y}px)`, textAlign: 'center', padding: '28px 48px', borderRadius: 32, background: 'rgba(0,0,0,0.45)', maxWidth: 920 }}>
        <div style={{ fontFamily: inter.fontFamily, fontWeight: 700, fontSize: 30, letterSpacing: 6, color: palette.accent, textTransform: 'uppercase' }}>{seriesName}</div>
        <div style={{ fontFamily: urdu ? nastaliq.fontFamily : space.fontFamily, fontWeight: 700, fontSize: urdu ? 64 : 70, lineHeight: urdu ? 1.8 : 1.1, color: '#fff', marginTop: 10 }}>
          {title}
        </div>
      </div>
    </AbsoluteFill>
  );
}

function EndHook({ text, palette, urdu }: { text: string; palette: Palette; urdu: boolean }) {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [6, 14], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ justifyContent: 'flex-start', alignItems: 'center', paddingTop: 230, opacity }}>
      <div
        style={{
          fontFamily: urdu ? nastaliq.fontFamily : space.fontFamily,
          fontWeight: 700,
          fontSize: urdu ? 54 : 60,
          lineHeight: urdu ? 1.8 : 1.15,
          color: palette.bg,
          background: palette.accent,
          padding: '22px 44px',
          borderRadius: 30,
          maxWidth: 900,
          textAlign: 'center',
          direction: urdu ? 'rtl' : 'ltr',
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
}

function ProgressBar({ total, accent }: { total: number; accent: string }) {
  const frame = useCurrentFrame();
  return (
    <div style={{ position: 'absolute', top: 70, left: 90, right: 90, height: 10, borderRadius: 99, background: 'rgba(255,255,255,0.18)', overflow: 'hidden' }}>
      <div style={{ width: `${(frame / total) * 100}%`, height: '100%', background: accent }} />
    </div>
  );
}

/** The whole episode. */
export function CartoonEpisode({ episode, series, assetBase }: EpisodeRenderProps) {
  const urdu = series.language === 'ur';
  const total = episodeFrames(episode);
  const frames = episode.shots.map(shotFrames);
  const starts = frames.reduce<number[]>((acc, _f, i) => [...acc, i === 0 ? 0 : acc[i - 1] + frames[i - 1]], []);
  const last = episode.shots.length - 1;
  return (
    <AbsoluteFill style={{ backgroundColor: series.palette.bg }}>
      {episode.shots.map((shot, i) => (
        <Sequence key={`v-${shot.id}`} from={starts[i]} durationInFrames={frames[i] + (i < last ? FADE : 0)} name={`${i + 1}. picture`}>
          <ShotVisual
            shot={shot}
            frames={frames[i]}
            first={i === 0}
            palette={series.palette}
            assetBase={assetBase}
            names={shot.characters.map((c) => c.charAt(0).toUpperCase() + c.slice(1))}
          />
        </Sequence>
      ))}
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.35) 0%, transparent 18%, transparent 62%, rgba(0,0,0,0.55) 100%)' }} />
      {episode.shots.map((shot, i) => (
        <Sequence key={`a-${shot.id}`} from={starts[i]} durationInFrames={frames[i]} name={`${i + 1}. voice`}>
          {shot.audio && <Html5Audio src={src(assetBase, shot.audio)} />}
          <Captions words={shotWords(shot)} urdu={urdu} accent={series.palette.accent} bottom={260} />
          {i === last && episode.endHook && <EndHook text={episode.endHook} palette={series.palette} urdu={urdu} />}
        </Sequence>
      ))}
      <Sequence from={0} durationInFrames={Math.min(TITLE_FRAMES, total)} name="title">
        <TitleCard title={episode.title} seriesName={series.name} palette={series.palette} urdu={urdu} />
      </Sequence>
      <ProgressBar total={total} accent={series.palette.accent} />
    </AbsoluteFill>
  );
}
