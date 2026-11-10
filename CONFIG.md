# The Gioia Museum · Configuration Guide

Everything personal lives in `data/*.json` and `assets/`. You should not need to
touch the JavaScript to change words, photos, dates, or the password.

---

## 1. The one file to edit first

### `data/birthday.json`

| Field | What it does |
| --- | --- |
| `site.password` | The word Gioia types at the gate. Default: `love`. |
| `site.passwordHint` | The clue shown when she taps “Need a clue?” |
| `site.birthdayIso` | The real unlock moment, with an explicit timezone offset. Default: `2026-11-15T00:00:00+08:00`. |
| `site.birthdayDisplay` / `birthdayTimeDisplay` | Human-readable date and time shown on the countdown. |
| `site.devPreview` | `true` shows the tiny preview star on the countdown so **you** can test the museum before the birthday. **Set this to `false` before you share or deploy the site.** |
| `login.*` | Copy on the password screen. |
| `countdown.*` | Copy on the countdown screen. |
| `unlock.*` | The birthday greeting shown before the museum. |
| `museum.*` | Bar labels, chapter names, and the celebration/final room copy. |
| `music.*` | Song title, artist, file path, and the Spotify fallback link. |

> **About the password:** this is a decorative gate, not real security. The
> password is checked in the browser and the content is still visible in the
> files. It exists to make the experience feel private, not to protect a secret.

> **About the date:** the countdown uses the ISO timestamp, not the formatted
> text. Keep the `+08:00` offset (or change it to the correct one). The site
> never shows the countdown again once the date has passed.

### Turn preview mode off for the real gift

```json
"devPreview": false
```

While it is `true`, a small star appears on the countdown screen. Clicking it
opens the birthday greeting and museum without changing the real countdown, and
an **Exit preview** chip returns you to the locked countdown. Set it to `false`
when you are finished testing.

---

## 2. Photographs

Put image files in:

- `assets/images/gallery/` — the Gallery of Her
- `assets/images/memories/` — the Memory Hall

Then point to them from the JSON. Paths are relative to `index.html`, for
example:

```json
"image": "assets/images/gallery/photo-01.jpg"
```

You can use `.jpg`, `.png`, `.webp`, or `.avif`. Keep file sizes reasonable
(roughly under 1–2 MB each) so the museum opens quickly on a phone.

If a path is empty or the file is missing:

- the 3D frame shows a designed “A frame waiting for you” placeholder,
- the click-through modal shows a similar placeholder,
- the rail cards show a small star instead of a broken image.

So you can safely leave some frames for later without the site looking broken.

### Current photo slots

| File | Used by |
| --- | --- |
| `gallery/photo-01.jpg` | Gallery frame I and one Memory Hall frame |
| `gallery/photo-02.jpg` | Gallery frame II and one Memory Hall frame |
| `gallery/photo-03.jpg` | Gallery frame III (currently a placeholder) |
| `gallery/photo-04.jpg` | Gallery frame IV (currently a placeholder) |
| `memories/memory-01.jpg` | Memory Hall frame I |
| `memories/memory-02.jpg` | Memory Hall frame II |
| `memories/memory-03.jpg` | Memory Hall frame III (currently a placeholder) |
| `memories/memory-04.jpg` | Memory Hall frame IV (currently a placeholder) |

To use a different filename, edit the matching `"image"` field in
`data/gallery.json` or `data/memories.json`. You do not have to rename your
files to match the table.

---

## 3. Exhibit content

### `data/gallery.json`

Four photographs. Each entry supports:

```json
{
  "image": "assets/images/gallery/photo-01.jpg",
  "title": "The Smile I Keep Coming Back To",
  "caption": "A short line shown inside the modal.",
  "date": "Optional date or place.",
  "message": "The longer note she reads when she clicks the frame."
}
```

Also edit `section.title`, `section.lede`, `section.hint`, and `section.note`
for the room heading and intro.

### `data/favorites.json`

Exactly the little things: fries, shrimp, and Oishi potato chips. Each item has
`name`, `emoji`, `label`, `image` (optional), `message`, and `note`. The 3D
pedestals build a fries carton, a shrimp, and a chip bag automatically.

### `data/memories.json`

Four memory frames along the hall. Each supports `image`, `title`, `date`,
`caption`, and `message`. The first two currently reuse the two real photos.

### `data/letters.json`

Five letters. Each has:

```json
{
  "seal": "Open when you miss me",
  "title": "The Things I Notice",
  "subtitle": "A small line under the title.",
  "body": ["First paragraph.", "Second paragraph."],
  "signoff": "Yours, always."
}
```

### `data/surprises.json`

- `stars` — the short messages hidden behind the little stars in the rooms.
- `floatingWishes` — random lines shown as a toast after a wish or a gift.
- `milestone` — the note that appears once she has explored most of the museum.
  `threshold` is the number of rooms visited before it opens.
- `gift` — the “gift that doesn't fit in a box” note.
- `cake` — the wish note.
- `candles` — the note after all five candles are blown out.
- `final` — the final room heading, letter, closing line, and signoff.

---

## 4. Music

The intended song is **“Panata” by Tothapi**, at:

```
assets/audio/panata-by-tothapi.mp3
```

The audio is **not** included in this project because it is copyrighted. Add
your own legally obtained copy, or leave it out and use the Spotify button.

- The song never loops.
- Playback starts only after she taps **Enter Your Museum** (browser autoplay
  rules require a tap).
- Play/pause and mute live in the bottom-right dock.
- The dock stays put while she scrolls.
- If the file is missing, the dock shows **Listen on Spotify** and the Spotify
  link in `data/birthday.json` is used instead.
- The song pauses when the tab is hidden.

See `assets/audio/README.md` for details.

> Please do not upload an unlicensed MP3 to a public host. Linking to Spotify is
> the safe option if you do not own the file.

---

## 5. Preview locally

Because the site loads its content with `fetch()`, opening `index.html` directly
with `file://` will fall back to the built-in default copy. Use a tiny local
server instead:

```powershell
# from the project folder
npx serve .
# or
python -m http.server 8080
# or, if you have Node but no npm:
node -e "const h=require('http'),f=require('fs'),p=require('path');h.createServer((q,s)=>{let u=decodeURI(q.url.split('?')[0]);if(u==='/')u='/index.html';let t=p.join(process.cwd(),u);f.readFile(t,(e,d)=>{if(e){s.writeHead(404);s.end('Not found');}else{s.writeHead(200);s.end(d);}})}).listen(8080)"
```

Then open `http://localhost:8080`.

The two current placeholder 404s for `photo-03`, `photo-04`, `memory-03`, and
`memory-04` are expected until you add those images. They do not break anything.

---

## 6. Deploy for free

Everything is static. There is no build step, no PHP, and no database. Upload
the whole folder.

### GitHub Pages

1. Create a repository and upload the project (or push it).
2. Go to **Settings → Pages**.
3. Source: **Deploy from a branch**, branch `main`, folder `/ (root)`.
4. Save. The site will be at `https://<user>.github.io/<repo>/`.

The included `.nojekyll` file tells GitHub Pages to serve the files as-is. All
paths are relative, so the site also works from a subfolder.

### Netlify / Cloudflare Pages

- Drag the project folder into Netlify Drop, or connect the repository.
- Build command: **none**.
- Publish directory: **the project root**.

### Any static host

Upload `index.html`, `css/`, `js/`, `vendor/`, `data/`, `assets/`, and the
manifest/favicon. That is the whole site.

---

## 7. Testing checklist

Run through this once on desktop and once on a phone (or a narrow browser
window) before sharing.

### Gate and countdown

- [ ] The loader reaches 100% and disappears.
- [ ] The password screen appears. A wrong word shows the error message.
- [ ] The correct word opens the countdown (before November 15).
- [ ] The countdown shows the real days/hours/minutes/seconds and updates every
      second.
- [ ] With `devPreview: true`, the tiny star opens the preview greeting.
- [ ] **Exit preview** returns to the countdown and does not unlock the real
      experience.
- [ ] After November 15, the countdown is skipped automatically and the
      birthday greeting appears instead.
- [ ] The greeting is personal and the **Enter Your Museum** button opens the
      museum.

### The museum

- [ ] The doors open and the camera starts at the entrance.
- [ ] Scrolling moves the camera smoothly through all six rooms; there are no
      hard cuts.
- [ ] The top bar updates the room number and the progress bar fills.
- [ ] The Gallery frames open the photo modal; Previous/Next work and the
      counter updates.
- [ ] Missing photos show the designed placeholder, not a broken image.
- [ ] Little Things opens the fries, shrimp, and Oishi notes.
- [ ] Memory frames open their photo/memory modal.
- [ ] Envelopes open the letters; each letter scrolls on a small screen.
- [ ] The cake opens the wish modal; the wish button throws confetti.
- [ ] The gift box opens the gift note.
- [ ] The candle button blows out one candle at a time, then opens the final
      candle note.
- [ ] The little stars open their short messages.
- [ ] The milestone note appears once she has explored most of the museum.
- [ ] The final room shows the letter, closing line, and both buttons.
- [ ] “Walk through again” returns to the entrance and relights the candles.
- [ ] “Back to the entrance” returns to the entrance.

### Music

- [ ] With the MP3 present, tapping **Enter Your Museum** starts the song.
- [ ] Play/pause and mute work, and the song never loops.
- [ ] Scrolling does not restart or interrupt the song.
- [ ] In a new tab without the MP3, the dock shows the Spotify fallback and the
      link opens the correct track.
- [ ] Hiding the tab pauses the song.

### Responsive and accessibility

- [ ] There is no horizontal scrolling at phone widths.
- [ ] Buttons are large enough to tap.
- [ ] The rails can be swiped horizontally.
- [ ] Modals fit on screen and can be closed with Escape or the close button.
- [ ] Keyboard focus is trapped inside an open modal and returns afterwards.
- [ ] With reduced motion enabled (`prefers-reduced-motion`), the experience is
      still usable and not disorienting.
- [ ] With WebGL unavailable, the atmospheric fallback background appears and
      the HTML exhibits still work.
- [ ] The browser console has no errors other than the expected 404s for
      photos you have not added yet.

---

## 8. Troubleshooting

**The site shows the fallback copy / no photos.**
You opened `index.html` directly. Use a local HTTP server (section 5).

**The song doesn't play.**
Check that `assets/audio/panata-by-tothapi.mp3` exists and that the filename in
`data/birthday.json` matches exactly. Browsers also require a tap before audio
can start, which is why playback begins on the museum button.

**The countdown looks wrong.**
Check `site.birthdayIso`. It must be a valid ISO date with an explicit offset,
for example `2026-11-15T00:00:00+08:00`. The formatted display strings are only
labels.

**The preview star is missing.**
`site.devPreview` is `false`. Set it to `true` temporarily to preview, then set
it back to `false`.

**The museum is slow on an old phone.**
The site already lowers the pixel ratio, particle counts, and scene detail on
small screens. Closing other tabs helps. If needed, reduce the number of photos
and memories or use smaller image files.

**I want a different password.**
Change `site.password` and `site.passwordHint` in `data/birthday.json`. It is
case-insensitive and ignores extra spaces. Remember that this is a decorative
gate, not real protection.

## Immersive UI (redesign)

The museum now uses three interaction levels:

1. **Immersive default view** - the 3D world fills the screen. Large cards are gone.
2. **Compact contextual panels** - small translucent panels (about 15-25% desktop width) with a minimize/reopen control. They auto-minimize after the first visit to a room.
3. **Expanded viewers** - photo, letter, note and final-message modals open only on interaction.

Floating labels are anchored to 3D objects and appear by proximity, hover, or selection. They never all show at once. Each compact panel includes an optional **Browse this room** text index for keyboard and screen-reader access; it is collapsed by default.

To edit photographs, memories, favorites, letters, stars, wishes, cake, gift, candles, and the final letter, continue to edit the JSON files in data/ and place images under ssets/images/. Missing images automatically show an attractive placeholder.

