import React from 'react';
import {
  AbsoluteFill,
  Html5Audio,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  Easing,
} from 'remotion';
import { loadFont as loadSpace } from '@remotion/google-fonts/SpaceGrotesk';
import { loadFont as loadInter } from '@remotion/google-fonts/Inter';
import { loadFont as loadNastaliq } from '@remotion/google-fonts/NotoNastaliqUrdu';
import {
  FPS,
  THEMES,
  plainText,
  sceneFrames,
  sceneWords,
  totalFrames,
  type MotionScene,
  type MotionSpec,
  type Theme,
} from '../lib/motion/spec';

const space = loadSpace('normal', { weights: ['700'], subsets: ['latin'] });
const inter = loadInter('normal', { weights: ['500', '700', '800'], subsets: ['latin'] });
const nastaliq = loadNastaliq('normal', { weights: ['400', '700'], subsets: ['arabic'] });

type Ctx = { theme: Theme; urdu: boolean; display: string; body: string };

function fonts(urdu: boolean) {
  return urdu
    ? { display: nastaliq.fontFamily, body: nastaliq.fontFamily }
    : { display: space.fontFamily, body: inter.fontFamily };
}

/** "Open with the *payoff*" → accent-coloured word. */
function Rich({ text, ctx, pop = false }: { text: string; ctx: Ctx; pop?: boolean }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tokens = text.split(/(\*[^*]+\*)/g).filter(Boolean).flatMap((chunk) => {
    const hot = chunk.startsWith('*') && chunk.endsWith('*');
    return (hot ? chunk.slice(1, -1) : chunk)
      .split(/(\s+)/)
      .filter((t) => t.length)
      .map((t) => ({ t, hot }));
  });
  let wordIndex = 0;
  return (
    <>
      {tokens.map((tok, i) => {
        if (/^\s+$/.test(tok.t)) return <span key={i}> </span>;
        const idx = wordIndex++;
        const s = pop ? spring({ frame: frame - 3 - idx * 3, fps, config: { damping: 14, stiffness: 160 } }) : 1;
        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              color: tok.hot ? ctx.theme.accent : undefined,
              transform: `translateY(${(1 - s) * 40}px) scale(${0.85 + s * 0.15})`,
              opacity: s,
              textShadow: tok.hot ? `0 0 40px ${ctx.theme.accent}66` : undefined,
            }}
          >
            {tok.t}
          </span>
        );
      })}
    </>
  );
}

function Background({ theme }: { theme: Theme }) {
  const frame = useCurrentFrame();
  const a = frame / 90;
  const orb = (x: number, y: number, size: number, color: string, phase: number) => (
    <div
      style={{
        position: 'absolute',
        left: x + Math.sin(a + phase) * 90,
        top: y + Math.cos(a * 0.8 + phase) * 120,
        width: size,
        height: size,
        borderRadius: '50%',
        // A soft radial gradient looks like a blurred orb but costs almost nothing to render.
        background: `radial-gradient(circle, ${color}8c 0%, ${color}33 38%, transparent 70%)`,
      }}
    />
  );
  return (
    <AbsoluteFill style={{ background: `linear-gradient(160deg, ${theme.bg} 0%, ${theme.bg2} 55%, ${theme.bg} 100%)`, overflow: 'hidden' }}>
      {orb(-420, -100, 1200, theme.accent, 0)}
      {orb(300, 940, 1300, theme.accent2, 2)}
      {orb(160, 420, 800, theme.accent, 4)}
      <AbsoluteFill
        style={{
          backgroundImage: `linear-gradient(${theme.text}0d 1px, transparent 1px), linear-gradient(90deg, ${theme.text}0d 1px, transparent 1px)`,
          backgroundSize: '90px 90px',
          backgroundPosition: `0 ${(frame * 0.6) % 90}px`,
          maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
        }}
      />
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,0.55) 100%)' }} />
    </AbsoluteFill>
  );
}

/** Enter with a spring, leave with a quick fade + lift. */
function SceneShell({ children, frames }: { children: React.ReactNode; frames: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 18, stiffness: 120 } });
  const exit = interpolate(frame, [frames - 8, frames], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill
      style={{
        padding: '0 90px',
        justifyContent: 'center',
        alignItems: 'center',
        opacity: Math.min(enter, exit),
        transform: `translateY(${(1 - enter) * 60 - (1 - exit) * 60}px) scale(${0.96 + enter * 0.04})`,
        paddingBottom: 260,
      }}
    >
      {children}
    </AbsoluteFill>
  );
}

function Heading({ text, ctx, size = 104, pop = true }: { text: string; ctx: Ctx; size?: number; pop?: boolean }) {
  return (
    <div
      style={{
        fontFamily: ctx.display,
        fontWeight: 700,
        fontSize: ctx.urdu ? size * 0.82 : size,
        lineHeight: ctx.urdu ? 1.9 : 1.04,
        letterSpacing: ctx.urdu ? 0 : -2,
        color: ctx.theme.text,
        textAlign: 'center',
        direction: ctx.urdu ? 'rtl' : 'ltr',
      }}
    >
      <Rich text={text} ctx={ctx} pop={pop} />
    </div>
  );
}

function Sub({ text, ctx, delay = 14 }: { text: string; ctx: Ctx; delay?: number }) {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [delay, delay + 12], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <div
      style={{
        marginTop: 36,
        fontFamily: ctx.body,
        fontWeight: 500,
        fontSize: ctx.urdu ? 44 : 46,
        lineHeight: ctx.urdu ? 1.9 : 1.3,
        color: ctx.theme.muted,
        textAlign: 'center',
        opacity: o,
        direction: ctx.urdu ? 'rtl' : 'ltr',
      }}
    >
      {text}
    </div>
  );
}

function Hook({ scene, ctx }: { scene: MotionScene; ctx: Ctx }) {
  const frame = useCurrentFrame();
  const pulse = 1 + Math.sin(frame / 6) * 0.03;
  return (
    <>
      <div
        style={{
          marginBottom: 40,
          padding: '14px 30px',
          borderRadius: 999,
          border: `2px solid ${ctx.theme.accent}`,
          color: ctx.theme.accent,
          fontFamily: inter.fontFamily,
          fontWeight: 800,
          fontSize: 34,
          letterSpacing: 6,
          transform: `scale(${pulse})`,
        }}
      >
        {ctx.urdu ? '⚡' : 'WAIT —'}
      </div>
      <Heading text={scene.heading || plainText(scene.voice)} ctx={ctx} size={118} />
      {scene.sub && <Sub text={scene.sub} ctx={ctx} />}
    </>
  );
}

function parseValue(value: string) {
  const m = value.match(/^([^\d-]*)(-?[\d,.]+)(.*)$/);
  if (!m) return null;
  const num = parseFloat(m[2].replace(/,/g, ''));
  if (Number.isNaN(num)) return null;
  const decimals = (m[2].split('.')[1] || '').length;
  return { prefix: m[1], num, suffix: m[3], decimals };
}

function Stat({ scene, ctx }: { scene: MotionScene; ctx: Ctx }) {
  const frame = useCurrentFrame();
  const value = scene.value || '';
  const parsed = parseValue(value);
  const p = interpolate(frame, [4, 40], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  const shown = parsed ? `${parsed.prefix}${(parsed.num * p).toFixed(parsed.decimals)}${parsed.suffix}` : value;
  const percent = parsed && parsed.suffix.trim().startsWith('%') ? Math.min(100, parsed.num) / 100 : 0.75;
  const R = 300;
  const C = 2 * Math.PI * R;
  return (
    <>
      <div style={{ position: 'relative', width: 700, height: 700, display: 'grid', placeItems: 'center' }}>
        <svg width={700} height={700} style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}>
          <circle cx={350} cy={350} r={R} stroke={`${ctx.theme.text}1a`} strokeWidth={26} fill="none" />
          <circle
            cx={350}
            cy={350}
            r={R}
            stroke={ctx.theme.accent}
            strokeWidth={26}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - percent * p)}
            style={{ filter: `drop-shadow(0 0 24px ${ctx.theme.accent})` }}
          />
        </svg>
        <div style={{ fontFamily: space.fontFamily, fontWeight: 700, fontSize: value.length > 5 ? 150 : 200, color: ctx.theme.text, letterSpacing: -6 }}>
          {shown}
        </div>
      </div>
      {scene.heading && (
        <div style={{ marginTop: 50 }}>
          <Heading text={scene.heading} ctx={ctx} size={72} pop={false} />
        </div>
      )}
    </>
  );
}

function List({ scene, ctx, frames }: { scene: MotionScene; ctx: Ctx; frames: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const items = scene.items || [];
  const gap = Math.max(8, Math.floor((frames * 0.75) / Math.max(1, items.length + 1)));
  return (
    <div style={{ width: '100%' }}>
      {scene.heading && <Heading text={scene.heading} ctx={ctx} size={92} />}
      <div style={{ marginTop: 60, display: 'flex', flexDirection: 'column', gap: 28 }}>
        {items.map((item, i) => {
          const s = spring({ frame: frame - gap * (i + 1), fps, config: { damping: 16, stiffness: 140 } });
          return (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 32,
                padding: '34px 40px',
                borderRadius: 36,
                background: `${ctx.theme.text}0f`,
                border: `2px solid ${ctx.theme.text}1f`,
                opacity: s,
                transform: `translateX(${(1 - s) * (ctx.urdu ? 160 : -160)}px)`,
                direction: ctx.urdu ? 'rtl' : 'ltr',
              }}
            >
              <span
                style={{
                  flexShrink: 0,
                  width: 88,
                  height: 88,
                  borderRadius: 26,
                  display: 'grid',
                  placeItems: 'center',
                  background: ctx.theme.accent,
                  color: ctx.theme.bg,
                  fontFamily: space.fontFamily,
                  fontWeight: 700,
                  fontSize: 50,
                }}
              >
                {i + 1}
              </span>
              <span style={{ fontFamily: ctx.body, fontWeight: 700, fontSize: ctx.urdu ? 54 : 60, lineHeight: ctx.urdu ? 1.8 : 1.15, color: ctx.theme.text }}>
                {item}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Compare({ scene, ctx }: { scene: MotionScene; ctx: Ctx }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const [left = 'Before', right = 'After'] = scene.items || [];
  const l = spring({ frame: frame - 4, fps, config: { damping: 16 } });
  const r = spring({ frame: frame - 16, fps, config: { damping: 16 } });
  const vs = spring({ frame: frame - 10, fps, config: { damping: 9, stiffness: 200 } });
  const card = (label: string, good: boolean, s: number, dir: number) => (
    <div
      style={{
        flex: 1,
        minHeight: 520,
        padding: 44,
        borderRadius: 44,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        background: good ? `${ctx.theme.accent}26` : `${ctx.theme.text}0d`,
        border: `3px solid ${good ? ctx.theme.accent : `${ctx.theme.text}26`}`,
        opacity: s,
        transform: `translateX(${(1 - s) * 200 * dir}px) rotate(${(1 - s) * 6 * dir}deg)`,
        boxShadow: good ? `0 30px 120px ${ctx.theme.accent}40` : undefined,
      }}
    >
      <span style={{ fontSize: 110 }}>{good ? '✓' : '✕'}</span>
      <span
        style={{
          fontFamily: ctx.body,
          fontWeight: 800,
          fontSize: ctx.urdu ? 52 : 58,
          lineHeight: ctx.urdu ? 1.8 : 1.12,
          color: good ? ctx.theme.text : ctx.theme.muted,
          textDecoration: good ? undefined : 'line-through',
          textDecorationColor: `${ctx.theme.text}66`,
          direction: ctx.urdu ? 'rtl' : 'ltr',
        }}
      >
        {label}
      </span>
    </div>
  );
  return (
    <div style={{ width: '100%' }}>
      {scene.heading && <Heading text={scene.heading} ctx={ctx} size={92} />}
      <div style={{ position: 'relative', marginTop: 70, display: 'flex', gap: 40, flexDirection: ctx.urdu ? 'row-reverse' : 'row' }}>
        {card(left, false, l, -1)}
        {card(right, true, r, 1)}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: 130,
            height: 130,
            marginLeft: -65,
            marginTop: -65,
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            background: ctx.theme.text,
            color: ctx.theme.bg,
            fontFamily: space.fontFamily,
            fontWeight: 700,
            fontSize: 48,
            transform: `scale(${vs})`,
          }}
        >
          VS
        </div>
      </div>
    </div>
  );
}

function Quote({ scene, ctx, frames }: { scene: MotionScene; ctx: Ctx; frames: number }) {
  const frame = useCurrentFrame();
  const text = plainText(scene.heading || scene.voice);
  const chars = Math.round(interpolate(frame, [6, Math.max(12, frames * 0.6)], [0, text.length], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }));
  const caret = Math.floor(frame / 8) % 2 === 0 && chars < text.length;
  return (
    <div style={{ width: '100%', textAlign: ctx.urdu ? 'right' : 'left', direction: ctx.urdu ? 'rtl' : 'ltr' }}>
      <div style={{ fontFamily: space.fontFamily, fontSize: 300, lineHeight: 0.8, color: ctx.theme.accent, opacity: 0.9 }}>“</div>
      <div style={{ fontFamily: ctx.display, fontWeight: 700, fontSize: ctx.urdu ? 76 : 88, lineHeight: ctx.urdu ? 1.9 : 1.12, color: ctx.theme.text, minHeight: 400 }}>
        {text.slice(0, chars)}
        <span style={{ color: ctx.theme.accent, opacity: caret ? 1 : 0 }}>|</span>
      </div>
      {scene.sub && <Sub text={`— ${scene.sub}`} ctx={ctx} delay={Math.round(frames * 0.6)} />}
    </div>
  );
}

function Statement({ scene, ctx }: { scene: MotionScene; ctx: Ctx }) {
  const frame = useCurrentFrame();
  const w = interpolate(frame, [14, 34], [0, 100], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic) });
  return (
    <>
      <Heading text={scene.heading || plainText(scene.voice)} ctx={ctx} size={100} />
      <div style={{ marginTop: 44, height: 16, width: `${w * 0.7}%`, borderRadius: 999, background: `linear-gradient(90deg, ${ctx.theme.accent}, ${ctx.theme.accent2})` }} />
      {scene.sub && <Sub text={scene.sub} ctx={ctx} delay={26} />}
    </>
  );
}

function Cta({ scene, ctx }: { scene: MotionScene; ctx: Ctx }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - 8, fps, config: { damping: 10, stiffness: 150 } });
  const pulse = 1 + Math.max(0, Math.sin((frame - 20) / 5)) * 0.05;
  const ring = (frame % 30) / 30;
  return (
    <>
      <Heading text={scene.heading || (ctx.urdu ? 'فالو کریں' : 'Follow for more')} ctx={ctx} size={112} />
      <div style={{ position: 'relative', marginTop: 70 }}>
        <div
          style={{
            position: 'absolute',
            inset: -20,
            borderRadius: 999,
            border: `4px solid ${ctx.theme.accent}`,
            opacity: 1 - ring,
            transform: `scale(${1 + ring * 0.25})`,
          }}
        />
        <div
          style={{
            padding: '40px 80px',
            borderRadius: 999,
            background: `linear-gradient(90deg, ${ctx.theme.accent}, ${ctx.theme.accent2})`,
            color: ctx.theme.bg,
            fontFamily: ctx.urdu ? ctx.body : inter.fontFamily,
            fontWeight: 800,
            fontSize: ctx.urdu ? 54 : 60,
            transform: `scale(${s * pulse})`,
            boxShadow: `0 30px 100px ${ctx.theme.accent}66`,
          }}
        >
          {ctx.urdu ? '+ فالو' : '+ FOLLOW'}
        </div>
      </div>
      {scene.sub && <Sub text={scene.sub} ctx={ctx} delay={20} />}
    </>
  );
}

function SceneBody({ scene, ctx, frames }: { scene: MotionScene; ctx: Ctx; frames: number }) {
  switch (scene.kind) {
    case 'hook':
      return <Hook scene={scene} ctx={ctx} />;
    case 'stat':
      return <Stat scene={scene} ctx={ctx} />;
    case 'list':
      return <List scene={scene} ctx={ctx} frames={frames} />;
    case 'compare':
      return <Compare scene={scene} ctx={ctx} />;
    case 'quote':
      return <Quote scene={scene} ctx={ctx} frames={frames} />;
    case 'cta':
      return <Cta scene={scene} ctx={ctx} />;
    default:
      return <Statement scene={scene} ctx={ctx} />;
  }
}

/** Karaoke captions: up to 4 words at a time, the spoken word lit up. */
function Captions({ scene, ctx }: { scene: MotionScene; ctx: Ctx }) {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const words = sceneWords(scene);
  if (!words.length) return null;
  const size = 4;
  let current = words.findIndex((w) => t >= w.start && t < w.end);
  if (current === -1) current = t < words[0].start ? 0 : words.length - 1;
  const start = Math.floor(current / size) * size;
  const group = words.slice(start, start + size);
  const groupStart = group[0].start;
  const s = interpolate(t, [groupStart, groupStart + 0.12], [0.7, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 300 }}>
      <div
        style={{
          maxWidth: 940,
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: '6px 18px',
          padding: '18px 34px',
          borderRadius: 28,
          background: 'rgba(0,0,0,0.42)',
          transform: `scale(${s})`,
          direction: ctx.urdu ? 'rtl' : 'ltr',
        }}
      >
        {group.map((w, i) => {
          const active = start + i === current;
          return (
            <span
              key={start + i}
              style={{
                fontFamily: ctx.urdu ? nastaliq.fontFamily : inter.fontFamily,
                fontWeight: 800,
                fontSize: ctx.urdu ? 52 : 58,
                lineHeight: ctx.urdu ? 1.9 : 1.2,
                color: active ? ctx.theme.accent2 : '#ffffff',
                textTransform: ctx.urdu ? undefined : 'uppercase',
                transform: active ? 'scale(1.08)' : undefined,
                textShadow: '0 4px 18px rgba(0,0,0,0.6)',
              }}
            >
              {w.text}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}

function ProgressBar({ theme, total }: { theme: Theme; total: number }) {
  const frame = useCurrentFrame();
  return (
    <div style={{ position: 'absolute', top: 70, left: 90, right: 90, height: 10, borderRadius: 99, background: `${theme.text}22`, overflow: 'hidden' }}>
      <div style={{ width: `${(frame / total) * 100}%`, height: '100%', background: `linear-gradient(90deg, ${theme.accent}, ${theme.accent2})` }} />
    </div>
  );
}

function audioSrc(spec: MotionSpec, file: string) {
  if (/^(https?:)?\//.test(file)) return file;
  return spec.assetBase ? `${spec.assetBase}/${file}` : staticFile(file);
}

export const MotionShort: React.FC<{ spec: MotionSpec }> = ({ spec }) => {
  const theme = THEMES[spec.theme] || THEMES.ember;
  const urdu = spec.language === 'ur';
  const ctx: Ctx = { theme, urdu, ...fonts(urdu) };
  const total = totalFrames(spec);
  const starts = spec.scenes.reduce<number[]>((acc, s, i) => [...acc, i === 0 ? 0 : acc[i - 1] + sceneFrames(spec.scenes[i - 1])], []);
  return (
    <AbsoluteFill style={{ backgroundColor: theme.bg }}>
      <Background theme={theme} />
      {spec.scenes.map((scene, i) => {
        const frames = sceneFrames(scene);
        return (
          <Sequence key={i} from={starts[i]} durationInFrames={frames} name={`${i + 1}. ${scene.kind}`}>
            <SceneShell frames={frames}>
              <SceneBody scene={scene} ctx={ctx} frames={frames} />
            </SceneShell>
            {spec.captions && <Captions scene={scene} ctx={ctx} />}
            {scene.audio && <Html5Audio src={audioSrc(spec, scene.audio)} />}
          </Sequence>
        );
      })}
      <ProgressBar theme={theme} total={total} />
      <div
        style={{
          position: 'absolute',
          bottom: 110,
          width: '100%',
          textAlign: 'center',
          fontFamily: inter.fontFamily,
          fontWeight: 700,
          fontSize: 28,
          letterSpacing: 8,
          color: `${theme.text}55`,
        }}
      >
        {spec.title.toUpperCase().slice(0, 40)}
      </div>
    </AbsoluteFill>
  );
};
