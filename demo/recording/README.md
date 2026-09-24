# Recording the demo walkthrough

`record.mjs` drives the running demo in Chromium with Playwright and records a captioned video (WebM),
with an on-screen cursor and a caption for each step.

1. Start the demo (see `demo/README.md`) and serve the built frontend on port 4173: `npx vite preview --port 4173`.
2. `npm install playwright` in any folder, then `node record.mjs <output-folder>`.
3. Optional MP4 for phones: `ffmpeg -i <file>.webm -c:v libx264 -crf 24 -pix_fmt yuv420p -movflags +faststart demo.mp4`

Videos are not committed (they are regenerated and large).
