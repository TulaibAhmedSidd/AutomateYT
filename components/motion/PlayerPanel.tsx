'use client';

import { Player } from '@remotion/player';
import { MotionShort } from '@/remotion/MotionShort';
import { FPS, HEIGHT, WIDTH, totalFrames, type MotionSpec } from '@/lib/motion/spec';

// Loaded with ssr:false: Remotion fonts and the player need the browser.
export default function PlayerPanel({ spec }: { spec: MotionSpec }) {
  return (
    <Player
      component={MotionShort}
      inputProps={{ spec }}
      durationInFrames={totalFrames(spec)}
      compositionWidth={WIDTH}
      compositionHeight={HEIGHT}
      fps={FPS}
      controls
      loop
      clickToPlay
      initialFrame={24}
      style={{ width: '100%', aspectRatio: `${WIDTH} / ${HEIGHT}`, borderRadius: 28, overflow: 'hidden' }}
    />
  );
}
