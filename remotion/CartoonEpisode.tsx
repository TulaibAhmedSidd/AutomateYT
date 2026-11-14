import React from 'react';
import { AbsoluteFill, Easing, Freeze, Html5Audio, Img, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { inter, nastaliq, space } from './shared/fonts';
import { Captions } from './shared/Captions';
import {
  FPS,
  episodeFrames,
  shotFrames,
  shotWords,
  isVintageLabel,
  type Camera,
  type CartoonShot,
  type EpisodeRenderProps,
} from '../lib/cartoon/spec';

// One cartoon episode: each shot shows its clip (Phase 2), or its picture with a camera move, or a placeholder card,
// with the narrator's voice and karaoke captions. Used by the live preview and by scripts/render-cartoon.mjs.

const FADE = 8; // frames of crossfade between shots
const CLIP_RATE = 0.85; // animated clips play a little slower so 2 s covers more of the line
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

/** First sentence of a long picture prompt, cut to `max` characters, for the placeholder card. */
function short(text: string, max: number) {
  const first = text.split(/(?<=[.!?])\s/)[0];
  return first.length > max ? `${first.slice(0, max - 1).trimEnd()}…` : first;
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
        {short(shot.scene || 'Scene', 48)}
      </div>
      <div style={{ fontFamily: space.fontFamily, fontWeight: 700, fontSize: 76, lineHeight: 1.1, color: '#fff' }}>{short(shot.action || shot.narration, 90)}</div>
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

/** Moving film grain for old eras: a small noise texture, new every 2 frames, scaled up (cheap to render). */
function Grain({ id }: { id: string }) {
  const frame = useCurrentFrame();
  return (
    <svg width={540} height={960} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.22, mixBlendMode: 'overlay' }}>
      <filter id={id}>
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} seed={Math.floor(frame / 2)} stitchTiles="stitch" />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="100%" height="100%" filter={`url(#${id})`} />
    </svg>
  );
}

function ShotVisual({ shot, frames, first, palette, assetBase, names, transition = false }: {
  shot: CartoonShot;
  frames: number;
  first: boolean;
  palette: Palette;
  assetBase?: string;
  names: string[];
  /** Transition reels: wipe in from the left, always push in, and old eras look like old film. */
  transition?: boolean;
}) {
  const frame = useCurrentFrame();
  if (transition) {
    const w = first ? 1 : interpolate(frame, [0, FADE], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic) });
    const p = Math.min(1, Math.max(0, frame / Math.max(1, frames)));
    const vintage = isVintageLabel(shot.narration);
    return (
      <AbsoluteFill style={{ overflow: 'hidden', backgroundColor: palette.bg, clipPath: `inset(0 ${(1 - w) * 100}% 0 0)` }}>
        {shot.image ? (
          <Img
            src={src(assetBase, shot.image)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: `scale(${1.02 + 0.1 * Easing.out(Easing.quad)(p)})`,
              filter: vintage ? 'sepia(0.6) contrast(1.1) saturate(0.75) brightness(0.95)' : 'contrast(1.05) saturate(1.1)',
            }}
          />
        ) : (
          <PlaceholderCard shot={shot} palette={palette} names={names} />
        )}
        {vintage && <Grain id={`grain-${shot.id}`} />}
        {vintage && <AbsoluteFill style={{ background: 'radial-gradient(ellipse at center, transparent 50%, rgba(20,10,0,0.55) 100%)' }} />}
        {w < 1 && (
          <div style={{ position: 'absolute', top: 0, bottom: 0, left: `calc(${w * 100}% - 5px)`, width: 10, background: '#fff', boxShadow: '0 0 40px 12px rgba(255,255,255,0.7)' }} />
        )}
      </AbsoluteFill>
    );
  }
  const opacity = first ? 1 : interpolate(frame, [0, FADE], [0, 1], { extrapolateRight: 'clamp' });
  const p = Math.min(1, Math.max(0, frame / Math.max(1, frames)));
  let inner: React.ReactNode;
  if (shot.clip) {
    // Play the 2-second clip a little slower, then hold its last frame with a slow camera move until the line ends.
    const clipSrc = src(assetBase, shot.clip);
    const clipSeconds = shot.clipSeconds || 2;
    const played = Math.max(1, Math.round((clipSeconds / CLIP_RATE) * FPS));
    const lastFrame = Math.max(0, Math.floor(clipSeconds * FPS) - 2);
    const hold = Math.max(0, frame - played) / Math.max(1, frames - played);
    const fill: React.CSSProperties = { width: '100%', height: '100%', objectFit: 'cover' };
    inner =
      frame < played ? (
        <OffthreadVideo src={clipSrc} muted playbackRate={CLIP_RATE} style={fill} />
      ) : (
        <AbsoluteFill style={cameraStyle('push-in', hold * 0.4)}>
          <Freeze frame={lastFrame}>
            <OffthreadVideo src={clipSrc} muted style={fill} />
          </Freeze>
        </AbsoluteFill>
      );
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

/** Titles and end cards may be Roman Urdu or English even in an Urdu series: pick font and direction from the text itself. */
function hasUrduLetters(text: string) {
  return /[؀-ۿ]/.test(text);
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

/** Transition reels: a white flash on each cut and a big label that punches in (e.g. "1947", "Seed"). */
function TransitionLabel({ text, palette, flash }: { text: string; palette: Palette; flash: boolean }) {
  const frame = useCurrentFrame();
  // A soft flash at the END of the wipe (frame 8), so the wipe itself stays visible.
  const flashOpacity = flash ? interpolate(frame, [0, 6, 8, 15], [0, 0, 0.45, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) : 0;
  const scale = interpolate(frame, [0, 6, 10], [1.35, 0.96, 1], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  const urdu = hasUrduLetters(text);
  return (
    <>
      <AbsoluteFill style={{ background: '#fff', opacity: flashOpacity }} />
      <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 330 }}>
        <div
          style={{
            transform: `scale(${scale})`,
            fontFamily: urdu ? nastaliq.fontFamily : space.fontFamily,
            fontWeight: 700,
            fontSize: urdu ? 96 : 110,
            lineHeight: urdu ? 1.7 : 1,
            color: '#fff',
            padding: '18px 44px',
            borderRadius: 28,
            background: `${palette.bg}cc`,
            border: `4px solid ${palette.accent}`,
            textShadow: '0 6px 30px rgba(0,0,0,0.6)',
            direction: urdu ? 'rtl' : 'ltr',
            maxWidth: 960,
            textAlign: 'center',
          }}
        >
          {text}
        </div>
      </AbsoluteFill>
    </>
  );
}

/** The whole episode. */
export function CartoonEpisode({ episode, series, assetBase, sfx }: EpisodeRenderProps) {
  const urdu = series.language === 'ur';
  const total = episodeFrames(episode);
  const frames = episode.shots.map(shotFrames);
  const starts = frames.reduce<number[]>((acc, _f, i) => [...acc, i === 0 ? 0 : acc[i - 1] + frames[i - 1]], []);
  const last = episode.shots.length - 1;
  const transition = series.format === 'transition';
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
            transition={transition}
          />
        </Sequence>
      ))}
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.35) 0%, transparent 18%, transparent 62%, rgba(0,0,0,0.55) 100%)' }} />
      {episode.shots.map((shot, i) => (
        <Sequence key={`a-${shot.id}`} from={starts[i]} durationInFrames={frames[i]} name={`${i + 1}. ${transition ? 'label' : 'voice'}`}>
          {shot.audio && <Html5Audio src={src(assetBase, shot.audio)} />}
          {transition && sfx && i > 0 && <Html5Audio src={src(assetBase, sfx.whoosh)} volume={0.8} />}
          {transition && sfx && i > 0 && i === last && <Html5Audio src={src(assetBase, sfx.impact)} volume={0.7} />}
          {transition ? (
            <TransitionLabel text={shot.narration} palette={series.palette} flash={i > 0} />
          ) : (
            <Captions words={shotWords(shot)} urdu={urdu} accent={series.palette.accent} bottom={260} />
          )}
          {i === last && episode.endHook && <EndHook text={episode.endHook} palette={series.palette} urdu={hasUrduLetters(episode.endHook)} />}
        </Sequence>
      ))}
      <Sequence from={0} durationInFrames={Math.min(TITLE_FRAMES, total)} name="title">
        <TitleCard title={episode.title} seriesName={series.name} palette={series.palette} urdu={hasUrduLetters(episode.title)} />
      </Sequence>
      <ProgressBar total={total} accent={series.palette.accent} />
    </AbsoluteFill>
  );
}
