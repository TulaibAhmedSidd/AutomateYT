Prompt: Architecting the "Post-Generation" Video Editor & Logic
Role: Senior Full-Stack Architect & Media UI Specialist.

Objective: Implement a "Video Configuration Tab" that allows users to manually override, edit, and fine-tune every layer of a generated video project before the final render.

1. Data Structure & State Management
Project Schema: Create a centralized VideoProject state (using Zustand or Redux) that stores the raw project manifest. It must include:

scriptSegments: An array of objects containing text, startTime, endTime, and voiceID.

assetMap: A mapping of each script segment to a specific imageUrl or videoClipUrl.

audioConfig: Volume levels for background music vs. voiceover, and a toggle for "Mute Scene."

metadata: Tags, YouTube Description, and AI-generated Title.

2. UI/UX: The "Edit Studio" Tab
The Scene Manager: Build a vertical or horizontal "Timeline" where each scene is a card.

Features: Users can click an image to trigger a "Regenerate Image" (via DALL-E/Leonardo) or "Upload Local File."

Text Overrides: Every script block must be an editable text area. Changing the text should trigger a background BullMQ job to re-generate only that specific audio segment.

The "Live Preview" Canvas: Use a lightweight <canvas> or <video> player that syncs with the current scroll position of the Scene Manager.

The "Tag & SEO" Panel: A sidebar to edit the video tags, categories, and direct-to-YouTube upload settings.

3. Functional Logic (The "Smart Render" Engine)
Atomic Updates: The system must not re-render the entire video for small changes. If a user only edits the "Tag" or "Caption Text," only the FFmpeg overlay filter should be re-applied.

Asset Swapping: Implement a "Drag & Drop" interface for images. Use Sharp on the backend to pre-process user-uploaded images to the correct 9:16 aspect ratio before adding them to the production queue.

Voice Control: Add a "Regenerate Voice" button per scene. If the user dislikes the tone of a specific sentence, they can swap the voice model (e.g., ElevenLabs "Expressive" vs. "Narrative") for that segment only.

4. Workflow Execution
Initial AI Generation: The tool creates the "Draft" and populates the Editor Tab.

User Refinement: User tweaks the script, swaps a "bad" AI image for a relevant one, and adjusts tags.

Commit & Render: Once the user hits "Finalize," the updated JSON manifest is sent to the fluent-ffmpeg worker to stitch the final high-quality .mp4.

5. Technical Implementation Details
Frontend: Next.js (React 19), Tailwind CSS, Framer Motion for smooth drag-and-drop.

Backend: Node.js worker processing the updated JSON manifest via BullMQ.

Asset Storage: Temporary S3 or MongoDB GridFS for user-uploaded overrides.

oldlavenderd32@clissecol.com



new prompt 2



Role: Senior Full-Stack Architect, UX Designer, and Cost-Optimization Engineer

Objective:
Refactor the existing AI video generation platform into a hybrid system where users can manually provide assets (script, voice, images) to reduce AI costs, while still allowing optional AI generation per component.

---

1. CORE PRODUCT SHIFT (IMPORTANT)

System must follow:
"User-first input → AI fallback only when needed"

At video creation:
Ask user:

* Do you want to:
  [ ] Generate with AI
  [ ] Upload your own Script
  [ ] Upload your own Voice
  [ ] Upload your own Images

System must adapt dynamically based on selection.

---

2. UPDATED DASHBOARD FLOW

Dashboard must include:

* Create New Video
* Video List (Main Home)
* Studio (Editor)
* Settings

REMOVE:

* "Video Library" (not functional)

Each video card must include:

* Thumbnail preview
* Title
* Status (Draft / Editing / Rendered)
* Buttons:
  [Edit in Studio]
  [Render]
  [Delete]

---

3. MOBILE RESPONSIVENESS (CRITICAL)

Entire app must be fully responsive:

* Use Tailwind responsive classes
* Stack layout on mobile
* Sidebar becomes bottom nav on mobile
* Studio becomes vertical scroll editor
* Timeline becomes swipeable carousel

---

4. STUDIO (EDITOR) IMPROVEMENTS

A. Scene Awareness System

Each scene must show:

* Script status:
  ✓ Generated
  ⚠ Missing
  ✎ User Edited

* Image status:
  ✓ Uploaded
  ⚠ Missing
  🎨 AI Generated

* Voice status:
  ✓ Uploaded
  ⚠ Missing
  🔊 AI Generated

If missing → show button:
[Generate via AI]
[Upload manually]

---

B. Hybrid Input System

For EACH scene:

SCRIPT:

* Editable textarea
* If empty → show:
  [Generate Script AI]

VOICE:

* Upload audio
* OR generate AI voice
* OR regenerate only this segment

IMAGE:

* Upload image
* OR generate AI image
* OR replace existing

---

C. Scene Overlay Text System (NEW)

Each scene must include:

* Black RGBA overlay box (semi-transparent)
* Bold large font
* Auto-insert scene summary text

User can:

* Edit text
* Add multiple text layers
* Drag position
* Change:

  * font
  * size
  * color
  * animation

---

D. Animation System

Allow:

* fade-in
* slide-up
* zoom-in
* typewriter

Use:

* Framer Motion or similar animation library

---

5. SMART COST CONTROL LOGIC

System must:

* NEVER call AI if user already provided asset
* Only call AI for missing parts
* Allow per-scene AI generation (not full video)

---

6. INITIAL VIDEO CREATION FLOW

When user clicks "Create Video":

Show modal:

Step 1:
Select creation mode:

* Full AI
* Hybrid
* Fully Manual

Step 2:
Ask:

* Upload script? (optional)
* Upload voice? (optional)
* Upload images? (optional)

Step 3:
Generate ONLY missing components

---

7. RENDER LOGIC (IMPORTANT)

* If all assets exist → skip AI completely
* If partial → render only available scenes
* If scene incomplete → block render OR warn user

---

8. VIDEO STRUCTURE UI

Each scene card must show:

* Preview image
* Scene text
* Duration
* Status icons
* Buttons:
  [Edit]
  [Upload Image]
  [Generate Image]
  [Upload Voice]
  [Generate Voice]

---

9. NAVIGATION SYSTEM

Left sidebar (desktop):

* Dashboard
* Create Video
* Studio
* Settings

Mobile:

* Bottom navigation bar

---

10. PERFORMANCE OPTIMIZATION

* Lazy load images
* Cache generated assets
* Avoid duplicate AI calls
* Save user-uploaded assets permanently

---

11. DATABASE UPDATE (MongoDB)

Each scene must include:

{
text,
imageUrl,
voiceUrl,
source: {
script: "ai" | "user",
image: "ai" | "user",
voice: "ai" | "user"
},
status: "complete" | "missing"
}

---

12. FINAL GOAL

System should:

* reduce AI usage by 60–80%
* allow full manual override
* give users full control
* maintain fast generation
* be mobile-friendly
* be scalable

---

OUTPUT:

* Updated Next.js UI
* Updated API routes
* Updated MongoDB schema
* Updated Studio Editor
* Mobile responsive layouts
* Hybrid AI/manual system
* Cost-efficient logic
