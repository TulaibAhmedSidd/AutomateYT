# AutomateYT: Current App Workflow

This document reflects the current UX and generation flow in the app after the latest dashboard and studio updates.

## 1. Entry Flow

### Dashboard home
- The default landing page is `/dashboard`.
- The dashboard now reuses a short session cache for project cards so the home screen does not flash the large loader on every return.
- Background refresh still happens, but existing projects stay visible while data updates.

### Sidebar navigation
- `Dashboard` is active only on `/dashboard`.
- `Create Video` is active only on `/dashboard?create=1`.
- This prevents `Dashboard` and `Create Video` from showing as selected at the same time.

---

## 2. Create Video Flow

The create modal is opened from:
- `Create New Video`
- Sidebar `Create Video`
- `/dashboard?create=1`

### Step 1: Choose workflow mode
- `Generate All Through AI`
- `Hybrid`
- `Fully Manual`

### Step 2: Input strategy

#### Generate All Through AI
- The user provides only the project brief.
- AI is the default source for:
  - script
  - narration
  - scene images
- Manual upload toggles are disabled in this mode at the start, so the initial draft is fully AI-driven.

#### Hybrid
- AI stays available.
- The user can optionally add:
  - script
  - voice files
  - images
- AI is used only where pieces are still missing.

#### Fully Manual
- AI is off by default.
- The user can upload or edit assets first, then decide later in Studio if AI should help.

### Step 3: Create project
- `Fully Manual` creates a draft project.
- `Generate All Through AI` and `Hybrid` create a project and queue generation.

---

## 3. Studio Flow

The Studio is the per-project editor at `/videos/[id]`.

### Project controls
- Edit title, description, tags, prompt memory, and mode.
- If the project is in `Generate All Through AI` mode, the Studio explicitly shows that the stored brief can be used to generate the remaining assets.

### Scene editing
Each scene supports:
- editing scene text
- editing overlay seed / summary text
- editing image prompt
- uploading scene image
- uploading scene voice
- generating script with AI
- generating image with AI
- generating voice with AI
- muting scene audio

### Delete and clear controls
The Studio now supports direct deletion for:
- whole scene
- scene text
- scene summary
- scene image prompt + uploaded image
- scene voice
- overlay layers

This allows users to remove unwanted manual or AI-created content without rebuilding the project from scratch.

---

## 4. Overlay Text Behavior

### Current caption style
- Default overlay text is now presented as an overlaid green caption card instead of the older dark box treatment.
- New overlay layers default closer to the lower portion of the frame for caption-style placement.

### Overlay controls
Each overlay layer supports:
- text editing
- font family
- color
- size
- animation
- X/Y placement
- deletion

---

## 5. Generation Rules

### Save
- Saves project state only.
- Does not trigger AI.

### Render
- Renders using the current saved assets and prompts.
- Requires each scene to be complete enough for render.

### Generate With AI
- Saves the current project.
- Uses the prompt memory and per-scene state to generate the remaining AI content.
- In `Generate All Through AI` mode, this is the primary way to build the full project from the brief.

---

## 6. Source Priority

Current priority remains:
1. User uploaded / user edited assets
2. Existing saved project state
3. AI generation for missing pieces

This keeps manual work safe while still allowing AI to finish incomplete scenes when requested.
