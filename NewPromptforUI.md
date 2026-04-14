To upgrade your AutoVid AI platform to a professional-grade SaaS, you need a prompt that covers the State Machine logic (Backend) and the Information Density (Frontend).

Copy and paste this into your development tool:

System Architecture & UI Refactor Instruction
Objective: Upgrade the current video generation flow from a "Single-Task" UI to a "Professional Management Dashboard" using Next.js, Tailwind CSS, and BullMQ.

1. Backend & Logic: Atomic State Machine
Granular Job Tracking: Refactor the BullMQ worker to track the state of each sub-step: SCRIPT_GEN, VOICE_GEN, IMAGE_GEN, VIDEO_RENDER, THUMBNAIL, and UPLOAD.

Atomic Retries: Implement "Resume from Failure" logic. If a job fails at VIDEO_RENDER, the Retry action must skip the already completed (and paid for) Script, Voice, and Image steps.

Websocket Integration: Ensure the UI listens for real-time status updates via WebSockets/Socket.io so the "Pending" states update without page refreshes.

2. UI Refactor: Information Density & Hierarchy
Compact List View: Replace the large "Production Cards" with a Condensed List or Table View.

Columns: ID/Thumbnail, Title, Status (with mini-stepper icons), Creation Date, and Actions (Edit, Retry, Download, Delete).

Visual Stepper: On each production row, show a 5-dot progress indicator.

Gray: Waiting | Spinning Blue: Processing | Green: Success | Red: Failed.

Human-in-the-Loop (HITL) Mode: Add a "Pause for Review" toggle in settings. When enabled, the pipeline should stop after IMAGE_GEN, allowing the user to preview assets before the heavy FFmpeg render begins.

3. Feature Additions: The "Pro" Layer
Asset Persistence: Create a "Work Directory" for every Job ID. Even if the Render fails, the user must be able to click "More Details" and see the generated Script and Audio player to verify they are correct.

Global Preset Manager: Move Model selections (GPT-4o, ElevenLabs, etc.) into a "Global Settings" or "Presets" tab. The main Dashboard should only show a "Preset Selector" dropdown to keep the UI clean.

Real-time Logs: Inside the "More Details" accordion, add a terminal-style log window (tail -f style) showing the current raw API responses or FFmpeg progress percentages.

4. Technical Constraints
Framework: Use Lucide-react for icons and Framer Motion for smooth state transitions between "Pending" and "Ready."

UX: Implement a "Bulk Action" checkbox system in the list view to allow for mass-deleting or mass-retrying failed jobs.

A Quick UI Tip for the "Queue"
Instead of the current vertical cards that hide information, use a Collapsible Row design.

Closed State: Shows the title, a small thumbnail, and a horizontal progress bar.

Open State: Expands to show the "More Details" (Script preview, Audio player, and Error logs) as seen in your second screenshot.