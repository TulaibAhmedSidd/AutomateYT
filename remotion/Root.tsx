import React from 'react';
import { Composition } from 'remotion';
import { MotionShort } from './MotionShort';
import { FPS, HEIGHT, PRESETS, WIDTH, totalFrames, type MotionSpec } from '../lib/motion/spec';

export const RemotionRoot: React.FC = () => (
  <Composition
    id="MotionShort"
    component={MotionShort as React.FC<Record<string, unknown>>}
    width={WIDTH}
    height={HEIGHT}
    fps={FPS}
    durationInFrames={totalFrames(PRESETS[0].spec)}
    defaultProps={{ spec: PRESETS[0].spec }}
    calculateMetadata={({ props }) => ({ durationInFrames: totalFrames((props as { spec: MotionSpec }).spec) })}
  />
);
