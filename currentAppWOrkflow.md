# AutomateYT: Application Workflow & Model Stack

This document outlines the current technical architecture and AI model stack used by the AutomateYT video generation engine.

## 1. Application Architecture

AutomateYT is a Next.js-based automation platform designed to generate short-form videos (YouTube Shorts/TikToks) using a multi-step AI pipeline.

### Core Components
- **Dashboard (`app/dashboard`)**: The primary interface for controlling the production pipeline.
- **Workflow Engine (`lib/generator.ts`)**: The orchestrator that manages sequential/parallel execution of AI tasks.
- **Database (MongoDB)**: Stores video metadata, job statuses, and user settings.
- **Storage**: Dual-mode storage (Local for rapid development; GridFS for persistent Vercel/Cloud deployments).

---

## 2. The Production Pipeline (Step-by-Step)

### Step 1: Script & Storyboard Generation
- **Trigger**: Dashboard (Idea-to-Script or Manual Script input).
- **API**: `/api/generate-script` -> `lib/ai.ts` (`generateTopicAndScript`).
- **Logic**: Converts a simple idea into a structured JSON object containing:
  - Video Title, Description, and Tags.
  - A sequence of Scenes (Text + Descriptive Image Prompt).
- **Models Available**:
  - `gpt-4o-mini` (OpenAI Flash) - *Default*
  - `gpt-4o` (OpenAI Pro)
  - `gemini-1.5-flash` (Google Gemini)
  - `gemini-1.5-pro` (Google Gemini)

### Step 2: Voiceover Generation
- **Trigger**: Script approval in Dashboard.
- **API**: `/api/generate-video` -> `lib/ai.ts` (`generateVoiceover`).
- **Logic**: Aggregates all scene text and converts it into a high-quality MP3 audio file.
- **Models Available**:
  - `eleven_multilingual_v2` (ElevenLabs) - *Default*
  - `eleven_turbo_v2_5` (ElevenLabs Turbo)
- **Voice ID**: Uses a fixed premium voice ID curated for narration.

### Step 3: AI Image Generation
- **Trigger**: Automatic after script approval.
- **API**: `lib/ai.ts` (`generateImage`).
- **Logic**: Each scene's `imagePrompt` is sent to the image engine to create high-resolution vertical assets.
- **Models Available (Leonardo.ai API)**:
  - `leonardo-sdxl-basic` - *Default* (SDXL 1.0)
  - `leonardo-kino-xl` (Cinematic XL)
  - `leonardo-vision-xl` (Photorealistic XL)

### Step 4: Video Synthesis & Rendering
- **Trigger**: Manual trigger via "Generate Final Video" button in Dashboard once images are ready.
- **Library**: `lib/ffmpeg.ts` (`renderVideo`).
- **Logic**: Uses **FFmpeg** to:
  1. Process images with dynamic "Ken Burns" zoom/pan effects.
  2. Map images precisely to the timeline.
  3. Merge synthesized video with the ElevenLabs audio track (`-shortest` flag).
  4. Perform a 9:16 vertical crop/scale for mobile-first playback.
- **Models**: Local `ffmpeg` binary (via `ffmpeg-static`).

### Step 5: Metadata & Thumbnailing
- **Logic**: Automatically extracts a frame from the rendered MP4 to create a high-quality PNG thumbnail.
- **Fixed Model**: FFmpeg screenshot command (`timestamps: [1]`).

### Step 6: YouTube Upload
- **Trigger**: Manual button "Upload to YouTube" in Dashboard.
- **API**: `/api/upload-youtube` -> `lib/youtube.ts`.
- **Logic**: Authenticates via Google OAuth 2.0 and uploads the binary file with AI-generated title, description, and tags.

---

## 3. Storage & Deployment Strategy

### Vercel Compatibility
The app detects the `VERCEL` environment and automatically switches behavior to handle the Read-Only file system:
- **Workspace**: Redirects all writes (audio/images/videos) to the `/tmp` directory.
- **Storage Mode**: Defaults to `cloud` mode.
- **Persistence**: Final assets are moved from `/tmp` to **MongoDB GridFS** so they can be served via the `/api/media/[id]` endpoint.

### Model Settings Manager
Users can control their default AI stack via the **Settings Page**:
- **API Keys**: All keys (OpenAI, Gemini, ElevenLabs, Leonardo) are stored in MongoDB.
- **Default Models**: Change which LLM, Voice, or Image model is used for every job.
