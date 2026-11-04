# A Little World Made for You

A single-page birthday website: playful at the start, cinematic in the middle, and a birthday finale at the end.

## Quick start (XAMPP)

1. Keep this folder in your `htdocs` path (for example `D:\cesar\Documents\htdocs\birthdaypresent`).
2. Start **Apache**.
3. Open `http://localhost/birthdaypresent/`

## Personalize

1. Copy `config.local.php.example` to `config.local.php` and set `HER_NAME` if you want.
2. Put every photograph in `assets/media/photos/` and name them `image1`, `image2`, `image3`, and so on (`jpg`, `jpeg`, `png`, `webp`, or `gif`). The site has 27 photo slots; a missing number stays as a placeholder. The order is listed at the top of `includes/content.php`.
3. Add the edited birthday video as `assets/media/video/birthday.mp4` (optional poster: `assets/media/video/poster.jpg`).
4. Edit captions and card copy in `includes/content.php`.

Until photos are added, each frame shows a warm film-style placeholder with a label.

## Music

**Panata** by Tothapi starts on its own when you reach the vow section, at the first chorus (about 0:41), then pauses at the video section or if you scroll back before that moment. That stretch of the page is themed as a vow: candlelight, yesterday / today / tomorrow, and staying. Playback uses the official YouTube embed. Browsers sometimes block autoplay until a tap; a fallback button appears if that happens. A pause control shows after music starts. There is also a Spotify link.

## QR code

Point any QR generator at the live URL of this site. No login is required.
