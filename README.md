<p align = 'center'>
  <img src = 'https://github.com/Meet2304/Project-Aether/blob/main/Project-Aether-Header.png'>
</p>

<h1 align="center">Project Aether</h1>

<p align = 'justify'>
In ancient myth, Aether was the divine light — the purest form of air that filled the heavens, untouched by clouds, bias, or darkness. It was the breath of gods, a realm of absolute clarity where all things were seen as they truly were.
<br>
Inspired by that same spirit, Project Aether is built to bring clarity, fairness, and objectivity to performance evaluation. Powered by computer vision, it observes without emotion, judges without bias, and sees every motion with precision and truth.
<br>
Where human error clouds judgment, Aether remains clear.
Where opinions falter, Aether stands firm.
In a world full of noise, Aether listens only to the movement — and tells the truth in every frame.
<br>
This is more than a system.
It is a promise — to let performance speak for itself.
</p>

---

## Trick Recorder PWA

A mobile-first Progressive Web App for recording skateboard tricks, marking
multiple clips with IN/OUT points, labelling each with a trick name, and
uploading them to Supabase Storage — followed by an optional YOLO11 pose
post-processing pass that overlays a color-coded skeleton on each clip.

### Tech stack

- **Next.js 14** (App Router) + **React 18** + **TypeScript**
- **Tailwind CSS** for all UI (no component library)
- **Supabase** (`@supabase/ssr`) for Storage + a `clips` metadata table
- **MediaRecorder** + canvas re-record for client-side recording & trimming
- **ultralytics YOLO11 Pose** + OpenCV for the Python skeleton processor

### Screens

1. **Home** (`/`) — Record button + recent clips grouped by trick (Raw/Processed badge)
2. **Record** (`/record`) — full-screen `getUserMedia` viewfinder, MediaRecorder, live timer
3. **Review** (`/review`) — playback, draggable timeline scrubber, IN/OUT clip marking, naming panel
4. **Upload** (`/upload`) — per-clip trimming + upload progress, success summary

Video is handed between screens via `sessionStorage` (blob URL). User-added
tricks persist in `localStorage`.

### Local development

```bash
npm install
cp .env.example .env.local   # already contains the provided Supabase creds
npm run dev                  # http://localhost:3000
```

> Camera access (`getUserMedia`) requires a **secure context**. `localhost`
> works; to test from a phone use HTTPS (e.g. `npx next dev --experimental-https`
> or a tunnel like ngrok/Cloudflare Tunnel).

### Supabase setup (one-time)

The app expects a `clips` table and a public `skateboard-data` storage bucket.
Apply the migration to your project (`cqucehzicplvvvnuqtba`):

- **Dashboard:** open SQL Editor → paste the contents of
  `supabase/migrations/001_create_clips.sql` → Run.
- **CLI:** `supabase db push` (after `supabase link`).

The migration creates the table, indexes, the public bucket, and permissive
RLS policies that match the keyless (publishable-key) client flow. **Tighten
these policies before any production use.**

### Skeleton post-processing

```bash
cd scripts
cp .env.example .env          # Supabase creds (service-role key preferred)
pip install -r requirements.txt
python process_skeletons.py
```

Processes every `clips` row where `processed = false`: downloads the raw video,
runs YOLO11 pose per frame, draws a semi-transparent skeleton (left = blue,
right = green, center = white), re-encodes, uploads to
`skateboard-data/{trick}/processed/{filename}_skeleton.mp4`, and flips
`processed = true`.

### Notes

- No service worker / PWA manifest complexity by design — it's a responsive
  mobile web app that installs cleanly to the home screen.
- All video handling is client-side; the server never touches raw video.
- The timeline scrubber uses Pointer Events, so dragging works with both touch
  and mouse.
