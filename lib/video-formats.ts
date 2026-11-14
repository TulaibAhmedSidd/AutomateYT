// Strategy cards: one per video format the channel can produce.
// Plain data so the dashboard, the format pages and (later) the generator share one source of truth.

export type FormatStatus = 'live' | 'next' | 'needs-gpu' | 'paid-api';

export type FormatTool = {
  name: string;
  role: string;
  cost: string;
  link?: string;
};

export type FormatEngineOption = {
  name: string;
  verdict: string;
  cost: string;
  fitsThisPc: boolean;
};

export type VideoFormat = {
  id: string;
  name: string;
  shortName: string;
  tagline: string;
  status: FormatStatus;
  accent: 'amber' | 'violet' | 'sky' | 'rose';
  bestFor: string[];
  whyItWorks: string;
  evidence: string;
  pipeline: { step: string; detail: string }[];
  tools: FormatTool[];
  engines?: FormatEngineOption[];
  costPerVideo: string;
  timePerVideo: string;
  retention: 1 | 2 | 3 | 4 | 5;
  automation: 1 | 2 | 3 | 4 | 5;
  risks: string[];
  setup: { item: string; done: boolean }[];
  studioHref?: string;
};

export const STATUS_LABEL: Record<FormatStatus, string> = {
  live: 'Live',
  next: 'Next to build',
  'needs-gpu': 'Needs a GPU',
  'paid-api': 'Paid API',
};

export const VIDEO_FORMATS: VideoFormat[] = [
  {
    id: 'animated-cartoon',
    name: 'Animated 3D Cartoon Episodes',
    shortName: 'Animation',
    tagline: 'Pixar-style characters in short story episodes, narrated in your own voice. AI writes, a video model animates.',
    studioHref: '/cartoon',
    status: 'needs-gpu',
    accent: 'amber',
    bestFor: ['Kids & family stories', 'Moral stories / Islamic stories', 'Animal & nature series', 'Recurring character channels'],
    whyItWorks:
      'Moving characters and a story arc hold attention far longer than still pictures. A recurring character turns one-off viewers into subscribers who come back for the next episode.',
    evidence:
      'Reel by @siddhantt.ai: faceless cartoon channel built with Wan2GP + Claude, claimed 6.0M views and $28K in 28 days (creator claim, not verified).',
    pipeline: [
      { step: 'Series bible', detail: 'Main character, look, world, tone and episode rules written once. Keeps every episode on-model.' },
      { step: 'Episode script', detail: 'Claude writes the story beat by beat, plus one 5-8 second shot prompt per beat (6-8 shots per Short).' },
      { step: 'Character reference', detail: 'One reference image of the character is generated once and fed to every shot for consistency.' },
      { step: 'Shot rendering', detail: 'Image-to-video model (LTX-2.5 / Wan 2.2) animates each shot, optionally with sound.' },
      { step: 'Voice & music', detail: 'Narrator or character voices (ElevenLabs), light background music, ducking.' },
      { step: 'Assembly', detail: 'FFmpeg joins the shots, adds word-timed captions and an end hook into the next episode.' },
      { step: 'Package & upload', detail: 'Title + thumbnail pairing, description, playlist per series, then upload.' },
    ],
    tools: [
      { name: 'Wan2GP', role: 'Local video studio (Wan 2.x, LTX-2.5, Hunyuan)', cost: 'Free, MIT, runs on your GPU', link: 'https://github.com/deepbeepmeep/Wan2GP' },
      { name: 'Claude / GPT', role: 'Series bible, episode scripts, shot prompts', cost: 'LLM tokens' },
      { name: 'ElevenLabs', role: 'Narration and character voices', cost: 'Existing plan' },
      { name: 'FFmpeg', role: 'Stitch shots, captions, music', cost: 'Free' },
    ],
    engines: [
      { name: 'Wan2GP on a local NVIDIA/AMD GPU', verdict: 'Best cost: zero per video. Needs 8 GB+ VRAM; this office PC only has Intel graphics.', cost: 'Free after hardware', fitsThisPc: false },
      { name: 'Wan2GP on a rented cloud GPU', verdict: 'Same free software, rent a GPU by the hour only while a batch renders overnight.', cost: 'Pay per GPU hour', fitsThisPc: true },
      { name: 'Hosted video API (LTX / Wan / Kling)', verdict: 'No setup, fastest to wire in, but you pay for every clip. A 60s Short needs ~8-12 clips.', cost: 'Pay per clip', fitsThisPc: true },
    ],
    costPerVideo: '$0 local GPU · cents-to-dollars on cloud',
    timePerVideo: '20-60 min render per Short (GPU)',
    retention: 5,
    automation: 4,
    risks: [
      'Made-for-Kids content: comments are off and ad rates are lower. Decide the audience on purpose.',
      'YouTube demonetizes mass-produced, repetitive content. Every episode needs a real story, not a template swap.',
      'Character drift between shots. Always reuse the same reference image.',
    ],
    setup: [
      { item: '4 starter series (kids, Urdu kids, comedy, Islamic) + series editor', done: true },
      { item: 'AI episode writer + shot editor + record lines in your own voice', done: true },
      { item: 'Episode assembly with pictures, camera moves and captions (Phase 1)', done: true },
      { item: 'Install ComfyUI + Wan 2.2 5B on the home GPU PC', done: false },
      { item: 'Animated clips from ComfyUI in the render (Phase 2)', done: false },
    ],
  },
  {
    id: 'motion-graphics',
    name: 'Motion Graphics Explainers',
    shortName: 'Motion graphics',
    tagline: 'Kinetic text, icons, charts and maps that move with every word. Built as code, rendered to MP4.',
    status: 'live',
    accent: 'violet',
    studioHref: '/motion',
    bestFor: ['Facts & micro-history', 'Tech / AI news', 'Finance & stats', 'Top-5 lists and comparisons'],
    whyItWorks:
      'Something new appears on screen every 1-2 seconds and every key word is animated, so the eye never rests. It looks premium, needs no faces and no stock footage, and the same engine can sell to clients.',
    evidence:
      'Same @siddhantt.ai reel: a motion-graphics video Claude built from 2 files reportedly crossed 2M views in 2 days. Code-driven video (Remotion) is a proven, open approach.',
    pipeline: [
      { step: 'Hook-first script', detail: 'GPT / Gemini writes 5-8 scenes (hook, big number, list, this-vs-that, quote, then-to-now timeline, CTA), or you open a ready-written series episode.' },
      { step: 'Voice', detail: 'Free Microsoft Edge neural voices (English or Urdu), or a natural ElevenLabs voice (credits; each line is cached so re-renders are free).' },
      { step: 'Word timings', detail: 'The voice service returns the time of every word, so captions and scene lengths are exact.' },
      { step: 'Live preview', detail: 'The Remotion Player plays the video in the browser while you edit.' },
      { step: 'Render', detail: 'Remotion renders 1080x1920 MP4 on this PC with an installed headless Chrome.' },
      { step: 'Package & upload', detail: 'Title, description and tags come with the script. YouTube upload is the next step to wire.' },
    ],
    tools: [
      { name: 'Remotion', role: 'Videos as React code, renders MP4', cost: 'Free for individuals / teams of 3 or fewer', link: 'https://www.remotion.dev' },
      { name: 'GPT-4o-mini / Gemini', role: 'Script as scene JSON', cost: 'Under 1 cent per script' },
      { name: 'Edge neural voices', role: 'Voiceover + word timings', cost: 'Free (online)' },
      { name: 'ElevenLabs', role: 'Natural voice (optional)', cost: 'Free plan: about 10,000 credits a month, about 400 per Short' },
    ],
    costPerVideo: 'Free (script under 1 cent; no image or video credits)',
    timePerVideo: '1-3 min render on this PC',
    retention: 4,
    automation: 5,
    risks: [
      'Templates that all look the same get ignored. Keep a library of scene types and vary them.',
      'Needs a good voice: the voice carries the video.',
    ],
    setup: [
      { item: 'Add Remotion to the project', done: true },
      { item: 'First 7 scene templates (hook, big number, list, this-vs-that, quote, statement, CTA)', done: true },
      { item: 'AI scene writer + free voice with word-timed captions', done: true },
      { item: 'Motion Studio: edit, live preview, render, download', done: true },
      { item: 'Pick the channel voice', done: false },
      { item: 'More templates: map, timeline, chart, icon grid', done: false },
      { item: 'Upload rendered videos to YouTube from the Studio', done: false },
    ],
  },
  {
    id: 'image-voiceover',
    name: 'Image + Voiceover Stories',
    shortName: 'Image slideshow',
    tagline: 'AI images with camera motion, voiceover and word captions. The pipeline you have today.',
    status: 'live',
    accent: 'sky',
    bestFor: ['Dark history & mysteries', 'Story narration', 'Quick tests of a new niche'],
    whyItWorks:
      'Cheapest and fastest to produce, and it works when the narration is gripping. It fails when there are only a few slow-zoom pictures: viewers swipe in 1-2 seconds.',
    evidence: 'Current AutomateYT output: 3 still images, ~15-20 s each, slow zoom. Your own verdict: nobody watches these.',
    pipeline: [
      { step: 'Script', detail: 'GPT-4o-mini / Gemini writes title, description, tags and scenes.' },
      { step: 'Voiceover', detail: 'ElevenLabs reads the full script.' },
      { step: 'Images', detail: 'Leonardo creates one image per scene (first 3 by AI, rest uploaded).' },
      { step: 'Render', detail: 'FFmpeg Ken Burns zoom, fades, Whisper word captions, optional music.' },
      { step: 'Upload', detail: 'Manual YouTube upload button.' },
    ],
    tools: [
      { name: 'OpenAI / Gemini', role: 'Script', cost: 'LLM tokens' },
      { name: 'ElevenLabs', role: 'Voice', cost: 'Existing plan' },
      { name: 'Leonardo.ai', role: 'Images', cost: 'Image credits' },
      { name: 'FFmpeg', role: 'Render', cost: 'Free' },
    ],
    costPerVideo: 'Voice + 3 image credits',
    timePerVideo: '1-3 min',
    retention: 2,
    automation: 4,
    risks: [
      'Only 3 images for 60 s: change the picture every 2-3 s (15-25 images), not every 20 s.',
      'No hook in the first 2 seconds: use the yt-script hook method.',
    ],
    setup: [
      { item: 'Script, voice, images, render, upload', done: true },
      { item: 'More scenes per video + faster cuts', done: false },
      { item: 'Hook-first script prompt', done: false },
    ],
    studioHref: '/studio',
  },
  {
    id: 'ai-cinematic',
    name: 'AI Cinematic Clips',
    shortName: 'AI cinematic',
    tagline: 'Realistic, film-like shots from Kling / Veo / Higgsfield-style models, cut into a story.',
    status: 'paid-api',
    accent: 'rose',
    bestFor: ['Cinematic history re-creations', 'Product & brand ads', 'B-roll inside motion-graphics videos'],
    whyItWorks: 'Looks like real film. Great for the first 2 seconds as a hook, or mixed into motion-graphics videos.',
    evidence:
      'Reel by @thetechniko: "free Higgsfield" (Open-Generative-AI). The app is free but every generation needs paid MuAPI credits: he gets a 402 Payment Required error on screen.',
    pipeline: [
      { step: 'Shot list', detail: 'Claude writes 5-8 cinematic shot prompts from the script.' },
      { step: 'Generate clips', detail: 'Text/image-to-video API renders 5-10 s clips.' },
      { step: 'Voice & assembly', detail: 'Voiceover, captions and music added with FFmpeg.' },
    ],
    tools: [
      { name: 'Higgsfield / Kling / Veo / Seedance', role: 'Video models', cost: 'Paid per clip or subscription' },
      { name: 'MuAPI / fal.ai', role: 'One API for many models', cost: 'Pay as you go' },
      { name: 'Open-Generative-AI', role: 'Free desktop UI on top of MuAPI', cost: 'App free, generations paid', link: 'https://github.com/Anil-matcha/Open-Generative-AI' },
    ],
    costPerVideo: 'Highest: every clip is paid',
    timePerVideo: '5-15 min (API queue)',
    retention: 5,
    automation: 3,
    risks: ['Cost grows with every clip. Use for hooks and hero shots, not whole videos.', '"Free Higgsfield" claims are misleading.'],
    setup: [
      { item: 'Decide a monthly budget', done: false },
      { item: 'Pick one API provider and add the key', done: false },
    ],
  },
];

export function getFormat(id: string) {
  return VIDEO_FORMATS.find((format) => format.id === id);
}

export const RECOMMENDED_ORDER = ['motion-graphics', 'animated-cartoon', 'image-voiceover', 'ai-cinematic'];
