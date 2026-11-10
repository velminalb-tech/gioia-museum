# The Gioia Museum

A scroll-driven 3D museum for Gioia's birthday. Static HTML/CSS/JS — no server,
no build step, no PHP.

- **Opens:** November 15, 2026 · 12:00 AM Asia/Manila
- **Password:** set in `data/birthday.json` (default hint points to “Love”)
- **Libraries:** Three.js, GSAP + ScrollTrigger, and Lenis, all vendored locally
- **Deploy:** any free static host (GitHub Pages, Netlify, Cloudflare Pages)

## The short version

1. Put photos in `assets/images/gallery/` and `assets/images/memories/`.
2. Edit the words in `data/*.json`.
3. Add the song at `assets/audio/panata-by-tothapi.mp3` (optional; Spotify
   fallback is built in).
4. Set `"devPreview": false` in `data/birthday.json` before sharing.
5. Upload the whole folder to a static host.

Full instructions, the photo map, deployment steps, and the testing checklist
are in **[CONFIG.md](CONFIG.md)**.

## Preview locally

The content is loaded with `fetch()`, so use a small HTTP server instead of
opening `index.html` directly:

```powershell
npx serve .
```

or:

```powershell
python -m http.server 8080
```

Then visit `http://localhost:8080`.

## What is inside

```
index.html              the page shell and all six exhibits
css/                    the visual system, animations, responsive rules
js/                     the gate, countdown, 3D world, music, and interactions
data/                   all editable words and photo paths
assets/images/          photographs
assets/audio/           the optional song
vendor/                 Three.js, GSAP, ScrollTrigger, Lenis
CONFIG.md               how to change everything
```

## Documentation

- `CONFIG.md` — configuration and deployment.
- `IMAGE_GUIDE.md` — exact image folders, filenames, and sizes.
- `AUDIO_GUIDE.md` — YouTube music setup, chorus timestamp, and sound effects.

## How to test the birthday celebration

1. Temporarily set `devPreview` to `true` in `data/birthday.json`.
2. Reload the site and log in.
3. Click the small preview star on the countdown screen.
4. The full celebration sequence (animation, chime, greeting) should play, then the museum opens.
5. Use "Exit preview" to return to the locked countdown. The real countdown is never changed.
6. Set `devPreview` back to `false` before sharing.

## How to change background music

1. Find the official YouTube video for "Panata" by Tothapi.
2. Put its video ID and chorus start time (in seconds) into `data/birthday.json` under `music.youtubeVideoId` and `music.youtubeStart`.
3. Save and refresh. Music starts from the chorus when entering the museum.

## How to replace sound effects

The celebration and cake sounds are synthesized with the Web Audio API, so no files are required. If you want real audio files, see `AUDIO_GUIDE.md`.

## Deployment

Upload the whole folder to any static host (GitHub Pages, Netlify, Cloudflare Pages, Vercel). No build step or server is required. Keep relative paths.

## Browser notes

- Music requires a user gesture; the "Enter Your Museum" button provides it.
- WebGL is required for the 3D scene; a fallback background is shown if unavailable.
- Mobile scrolling is supported; the scrollbar is hidden but scrolling remains enabled.

Made by hand, with far too much love.
