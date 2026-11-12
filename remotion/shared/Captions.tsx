import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { inter, nastaliq } from './fonts';

/** One spoken word, in seconds from the start of its scene or shot. */
export type CaptionWord = { text: string; start: number; end: number };

/** Karaoke captions: 4 words at a time, the spoken word highlighted. Times are relative to the parent Sequence. */
export function Captions({ words, urdu, accent, bottom = 300 }: { words: CaptionWord[]; urdu: boolean; accent: string; bottom?: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  if (!words.length) return null;
  const size = 4;
  // The word being spoken is the last one that has started. Real voices leave small gaps between words; during a gap
  // the previous word stays lit instead of jumping to the end.
  let current = 0;
  for (let i = 0; i < words.length; i += 1) if (words[i].start <= t) current = i;
  const start = Math.floor(current / size) * size;
  const group = words.slice(start, start + size);
  const groupStart = group[0].start;
  const s = interpolate(t, [groupStart, groupStart + 0.12], [0.7, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: bottom }}>
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
          direction: urdu ? 'rtl' : 'ltr',
        }}
      >
        {group.map((w, i) => {
          const active = start + i === current;
          return (
            <span
              key={start + i}
              style={{
                fontFamily: urdu ? nastaliq.fontFamily : inter.fontFamily,
                fontWeight: 800,
                fontSize: urdu ? 52 : 58,
                lineHeight: urdu ? 1.9 : 1.2,
                color: active ? accent : '#ffffff',
                textTransform: urdu ? undefined : 'uppercase',
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
