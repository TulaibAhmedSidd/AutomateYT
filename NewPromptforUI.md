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