'use client';

import { Player } from '@remotion/player';
import { CartoonEpisode } from '@/remotion/CartoonEpisode';
import { FPS, HEIGHT, WIDTH, episodeFrames, type EpisodeRenderProps } from '@/lib/cartoon/spec';

// Live preview of an episode. Loaded with ssr:false: Remotion fonts and the player need the browser.
export default function EpisodePlayer(props: EpisodeRenderProps) {
  return (
    <Player
      component={CartoonEpisode}
      inputProps={props}
      durationInFrames={episodeFrames(props.episode)}
      compositionWidth={WIDTH}
      compositionHeight={HEIGHT}
      fps={FPS}
      controls
      clickToPlay
      style={{ width: '100%', aspectRatio: `${WIDTH} / ${HEIGHT}`, borderRadius: 28, overflow: 'hidden' }}
    />
  );
}
