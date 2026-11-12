// Reels studied with the /reel skill (download -> frames -> Whisper transcript).
// Raw files live in %USERPROFILE%\Reels\<shortcode>.

export type ReelVerdict = 'useful' | 'partly-true' | 'misleading' | 'not-reviewed';

export type ReelInsight = {
  id: string;
  url: string;
  creator: string;
  date: string;
  kind: 'reel' | 'carousel';
  stats: string;
  claim: string;
  whatItReallyIs: string;
  tools: { name: string; url?: string }[];
  commentBait?: string;
  verdict: ReelVerdict;
  takeaway: string;
  formatIds: string[];
};

export const REEL_INSIGHTS: ReelInsight[] = [
  {
    id: 'DeoNBhjE_DA',
    url: 'https://www.instagram.com/p/DeoNBhjE_DA/',
    creator: '@siddhantt.ai',
    date: '2026-10-18',
    kind: 'carousel',
    stats: '15.7K likes · 23.9K comments · 10 slides',
    claim: 'Claude runs a faceless YouTube channel: $28K in 28 days. Second path: a motion-graphics video with 2M views in 2 days.',
    whatItReallyIs:
      'Two real methods. (1) Wan2GP, a free open-source video studio, renders cute 3D cartoon shots (LTX-2.5) from prompts Claude writes, queued in batches overnight. (2) Claude builds motion-graphics videos from code files, no After Effects.',
    tools: [{ name: 'Wan2GP', url: 'https://github.com/deepbeepmeep/Wan2GP' }, { name: 'Claude Code' }, { name: 'LTX-2.5 model' }],
    commentBait: 'EARN',
    verdict: 'partly-true',
    takeaway:
      'The tools are real and free. The income numbers are the creator\'s claim. Wan2GP needs an NVIDIA/AMD GPU with 8 GB+ VRAM, which this office PC does not have.',
    formatIds: ['animated-cartoon', 'motion-graphics'],
  },
  {
    id: 'DeohxYDPsEK',
    url: 'https://www.instagram.com/reel/DeohxYDPsEK/',
    creator: '@shashwat___agarwal',
    date: '2026-10-18',
    kind: 'reel',
    stats: '157.7K likes · 191.2K comments · 43 s',
    claim: '"Claude ka full YouTube skill open source ho gaya": connect Claude to YouTube and manage the whole channel end to end.',
    whatItReallyIs:
      'A demo of youtube-agent-skill: 11 Claude skills (script from 21 hooks, title + thumbnail, edit list, comments, weekly plan, virality agent). It writes and plans; it does not make the video or publish it.',
    tools: [{ name: 'youtube-agent-skill', url: 'https://github.com/jakeschincariol/youtube-agent-skill' }],
    commentBait: 'any comment',
    verdict: 'useful',
    takeaway: 'Installed in Claude (/yt-script, /yt-package, /yt-viral ...). Its hook-first script method should replace our weak script prompt.',
    formatIds: ['motion-graphics', 'image-voiceover', 'animated-cartoon'],
  },
  {
    id: 'DdHrArWITNE',
    url: 'https://www.instagram.com/reel/DdHrArWITNE/',
    creator: '@thetechniko',
    date: '2026-09-10',
    kind: 'reel',
    stats: '10.6K likes · 5.6K comments · 84 s',
    claim: '"Somebody dropped an open-source free Higgsfield": a whole cinema studio, unlimited, for free.',
    whatItReallyIs:
      'Open-Generative-AI by Anil Matcha: a free desktop UI. Every generation runs on MuAPI and needs paid credits. On screen he gets "402 Payment Required" and ends on the $50 / $100 plans page.',
    tools: [{ name: 'Open-Generative-AI', url: 'https://github.com/Anil-matcha/Open-Generative-AI' }, { name: 'MuAPI' }],
    commentBait: 'AI',
    verdict: 'misleading',
    takeaway: 'Not free. Useful only as one way to reach paid video models (Kling, Veo, Wan) through a single API.',
    formatIds: ['ai-cinematic'],
  },
  {
    id: 'DeraTyQyNsc',
    url: 'https://www.instagram.com/reel/DeraTyQyNsc/',
    creator: '@kartikeysinggh',
    date: '2026-10-19',
    kind: 'reel',
    stats: '78.3K likes · 58.5K comments · 53 s',
    claim: '"Poora YouTube automate": a YouTube skill for Claude is going viral.',
    whatItReallyIs: 'Same youtube-agent-skill hype; the guide is only sent by DM to people who comment.',
    tools: [{ name: 'youtube-agent-skill', url: 'https://github.com/jakeschincariol/youtube-agent-skill' }],
    commentBait: 'youtube',
    verdict: 'useful',
    takeaway: 'Nothing new beyond the skill itself.',
    formatIds: [],
  },
  {
    id: 'Dej_WUIO7Zl',
    url: 'https://www.instagram.com/reel/Dej_WUIO7Zl/',
    creator: 'unknown',
    date: '',
    kind: 'reel',
    stats: 'Age-restricted (17+)',
    claim: 'Could not be opened without an Instagram login.',
    whatItReallyIs: 'Not reviewed yet. Save the mp4 and run the /reel skill on it, or open it while logged in.',
    tools: [],
    verdict: 'not-reviewed',
    takeaway: 'Pending.',
    formatIds: [],
  },
];

export const VERDICT_LABEL: Record<ReelVerdict, string> = {
  useful: 'Useful',
  'partly-true': 'Partly true',
  misleading: 'Misleading',
  'not-reviewed': 'Not reviewed',
};
