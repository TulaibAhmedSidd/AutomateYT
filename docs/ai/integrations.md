# Integrations, accounts and keys

**Key lookup order:** Mongo `Settings.apiKeys.<name>` first (set on `/settings`), then `.env.local`. Never print key values. `.env.example` lists every name.

| Service | Used for | Key names | Cost | Status |
|---|---|---|---|---|
| OpenAI | Scripts (`gpt-4o-mini`, `gpt-4o`), Whisper captions (Image Studio) | `openai` / `OPENAI_API_KEY` | Under 1 cent per script | Working |
| Google Gemini | Scripts (`gemini-2.5-flash`) | `gemini` / `GEMINI_API_KEY` | Free tier, then cheap | Working |
| Microsoft Edge neural voices | All free voiceover, with word timings | none (`msedge-tts`, online) | Free | Working |
| ElevenLabs | Premium voice (Image Studio) | `elevenlabs` / `ELEVENLABS_API_KEY` | Paid plan | Working |
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
