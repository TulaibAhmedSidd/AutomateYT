import { loadFont as loadSpace } from '@remotion/google-fonts/SpaceGrotesk';
import { loadFont as loadInter } from '@remotion/google-fonts/Inter';
import { loadFont as loadNastaliq } from '@remotion/google-fonts/NotoNastaliqUrdu';

// Fonts shared by every composition. Loaded once per bundle; Remotion waits for them before rendering a frame.

/** Headings (Latin). */
export const space = loadSpace('normal', { weights: ['700'], subsets: ['latin'] });
/** Body text and captions (Latin). */
export const inter = loadInter('normal', { weights: ['500', '700', '800'], subsets: ['latin'] });
/** All Urdu text (Nastaliq, right-to-left). */
export const nastaliq = loadNastaliq('normal', { weights: ['400', '700'], subsets: ['arabic'] });
