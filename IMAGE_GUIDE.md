# Image Placement Guide — The Gioia Museum

This guide matches the actual implementation in `data/*.json` and `js/museum.js`.

## 1. Gallery of Her

**Source file:** `data/gallery.json` → `photos` array.

Each entry supports:
- `image` — path to the image file.
- `title` — frame title.
- `caption` — short caption shown in the floating label.
- `date` — optional date.
- `message` — full text shown in the photo modal.

**3D frames:** the scene builds up to 4 gallery frames (`js/museum.js`, `galleryPhotos = ...slice(0, 4)`).

**Example entry:**
```json
{
  "image": "assets/images/gallery/photo-01.jpg",
  "title": "The Smile I Keep Coming Back To",
  "caption": "You didn't know I was looking.",
  "date": "",
  "message": "Full message shown when the frame is clicked."
}
```

**Naming convention:**
- `assets/images/gallery/photo-01.jpg`
- `assets/images/gallery/photo-02.jpg`
- `assets/images/gallery/photo-03.jpg`
- `assets/images/gallery/photo-04.jpg`

**Image requirements:**
- Aspect ratio: portrait, about 3:4 (frame is 2.15 × 2.9 units).
- Recommended size: 1200 × 1600 px (or 1080 × 1440).
- Formats: JPG, PNG, WebP.
- Recommended max file size: 500 KB.
- Transparent PNGs are supported but not required.

## 2. Memory Hall

**Source file:** `data/memories.json` → `memories` array.

Each entry supports:
- `image`
- `title`
- `date`
- `caption`
- `message`

**3D frames:** up to 4 memory frames (`slice(0, 4)`).

**Naming convention:**
- `assets/images/memories/memory-01.jpg`
- `assets/images/memories/memory-02.jpg`
- `assets/images/memories/memory-03.jpg`
- `assets/images/memories/memory-04.jpg`

**Image requirements:**
- Aspect ratio: portrait, about 3:4 (frame is 2.25 × 2.95 units).
- Recommended size: 1200 × 1600 px.
- Formats: JPG, PNG, WebP.
- Recommended max file size: 500 KB.

## 3. Favorite Foods

The food exhibit uses **procedural 3D models**, not images. The current items are:
- French Fries
- Shrimp
- Oishi Potato Chips
- Pasta

Their visuals are built in `js/museum.js` (`buildFries`, `buildShrimp`, `buildChips`, `buildPasta`).

The `image` field in `data/favorites.json` is retained for compatibility but is **not rendered** by the current 3D scene. Suggested filenames if you later add image-based favorites:
- `assets/images/favorites/fries.png`
- `assets/images/favorites/shrimp.png`
- `assets/images/favorites/oishi-chips.png`
- `assets/images/favorites/pasta.png`

If you add a new favorite, also add a 3D builder and pedestal slot in `js/museum.js`.

## 4. Other exhibits

- **Celebration Room:** 3D cake, candles, balloons, and gift boxes. No image slots.
- **Letters for You:** 3D envelopes. No image slots.
- **Final Room:** cinematic typography. No image slots.
- **Entrance / museum title:** 3D text. No image slots.

To add a new image-based display anywhere, you would need to extend `js/museum.js` and the relevant JSON file.

## 5. How to add or replace an image

1. Put the image in the correct folder.
2. Keep the filename consistent with the JSON entry.
3. Edit the matching JSON file (`data/gallery.json` or `data/memories.json`).
4. Refresh the page. Missing images automatically show an attractive placeholder.

To add a fifth gallery or memory frame, increase the `slice(0, 4)` limit in `js/museum.js` and add a slot position.

## 5b. Final surprise character head

**File:** `assets/images/surprise/surprise-head.jpg`

- Used as the dancing character's face in the final surprise.
- Replaceable without code changes.
- Aspect ratio: square (1:1). Recommended 512 × 512 px or larger.
- Formats: JPG, PNG, WebP.
- Transparent PNGs are supported but not required.
- If missing, a placeholder texture is used.

## 6. General image requirements

- Prefer optimized JPG or WebP for photographs.
- Keep individual files under 500 KB when possible.
- Use descriptive, lowercase, hyphenated filenames.
- Do not put spaces in filenames.
- Test on mobile after adding images.
