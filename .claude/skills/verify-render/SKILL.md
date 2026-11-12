---
name: verify-render
description: Use after any change to how an AutomateYT video looks or sounds (Motion scenes, captions, voice, cartoon assembly), or when asked to check a rendered video. Extracts frames into a contact sheet and checks sync, layout, language and length.
---

# Verify a render

A video change is not done until a real MP4 was looked at. Use the FFmpeg that ships with the app: `node_modules/ffmpeg-static/ffmpeg.exe` (on Windows; `ffmpeg` elsewhere).

## Steps
1. **Render** the smallest real example. Use a preset in `/motion`, or a 3-shot episode in `/cartoon` with the `stills` engine. Wait until `status.json` says `done`; if it says `failed`, read `log.txt`.
2. **Length and size:** `ffmpeg -hide_banner -i storage/<format>/<id>/video.mp4` and read Duration and the `1080x1920` stream line. The duration must match the sum of the scene or shot durations in `spec.final.json` (±0.2 s).
3. **Contact sheet:** `ffmpeg -y -i video.mp4 -vf "fps=1,scale=270:-1,tile=6x4" -frames:v 1 sheet.png`. For short clips use `fps=2`. Open the image.
4. **Check each frame for:**
   - text cut off at the edges or overlapping;
   - the caption showing the words being spoken at that second (compare with `words` in `spec.final.json`);
   - a scene that starts blank for more than about 0.3 s;
   - a missing or wrong theme;
   - for Urdu: Urdu (Nastaliq) script, right-to-left, with **no Devanagari anywhere**.
5. **Audio:** check that every scene has a `assets/*.mp3` and that `ffmpeg -i video.mp4` shows an audio stream. If you can, play the first 5 s and the last 5 s.
6. **Report** to the owner: what you checked, what passed, and what you could not check (for example "did not listen to the audio").

Fix and re-render until every check passes. Delete test jobs you made, but only your own.
