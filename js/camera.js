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
      { t: 0.22, pos: [0, 1.62, -62], look: [-2.6, 1.55, -71.5] },
      { t: 0.46, pos: [0, 1.62, -66], look: [2.6, 1.55, -71.5] },
      { t: 0.7, pos: [0, 1.66, -69], look: [-2.6, 1.5, -76.5] },
      { t: 0.9, pos: [0, 1.66, -72], look: [2.6, 1.5, -76.5] }
    ],
    end: { pos: [0, 1.68, -72], look: [0, 1.42, -76.5] }
  },
  {
    start: { pos: [0, 1.7, -86], look: [0, 1.6, -104] },
    mid: [
      { t: 0.18, pos: [0, 1.7, -90], look: [-6.8, 2.2, -96] },
      { t: 0.38, pos: [0, 1.7, -100], look: [6.8, 2.2, -106] },
      { t: 0.58, pos: [0, 1.7, -112], look: [-6.8, 2.2, -117] },
      { t: 0.78, pos: [0, 1.7, -124], look: [6.8, 2.2, -129] }
    ],
    end: { pos: [0, 1.7, -130], look: [0, 1.6, -140] }
  },
  {
    start: { pos: [0, 1.64, -134], look: [0, 1.28, -146] },
    end: { pos: [0, 1.64, -142], look: [0, 1.42, -150] }
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

  chapters.forEach((chapter, index) => {
    const room = ROOM_KEYS[Math.min(index, ROOM_KEYS.length - 1)];
    const top = chapter.getBoundingClientRect().top + window.scrollY;
    const span = Math.max(1, chapter.offsetHeight - viewport);
    const startProgress = clamp(top / totalScroll, 0, 1);
    const endProgress = clamp((top + span * 0.9) / totalScroll, 0, 1);

    keys.push({ p: startProgress, pos: room.start.pos, look: room.start.look });
    (room.mid || []).forEach((segment) => {
      const fraction = clamp(Number(segment.t) || 0, 0, 1);
      const progress = clamp(startProgress + (endProgress - startProgress) * fraction, 0, 1);
      keys.push({ p: progress, pos: segment.pos, look: segment.look });
    });
    keys.push({ p: endProgress, pos: room.end.pos, look: room.end.look });
  });

  // The final room gets one last quiet settle.
  const last = keys[keys.length - 1];
  if (last) {
    keys.push({ p: 1, pos: last.pos, look: last.look });
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
