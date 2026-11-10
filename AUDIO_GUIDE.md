# Audio Guide — The Gioia Museum

## 1. Background music (YouTube)

The museum uses the YouTube IFrame Player API for background music.

Configuration is stored in `data/birthday.json` under `music`:

```json
"music": {
  "title": "Panata",
  "artist": "Tothapi",
  "youtubeVideoId": "",
  "youtubeStart": 0,
  "spotify": "https://open.spotify.com/track/5o5rOj568TLbuwXvwA9WIZ"
}
```

- `youtubeVideoId` — the YouTube video ID. Leave empty to use the local file / Spotify fallback.
- `youtubeStart` — seconds where playback should begin (for example, the first chorus).
- The player is created during loading and started from the "Enter Your Museum" button click, so browser autoplay rules are respected.
- Music does not loop and continues across rooms without restarting.
- Play/pause and mute controls are in the compact music dock at the bottom of the screen.

### Selected background music

- Video: https://youtu.be/K7QloSPisLg
- Video ID: `K7QloSPisLg`
- Start: 10 seconds
- Config: `data/birthday.json` → `music.youtubeVideoId`, `music.youtubeStart`

### Countdown birthday audio

- Video: https://youtu.be/VpFdk24NUyM
- Trigger: when the real countdown reaches 10 seconds remaining.
- The final “Happy Birthday!” shout aligns with zero.
- Preview mode triggers the same audio.

### Normal Happy Birthday sound effect

- Video: https://youtube.com/shorts/0KUGkoL-VXA
- Trigger: cake interaction (when all candles are blown out), in addition to the existing celebration.

### Final surprise audio

- Video: https://youtu.be/HmW428UT43A
- Trigger: “One Last Surprise” button in the final room, synchronized with the dancing character.

## 2. Sound effects

The birthday celebration and cake interactions use a **synthesized** chime generated with the Web Audio API (`js/sound.js`). No audio file is required, so a missing file never breaks the experience.

- `playCelebrationSound()` — plays when the countdown reaches zero and when preview is triggered.
- `playCakeSound()` — plays once when all candles are blown out.

If you want to use real audio files instead, you can replace the calls in `js/main.js` and `js/interactions.js` with an `Audio` element pointing to:

- `assets/audio/celebration.mp3`
- `assets/audio/cake-celebration.mp3`

## 3. Local fallback file

If `youtubeVideoId` is empty, the museum falls back to `assets/audio/panata-by-tothapi.mp3`. Place the MP3 there if you want local playback. The Spotify link is always shown.

## 4. Supported formats

- YouTube streaming (preferred).
- MP3 for the local fallback.
- Browser autoplay requires a user gesture; the "Enter Your Museum" button provides it.

## 5. How to replace audio without editing code

- Background song: edit `data/birthday.json` → `music`.
- Sound effects: optional; the built-in chime works without files.
- No changes to `js/` are required for configuration.
