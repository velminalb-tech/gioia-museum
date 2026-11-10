# The museum soundtrack

The intended song is **“Panata” by Tothapi**.

The MP3 is **not** included with this project because it is copyrighted. Add a
legally obtained copy here with this exact name:

```
assets/audio/panata-by-tothapi.mp3
```

You can also change the path in `data/birthday.json` under `music.file`.

## If you do not add the file

The site is designed to keep working:

- the music dock switches to **Listen on Spotify**,
- the Spotify button uses `music.spotify` from `data/birthday.json`,
- the default link is <https://open.spotify.com/track/5o5rOj568TLbuwXvwA9WIZ>.

## Please do not redistribute the recording

If you publish this museum on a public GitHub repository or a public host, do
not upload an unlicensed copy of the song. Either keep the MP3 out of the
repository and add it only to your private copy, or use the Spotify fallback.

Recommended `.gitignore` entry if the audio must stay private:

```
assets/audio/*.mp3
```

The site will gracefully fall back to Spotify when the file is absent.
