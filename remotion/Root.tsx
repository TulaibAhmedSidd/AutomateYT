import React from 'react';
import { Composition } from 'remotion';
import { MotionShort } from './MotionShort';
import { CartoonEpisode } from './CartoonEpisode';
import { FPS, HEIGHT, PRESETS, WIDTH, totalFrames, type MotionSpec } from '../lib/motion/spec';
import { SERIES_PRESETS, episodeFrames, type EpisodeRenderProps } from '../lib/cartoon/spec';

const sampleSeries = SERIES_PRESETS[0];
const sampleEpisode: EpisodeRenderProps = {
  series: { name: sampleSeries.name, language: sampleSeries.language, palette: sampleSeries.palette },
  episode: {
    id: 'sample',
    seriesId: sampleSeries.id,
    title: 'Sample episode',
    endHook: 'See you next time!',
    createdAt: '',
    shots: [
      { id: 'aaaaaa', narration: 'Mimi found a tiny turtle by the pond', characters: ['mimi', 'tiko'], scene: 'A park pond', action: 'Mimi kneels to greet Tiko', camera: 'push-in' },
      { id: 'bbbbbb', narration: 'He looked lost and a little sad', characters: ['tiko'], scene: 'Pond edge', action: 'Tiko looks around', camera: 'pan-left' },
    ],
  },
};

// Registers every video the app can render. Ids must match the workers (scripts/render-*.mjs).
export const RemotionRoot: React.FC = () => (
  <>
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
    <Composition
      id="CartoonEpisode"
      component={CartoonEpisode as unknown as React.FC<Record<string, unknown>>}
      width={WIDTH}
      height={HEIGHT}
      fps={FPS}
      durationInFrames={episodeFrames(sampleEpisode.episode)}
      defaultProps={sampleEpisode as unknown as Record<string, unknown>}
      calculateMetadata={({ props }) => ({ durationInFrames: episodeFrames((props as unknown as EpisodeRenderProps).episode) })}
    />
  </>
);
