You are a senior full-stack engineer and AI automation architect. Build a production-ready automated AI video generation system for a faceless YouTube micro-history channel.

Tech Stack:

* Next.js 14+ (App Router)
* Node.js API routes
* MongoDB (Mongoose ODM)
* TypeScript
* TailwindCSS
* FFmpeg for video rendering
* BullMQ queue
* Redis (queue backend)
* node-cron scheduler

Core System Requirements:
The system must automatically:

1. Generate video topic
2. Generate script
3. Split script into scenes
4. Generate voiceover
5. Generate AI images per scene
6. Generate subtitles
7. Render video using FFmpeg
8. Generate thumbnail
9. Generate title + description + tags
10. Upload video to YouTube
11. Schedule uploads
12. Store metadata in MongoDB
13. Provide UI dashboard

Environment Keys Required:
OPENAI_API_KEY=
ELEVENLABS_API_KEY=
LEONARDO_API_KEY=
YOUTUBE_CLIENT_ID=
YOUTUBE_CLIENT_SECRET=
YOUTUBE_REFRESH_TOKEN=
MONGODB_URI=
REDIS_URL=
GOOGLE_EMAIL=

Project Structure:

/app
/dashboard
/settings
/scheduler
/queue
/api
generate-topic
generate-script
generate-voice
generate-images
render-video
generate-thumbnail
upload-youtube
schedule
/lib
ai.ts
youtube.ts
ffmpeg.ts
queue.ts
scheduler.ts
/models
Video.ts
Job.ts
Settings.ts
/public
/videos
/images
/audio

MongoDB Models:

Video Model:

* title
* description
* tags
* script
* thumbnail
* videoPath
* status (generated/uploaded/scheduled)
* youtubeId
* createdAt

Job Model:

* type
* status
* progress
* logs
* createdAt

Settings Model:

* apiKeys
* scheduleTimes
* uploadEnabled

UI Dashboard Requirements:

Dashboard must include:

* Generate Video button
* Bulk Generate input
* Queue status list
* Video preview player
* Upload status indicator
* Scheduler calendar
* API keys settings page
* Logs panel
* Download video button

Workflow:

User clicks Generate Video:

1. System generates topic
2. Generates script
3. Splits into scenes
4. Generates image per scene
5. Generates voiceover
6. Calculates duration
7. Uses FFmpeg to render video
8. Generates thumbnail
9. Saves to MongoDB
10. Adds to upload queue

FFmpeg Requirements:

* image slideshow
* zoom pan effect
* subtitle overlay
* background music optional
* export 1080x1920 and 1280x720
* H264 encoding

YouTube Upload Requirements:

* OAuth2 authentication
* Upload video
* Set title
* Set description
* Set tags
* Category: Education
* Visibility: scheduled/public
* Thumbnail upload
* Save YouTube video ID

Scheduler Requirements:

* node-cron
* configurable upload time
* daily upload automation
* retry failed uploads
* queue-based execution

Queue Requirements:

* BullMQ
* Redis backend
* job progress
* retries
* failure logging

Thumbnail Generator:

* bold large text
* minimal icons
* high contrast
* auto export PNG

NPM Packages Required:

* mongoose
* openai
* axios
* fluent-ffmpeg
* ffmpeg-static
* bullmq
* ioredis
* node-cron
* googleapis
* sharp
* uuid
* fs-extra
* tailwindcss
* clsx
* zustand

API Endpoints:

POST /api/generate-video
POST /api/bulk-generate
POST /api/upload-youtube
POST /api/schedule
GET /api/videos
GET /api/jobs
POST /api/settings

Automation Flow:

Generate Topic → Script → Scenes → Images → Voice → Render → Thumbnail → Save → Queue → Upload

Scheduler:

* runs every minute
* checks scheduled videos
* uploads when time matches

Add .env.local template:

OPENAI_API_KEY=
ELEVENLABS_API_KEY=
LEONARDO_API_KEY=
YOUTUBE_CLIENT_ID=
YOUTUBE_CLIENT_SECRET=
YOUTUBE_REFRESH_TOKEN=
MONGODB_URI=
REDIS_URL=
GOOGLE_EMAIL=

Commands:

npm install
npm run dev
npm run worker
npm run scheduler

Worker:

* process video generation queue
* process upload queue

Features:

* bulk video generation
* auto upload
* auto scheduling
* thumbnail generator
* logging system
* retry logic
* scalable architecture

Output:
Full working project with:

* Next.js UI
* MongoDB integration
* Queue worker
* Scheduler
* YouTube uploader
* FFmpeg video renderer
* AI integration
* README setup instructions
