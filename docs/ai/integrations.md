# Integrations, accounts and keys

**Key lookup order:** Mongo `Settings.apiKeys.<name>` first (set on `/settings`), then `.env.local`. Never print key values. `.env.example` lists every name.

| Service | Used for | Key names | Cost | Status |
|---|---|---|---|---|
| OpenAI | Scripts (`gpt-4o-mini`, `gpt-4o`), Whisper captions (Image Studio) | `openai` / `OPENAI_API_KEY` | Under 1 cent per script | Working |
| Google Gemini | Scripts (`gemini-2.5-flash`) | `gemini` / `GEMINI_API_KEY` | Free tier, then cheap | Working |
| Microsoft Edge neural voices | All free voiceover, with word timings | none (`msedge-tts`, online) | Free | Working |
| ElevenLabs | Cartoon narrator voices (eleven_v4 speaks Urdu) and Image Studio voice | `ELEVENLABS_API_KEY` | **Free plan today**: ~10,000 credits/month, premade voices only via API, no commercial use | Working (premade voices) |
| Leonardo.ai | Images (Image Studio) | `leonardo` / `LEONARDO_API_KEY` | Credits | Working |
| MongoDB Atlas | Image Studio videos, settings | `MONGODB_URI` | Free M0 | Working (needs your IP in Atlas → Network Access) |
| ComfyUI (home PC) | Cartoon keyframes + clips | `COMFY_URL` (default `http://127.0.0.1:8188`), `CARTOON_ENGINE` (`stills`/`comfy`) | Free (your GPU) | Being built |
| YouTube Data API v3 | Upload | `youtubeClientId`, `youtubeClientSecret`, `youtubeRefreshToken` / `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, `YOUTUBE_REFRESH_TOKEN` | Free | **Broken: the refresh token is expired (`invalid_grant`, checked 2026-11-12)** |
| Instagram (Graph API, Instagram Login) | Reels upload | planned: `INSTAGRAM_USER_ID`, `INSTAGRAM_ACCESS_TOKEN` | Free | Not built |
| Facebook Page | Reels upload | planned: `FACEBOOK_PAGE_ID`, `FACEBOOK_PAGE_TOKEN` | Free | Not built |
| X (Twitter) API | Post video | planned: `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_SECRET` | **Paid per post** (no free tier for new developers since Feb 2026) | Not built |

## YouTube (code: `lib/youtube.ts`, `lib/queue.ts → addUploadJob`)
- OAuth2 client + refresh token. `videos.insert` with `privacyStatus: 'private'`, category 27, and a thumbnail when one exists.
- **Consent screen in "Testing" mode makes refresh tokens die after 7 days.** Publish the OAuth app ("In production") before making a new token.
- Videos uploaded by an **unaudited** API project are locked to private. Make them public by hand in YouTube Studio, or pass Google's API audit.
- Quota is 10 000 units/day, and one upload costs about 1 600. That allows about 6 uploads a day.
- Shorts: vertical, up to 3 minutes.
- Today only Image Studio videos can be uploaded. Motion and cartoon uploads are planned.

## ElevenLabs (cartoon voices) — `scripts/lib/eleven.mjs`
- Models that speak Urdu (checked 2026-11-13): `eleven_v4` (most natural, 1 credit/char), `eleven_v4_turbo` (0.5), `eleven_v3` (expressive, 1). Older models (multilingual_v2, flash/turbo v2.5) do **not** support Urdu.
- `/with-timestamps` returns character timings; the worker turns them into word timings for captions and skips audio tags.
- Audio tags like `[laughs]`, `[sighs]`, `[excited]` in the narration are performed, not spoken; captions strip them (`spokenText()`).
- **The account is on the Free plan:** library voices (Urdu natives like Kamran M, Naqsh, Amjid, Saira, Reva) return HTTP 402 via the API; only premade voices (Liam, George, Laura, Jessica, Sarah, Callum, Charlie, Chris…) work. Free plan output is non-commercial; a monetised channel needs a paid plan (Starter or higher).
- One 45-60 s episode is about 650 characters, so about 650 credits with eleven_v4. Voices are cached per shot, so re-rendering costs nothing.
- `GET /api/cartoon/eleven/voices` lists the account voices for the series editor (free).

## Instagram (planned)
- The account must be **Professional** (Creator or Business).
- Meta developer app with "Instagram API with Instagram Login". Scopes: `instagram_business_basic`, `instagram_business_content_publish`. Use a long-lived token (60 days, refreshable).
- Flow: create a container (`media_type=REELS`, `video_url`) → poll its status → `media_publish`.
- **The video must be at a public HTTPS URL.** Instagram downloads it, so we need file hosting (Cloudflare R2 or Cloudinary free tier).
- There is a daily publish limit. Read it from `GET /<IG_USER_ID>/content_publishing_limit` rather than hard-coding it.

## Facebook (planned)
- Must be a **Page**. The API cannot post to a personal profile.
- Uses the same Meta app. Permissions: `pages_manage_posts`, `pages_read_engagement`, `pages_show_list`. Needs a Page access token.
- Reels upload uses `/{page-id}/video_reels` (start → upload → finish).
- Development mode is enough for your own Page.

## X / Twitter (planned, paid)
- Developer account with pay-per-use billing. App permission "Read and Write". OAuth 1.0a user keys (4 values).
- Chunked media upload, then create the post. Normal accounts can post videos up to 2 min 20 s.

## ComfyUI (home PC)
HTTP API:
- `POST /prompt` `{ prompt: <API-format workflow>, client_id }` returns a `prompt_id`.
- `GET /history/<prompt_id>` reports when the job is done and lists its outputs.
- `GET /view?filename=&subfolder=&type=output` downloads a file.
- `POST /upload/image` (multipart) uploads a reference image.
- `GET /system_stats` reports GPU and VRAM.

Workflows are saved with **Export (API)** into `comfy/workflows/*.api.json`, with `{{TOKENS}}` in place of the prompt, image, seed and size. See the `comfy-workflow` skill.

## YouTube connect and upload (built 2026-11-14)
- **Connections page** (`/connections`):
  - **Connect YouTube** → `/api/youtube/connect` (Google sign-in, scopes youtube.upload + youtube.readonly, `prompt=consent`) → `/api/youtube/callback`.
  - The callback saves the refresh token and channel name in `storage/connections.json` on this PC (gitignored). It is never sent to the browser.
- **Google Cloud setup (owner, once):**
  - the OAuth client must be type **Web application**;
  - it must list the redirect URI `http://localhost:3300/api/youtube/callback`;
  - the consent screen must be **published** (Testing mode tokens die after 7 days).
- **Uploading:** `POST /api/cartoon/episodes/[id]/youtube` uploads `video.mp4` as **private**, with `selfDeclaredMadeForKids` from the series, and saves `youtube.json` (id, url) in the episode folder. The studio shows the "Upload to YouTube" button under a finished video.
- **Instagram:** not built. It needs a Professional account, a public video link (free Cloudinary account) and a Meta app with content publishing. The Connections page lists these steps.
