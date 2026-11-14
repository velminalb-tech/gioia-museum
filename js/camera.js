/* ============================================================
   camera.js — turns page scroll into a camera path through the
   museum. The chapters are measured, not hardcoded to pixels,
   so it adapts to every screen size.
   ============================================================ */

const ROOM_KEYS = [
  {
    start: { pos: [0, 1.75, 3.5], look: [0, 1.7, -22] },
    mid: [
      { t: 0.2, pos: [0, 1.72, -18], look: [-3.5, 2.1, -23] },
      { t: 0.42, pos: [0, 1.72, -28], look: [3.5, 2.1, -31] },
      { t: 0.64, pos: [0, 1.72, -36], look: [-3.3, 2.1, -39] },
      { t: 0.84, pos: [0, 1.72, -44], look: [3.3, 2.1, -47] }
    ],
    end: { pos: [0, 1.7, -52], look: [0, 1.68, -62] }
  },
  {
    start: { pos: [0, 1.62, -57], look: [0, 1.3, -69] },
    mid: [
      // Botanical inscription, tucked just inside the room on the left.
      { t: 0.06, pos: [0, 1.62, -57.4], look: [-3.4, 1.7, -61.8] },
      { t: 0.16, pos: [0, 1.62, -59.8], look: [-3.4, 1.55, -61.8] },
      { t: 0.3, pos: [0, 1.62, -62], look: [-2.6, 1.55, -71.5] },
      { t: 0.48, pos: [0, 1.62, -66], look: [2.6, 1.55, -71.5] },
      { t: 0.66, pos: [0, 1.66, -69], look: [-2.6, 1.5, -76.5] },
      { t: 0.84, pos: [0, 1.66, -72], look: [2.6, 1.5, -76.5] }
    ],
    end: { pos: [0, 1.68, -72], look: [0, 1.42, -76.5] }
  },
  {
    start: { pos: [0, 1.7, -86], look: [0, 1.6, -104] },
    mid: [
      { t: 0.1, pos: [0, 1.7, -90], look: [-6.8, 2.2, -96] },
      { t: 0.24, pos: [0, 1.7, -100], look: [6.8, 2.2, -106] },
      // Movie tickets, then a held beat so the pair is readable.
      { t: 0.36, pos: [0, 1.7, -105.6], look: [3.1, 1.55, -110.5] },
      { t: 0.44, pos: [0, 1.7, -109.2], look: [3.1, 1.5, -110.5] },
      { t: 0.58, pos: [0, 1.7, -113], look: [-6.8, 2.2, -117] },
      // Compass and its illuminated path.
      { t: 0.69, pos: [0, 1.7, -118.2], look: [-3.1, 1.5, -122] },
      { t: 0.77, pos: [0, 1.7, -120.8], look: [-3.1, 1.45, -122] },
      { t: 0.89, pos: [0, 1.7, -125.5], look: [6.8, 2.2, -129] }
    ],
    end: { pos: [0, 1.7, -130], look: [0, 1.6, -140] }
  },
  {
    start: { pos: [0, 1.64, -134], look: [0, 1.28, -146] },
    mid: [
      // The 12 DAYS · 13 HOURS dedication, left of the walking line.
      { t: 0.14, pos: [0, 1.64, -134.7], look: [-3.0, 1.62, -137.6] },
      { t: 0.24, pos: [0, 1.64, -136.2], look: [-3.0, 1.55, -137.6] },
      { t: 0.33, pos: [0, 1.64, -137.3], look: [-3.0, 1.52, -137.6] }
    ],
    // Begin the turn toward the vinyl as the room opens into the passage.
    end: { pos: [0, 1.64, -139], look: [2.8, 1.5, -143.2] }
  },
  {
    start: { pos: [0, 1.78, -158], look: [0, 1.5, -172] },
    end: { pos: [0, 1.8, -183], look: [0, 1.55, -169] }
  },
  {
    start: { pos: [0, 1.72, -195], look: [0, 1.62, -212] },
    end: { pos: [0, 1.82, -209], look: [0, 1.7, -222] }
  }
];

// New exhibits that live in the passages between chapters still need a
// guided beat, so these keys are placed in the measured gap after a room and
// use exactly the same scroll-driven sampling and easing as every other key.
const TRANSITION_KEYS = [
  // Iced coffee, in the passage after Room II and clear of the pedestals.
  { after: 1, t: 0.22, pos: [0.2, 1.64, -76.6], look: [3.3, 1.6, -82.6] },
  { after: 1, t: 0.38, pos: [0.35, 1.65, -78.2], look: [3.3, 1.5, -82.6] },
  // Vinyl record, then the letters desk, each with its own held beat. The
  // desk keys sit back and look up so the floating letters stay in frame.
  { after: 3, t: 0.14, pos: [0, 1.66, -139.2], look: [3.2, 1.55, -143.2] },
  { after: 3, t: 0.24, pos: [0, 1.67, -140.1], look: [3.2, 1.45, -143.2] },
  { after: 3, t: 0.56, pos: [0, 2, -140.4], look: [0, 2.55, -150] },
  { after: 3, t: 0.72, pos: [0, 2.02, -140.9], look: [0, 2.5, -150] }
];

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const smoothstep = (t) => t * t * (3 - 2 * t);

function lerp3(a, b, t) {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t
  ];
}

/**
 * Measure the actual chapter positions and return a list of camera keys.
 * Called after the museum becomes visible, and again on resize.
 */
export function buildCameraPath(chapters) {
  const totalScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  const viewport = window.innerHeight;
  const keys = [
    {
      p: 0,
      pos: [0, 1.78, 14.5],
      look: [0, 1.72, -2]
    }
  ];

  const chapterSpans = [];

  chapters.forEach((chapter, index) => {
    const room = ROOM_KEYS[Math.min(index, ROOM_KEYS.length - 1)];
    const top = chapter.getBoundingClientRect().top + window.scrollY;
    const span = Math.max(1, chapter.offsetHeight - viewport);
    const startProgress = clamp(top / totalScroll, 0, 1);
    const endProgress = clamp((top + span * 0.9) / totalScroll, 0, 1);
    chapterSpans.push({ start: startProgress, end: endProgress });

    keys.push({ p: startProgress, pos: room.start.pos, look: room.start.look });
    (room.mid || []).forEach((segment) => {
      const fraction = clamp(Number(segment.t) || 0, 0, 1);
      const progress = clamp(startProgress + (endProgress - startProgress) * fraction, 0, 1);
      keys.push({ p: progress, pos: segment.pos, look: segment.look });
    });
    keys.push({ p: endProgress, pos: room.end.pos, look: room.end.look });
  });

  // Exhibits in the passages between rooms get a key inside that measured
  // gap, so they are approached and left with the same easing as the rest.
  TRANSITION_KEYS.forEach((transition) => {
    const span = chapterSpans[transition.after];
    const next = chapterSpans[transition.after + 1];
    if (!span || !next) return;
    const fraction = clamp(Number(transition.t) || 0, 0, 1);
    const progress = clamp(span.end + (next.start - span.end) * fraction, 0, 1);
    keys.push({ p: progress, pos: transition.pos, look: transition.look });
  });

  // The final room gets one last quiet settle. The authored end of the
  // last chapter is used, not whatever key happened to be pushed last.
  const finalSpan = chapterSpans[chapterSpans.length - 1];
  if (finalSpan) {
    const finalRoom = ROOM_KEYS[Math.min(chapters.length - 1, ROOM_KEYS.length - 1)];
    keys.push({ p: 1, pos: finalRoom.end.pos, look: finalRoom.end.look });
  }

  // Keep keys strictly increasing even on odd layouts.
  const sorted = keys
    .filter((key) => Number.isFinite(key.p))
    .sort((a, b) => a.p - b.p)
    .reduce((acc, key) => {
      if (!acc.length) acc.push(key);
      else if (key.p > acc[acc.length - 1].p + 0.00001) acc.push(key);
      return acc;
    }, []);

  if (!sorted.length) {
    sorted.push({ p: 0, pos: [0, 1.78, 14.5], look: [0, 1.72, -2] });
  }

  return sorted;
}

export function sampleCameraPath(keys, progress) {
  if (!keys.length) {
    return { position: [0, 1.78, 14.5], look: [0, 1.72, -2] };
  }

  const p = clamp(progress, 0, 1);
  if (p <= keys[0].p) {
    return { position: keys[0].pos.slice(), look: keys[0].look.slice() };
  }
  const last = keys[keys.length - 1];
  if (p >= last.p) {
    return { position: last.pos.slice(), look: last.look.slice() };
  }

  for (let i = 0; i < keys.length - 1; i += 1) {
    const a = keys[i];
    const b = keys[i + 1];
    if (p >= a.p && p <= b.p) {
      const raw = (p - a.p) / Math.max(0.00001, b.p - a.p);
      const t = smoothstep(clamp(raw, 0, 1));
      return {
        position: lerp3(a.pos, b.pos, t),
        look: lerp3(a.look, b.look, t)
      };
    }
  }

  return { position: last.pos.slice(), look: last.look.slice() };
}
