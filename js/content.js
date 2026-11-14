/* ============================================================
   content.js — loads the editable JSON, with safe fallbacks.
   If the JSON cannot be fetched (for example when opening the
   file directly without a server), the museum still opens with
   these defaults.
   ============================================================ */

const FILES = ["birthday", "gallery", "favorites", "memories", "letters", "surprises", "exhibits"];

const DEFAULTS = {
  birthday: {
    site: {
      title: "The Gioia Museum",
      subtitle: "A little museum dedicated to my favorite person.",
      recipient: "Gioia",
      nickname: "Love",
      timezone: "Asia/Manila",
      birthdayIso: "2026-11-15T00:00:00+08:00",
      birthdayDisplay: "November 15, 2026",
      birthdayTimeDisplay: "12:00 AM · Manila time",
      password: "love",
      passwordHint: "It's the name I call you when it's just us. Four letters.",
      devPreview: true
    },
    login: {
      kicker: "A private exhibition · for one",
      title: "The Gioia Museum",
      subtitle: "A little museum dedicated to my favorite person.",
      cardKicker: "Private view",
      prompt: "If you're Gioia, you already know the word.",
      fieldLabel: "The word",
      placeholder: "What I call you",
      button: "Enter the museum",
      error: "Not quite. Think of the name I call you when it's just us.",
      hintToggle: "Need a clue?",
      footer: "Made by hand, with far too much love.",
      note: "A little world, not an account. Your word stays in your browser."
    },
    countdown: {
      heading: "Something special is waiting for you, Love.",
      supporting: "The museum is preparing its doors for its most special visitor.",
      label: "The doors open in",
      dateNote: "November 15, 2026 · 12:00 AM · Manila time",
      lockedNote: "Until then, the frames are being straightened, the lights are being warmed, and the last letter is still being written.",
      earlyNote: "The countdown is real. The museum opens the moment the clock does.",
      unlockedHeading: "The doors are open, Love."
    },
    unlock: {
      kicker: "November 15 · The doors are open",
      heading: "Happy Birthday, Love!",
      paragraphs: [
        "Today is all about you. I wanted to make something a little different — something you could walk through, poke at, and keep coming back to.",
        "Welcome to your very own little museum. Every corner holds something I wanted to share with you.",
        "Happy birthday, my love."
      ],
      button: "Enter Your Museum",
      songNote: "Headphones make it better. Take your time in here.",
      previewNote: "Preview mode — the real countdown is untouched."
    },
    museum: {
      barLabel: "A private exhibition",
      enterHint: "Scroll slowly. The museum moves with you.",
      progressLabel: "explored",
      replay: "Walk through again",
      backToDoors: "Back to the entrance",
      milestoneButton: "Keep going",
      celebration: {
        lede: "There's cake, obviously. And a few small things to open. This is the loud, happy part of the museum.",
        hint: "Click the cake, blow out the candles, or open the little box.",
        note: "Please make a wish."
      },
      final: {
        lede: "Because at the end of the day, this whole little museum exists because of you.",
        hint: ""
      },
      chapters: [
        { id: "gallery", roman: "I", nav: "The Gallery of Her" },
        { id: "favorites", roman: "II", nav: "Little Things" },
        { id: "memories", roman: "III", nav: "The Memory Hall" },
        { id: "letters", roman: "IV", nav: "Letters for You" },
        { id: "celebration", roman: "V", nav: "The Celebration Room" },
        { id: "final", roman: "VI", nav: "The Final Room" }
      ]
    },
    music: {
      title: "Panata",
      artist: "Tothapi",
      file: "assets/audio/panata-by-tothapi.mp3",
      youtubeVideoId: "K7QloSPisLg",
      youtubeStart: 10,
      spotify: "https://open.spotify.com/track/5o5rOj568TLbuwXvwA9WIZ",
      note: "Set music.youtubeVideoId to a YouTube video ID to play the song in the museum.",
      unavailable: "The song is being shy in this browser. You can still listen to it on Spotify."
    }
  },
  gallery: {
    section: {
      roman: "I",
      label: "Exhibit 01",
      title: "The Gallery of Her",
      lede: "Every wall in this room is an excuse to look at you a little longer.",
      hint: "Click a frame to look closer.",
      note: "A small collection, still growing."
    },
    photos: []
  },
  favorites: {
    section: {
      roman: "II",
      label: "Exhibit 02",
      title: "Little Things About You",
      lede: "Some exhibits are profound. These are just the things that make you light up.",
      hint: "Tap a little card to peek.",
      note: "The permanent collection."
    },
    items: []
  },
  memories: {
    section: {
      roman: "III",
      label: "Exhibit 03",
      title: "The Memory Hall",
      lede: "A long corridor of moments I kept.",
      hint: "Click a frame to stay in the moment a little longer.",
      note: "Still collecting."
    },
    memories: []
  },
  letters: {
    section: {
      roman: "IV",
      label: "Exhibit 04",
      title: "Letters for You",
      lede: "I'm better at writing things down than saying them out loud.",
      hint: "Click an envelope. They're not going anywhere.",
      note: "Some are for today. Some are for the days after."
    },
    letters: []
  },
  surprises: {
    stars: [],
    floatingWishes: [],
    milestone: {
      threshold: 5,
      kicker: "A note from the curator",
      title: "You've seen most of the museum.",
      message: "There's still one room left — the one I was most nervous to build.",
      button: "Keep going"
    },
    gift: { kicker: "You found the little box", title: "A gift that doesn't fit in a box.", message: "I owe you a real one.", button: "I'll take it" },
    cake: { kicker: "The birthday room", title: "Make a wish, Love.", message: "Whatever you wish for, I hope it comes true.", button: "Wish made" },
    candles: { kicker: "All the candles, out", title: "You got them all.", message: "Happy birthday, Love.", button: "I feel celebrated" },
    final: {
      kicker: "Exhibit 06 · The last room",
      heading: "And that's my favorite exhibit.",
      supporting: "Because at the end of the day, this whole little museum exists because of you.",
      letter: [],
      closing: "Happy Birthday, Love. I love you.",
      signoff: "Always, in every room,"
    }
  },
  exhibits: {
    botanical: {
      kicker: "A small note, growing here",
      title: "A Little Flower for You",
      message: "I remember giving you these little flowers and how much you liked them. So I wanted to let them become part of this little world I made for you. A flower for the month you were born, and a small reminder that I hope life always gives you reasons to bloom.",
      note: "The same little chrysanthemums, kept growing."
    },
    coffee: {
      kicker: "A little pause",
      title: "Your Little Coffee Break",
      message: "A little something you enjoy, especially when you just want to slow down and take a break. I hope you always find time for the little things that make your days better.",
      note: "No particular order. Just yours."
    },
    movie: {
      kicker: "Two little tickets",
      title: "The Movies Are Better With You",
      message: "I still remember watching Spider-Man with you. Maybe it was just another movie date for you, but it became one of those experiences I keep looking back on. Thank you for taking me along, treating me, and making even an ordinary trip to the cinema something worth remembering.",
      note: "One I keep looking back on."
    },
    compass: {
      kicker: "A small brass compass",
      title: "The Way You Lead Me",
      message: "I love the way you hold my hand and lead me when I don't know where to go. Sometimes you know the way, and sometimes you simply want to take the lead. You might not realize it, but those moments mean so much to me. Even when I'm unfamiliar with a place, having you beside me makes the journey feel easier. Thank you for being there, especially on the days when I feel like I have nobody else.",
      note: "Wherever we're going, I'm glad it's with you."
    },
    vinyl: {
      kicker: "A small detail",
      title: "A Little Corner for Your Music",
      message: "A little corner for someone whose music you enjoy.",
      note: "JENNIE · a quiet nod, nothing louder than that."
    },
    plaque: {
      kicker: "12 DAYS · 13 HOURS",
      title: "A LITTLE WORLD, MADE FOR YOU",
      message: "From the first idea to the final detail, I spent these days building a little world with you in mind. Every little part was something I wanted to make special for you.",
      note: "OF PLANNING, CREATING AND BUILDING · Every little detail was worth it."
    }
  }
};

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function deepMerge(base, override) {
  if (override === undefined) return clone(base);
  if (Array.isArray(base) || Array.isArray(override)) {
    return override === undefined ? clone(base) : clone(override);
  }
  if (isPlainObject(base) && isPlainObject(override)) {
    const out = clone(base);
    for (const key of Object.keys(override)) {
      out[key] = key in base ? deepMerge(base[key], override[key]) : clone(override[key]);
    }
    return out;
  }
  return clone(override);
}

async function fetchJson(name) {
  try {
    const response = await fetch(`data/${name}.json`, { cache: "no-store" });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return await response.json();
  } catch (error) {
    console.warn(`[Gioia Museum] data/${name}.json could not be loaded; using fallback content.`, error.message);
    return null;
  }
}

export async function loadContent() {
  const results = await Promise.all(FILES.map(fetchJson));
  // birthday.json holds the site-wide copy, so it lives at the root of the
  // content object. The exhibits keep their own namespaces.
  const content = deepMerge(DEFAULTS.birthday, results[0] || {});
  FILES.slice(1).forEach((name, index) => {
    content[name] = deepMerge(DEFAULTS[name] || {}, results[index + 1] || {});
  });
  return content;
}

export function getPath(object, path, fallback = "") {
  let current = object;
  for (const part of path.split(".")) {
    if (current == null) return fallback;
    current = current[part];
  }
  return current == null ? fallback : current;
}

export function setText(root, selector, value) {
  root.querySelectorAll(selector).forEach((node) => {
    node.textContent = value == null ? "" : String(value);
  });
}

export function normaliseAnswer(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
