/* ============================================================
   main.js — the museum director.
   Wires the gate, the countdown, the 3D world, the music and the
   six exhibits into one continuous experience.
   ============================================================ */

import { loadContent, escapeHtml } from "./content.js";
import { createLogin } from "./login.js";
import { createCountdown } from "./countdown.js";
import { createMusic } from "./music.js";
import { createMuseumScene } from "./museum.js";
import { createUI } from "./ui.js";
import { createInteractions } from "./interactions.js";
import { createLabels } from "./labels.js";
import { playCelebrationSound } from "./sound.js";
import { createYouTubeSound } from "./youtubeSound.js";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

const loader = document.getElementById("loader");
const loaderBar = document.getElementById("loader-bar");
const loaderText = document.getElementById("loader-text");
const museum = document.getElementById("museum");
const museumScroll = document.getElementById("museum-scroll");
const unlockScreen = document.getElementById("screen-unlock");
const previewChip = document.getElementById("preview-chip");
const previewBadge = document.getElementById("preview-badge");
const progressFill = document.getElementById("progress-fill");
const progressCount = document.getElementById("progress-count");
const currentRoman = document.getElementById("current-roman");
const currentTitle = document.getElementById("current-title");
const scrollCue = document.getElementById("scroll-cue");

const loadingMessages = [
  "Preparing the rooms…",
  "Straightening the frames…",
  "Warming the lights…",
  "Folding the letters…",
  "Polishing the cake stand…",
  "Almost ready…"
];

const state = {
  content: null,
  ui: null,
  scene: null,
  music: null,
  login: null,
  countdown: null,
  interactions: null,
  labels: null,
  lenis: null,
  previewMode: false,
  museumShown: false,
  milestonesShown: false,
  celebrationPanelShown: false,
  visited: new Set(),
  currentChapter: 0,
  cachedChapters: [],
  scrollTriggers: [],
  scrollRaf: 0,
  suppressCountdownComplete: false,
  reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches
};

/* ------------------------------------------------------------
   Loader
   ------------------------------------------------------------ */

let loaderProgress = 0;
let loaderFake = 6;
let loaderTimer = 0;

function setLoader(progress, message) {
  loaderProgress = Math.max(loaderProgress, progress);
  if (loaderBar) loaderBar.style.width = `${Math.min(100, loaderProgress)}%`;
  if (message && loaderText) loaderText.textContent = message;
}

function startLoader() {
  let index = 0;
  loaderTimer = window.setInterval(() => {
    loaderFake = Math.min(40, loaderFake + 2 + Math.random() * 5);
    setLoader(loaderFake);
    if (Math.random() > 0.55) {
      index = Math.min(index + 1, loadingMessages.length - 1);
      if (loaderText) loaderText.textContent = loadingMessages[index];
    }
  }, 340);
}

function stopLoader() {
  window.clearInterval(loaderTimer);
}

function preloadImages(paths) {
  const unique = Array.from(new Set(paths.filter(Boolean)));
  if (!unique.length) return Promise.resolve();
  let done = 0;
  return Promise.all(
    unique.map(
      (path) =>
        new Promise((resolve) => {
          const image = new Image();
          image.onload = () => {
            done += 1;
            setLoader(46 + (done / unique.length) * 46);
            resolve();
          };
          image.onerror = () => {
            done += 1;
            setLoader(46 + (done / unique.length) * 46);
            resolve();
          };
          image.src = path;
        })
    )
  );
}

/* ------------------------------------------------------------
   Small helpers
   ------------------------------------------------------------ */

function lookup(object, path) {
  return path.split(".").reduce((current, key) => (current == null ? current : current[key]), object);
}

function setText(selector, value) {
  const node = typeof selector === "string" ? document.querySelector(selector) : selector;
  if (node && value != null) node.textContent = value;
}

function applyCopy() {
  document.querySelectorAll("[data-copy]").forEach((node) => {
    const value = lookup(state.content, node.getAttribute("data-copy"));
    if (value != null) node.textContent = String(value);
  });

  setText("#progress-label", state.content.museum?.progressLabel || "Explored");
  setText("#replay-button", state.content.museum?.replay || "Walk through again");
  setText("#doors-button", state.content.museum?.backToDoors || "Back to the entrance");
  setText("#enter-museum span", state.content.unlock?.button || "Enter Your Museum");
  setText("#replay-button", state.content.museum?.replay);
  setText("#doors-button", state.content.museum?.backToDoors);
}

function setScreen(show, element) {
  if (element) element.hidden = !show;
}

function stopMuseum() {
  state.museumShown = false;
  museum.hidden = true;
  killScrollTriggers();
  state.scene?.setActive(false);
  state.scene?.setDoors(false);
  state.music?.stop();
  state.music?.hide();
  if (previewChip) previewChip.hidden = true;
  if (state.lenis) state.lenis.stop();
}

function hideEverything() {
  state.login?.hide();
  state.countdown?.stop();
  state.countdown?.hide();
  unlockScreen.hidden = true;
  unlockScreen.classList.remove("is-opening", "is-ready", "is-celebrating", "is-greeting", "is-welcome");
  window.clearTimeout(unlockScreen._phaseTimer);
  stopMuseum();
}

/* ------------------------------------------------------------
   Screens and flow
   ------------------------------------------------------------ */

function showLogin() {
  hideEverything();
  document.body.classList.add("is-locked");
  state.login?.show();
}

function showCountdown() {
  hideEverything();
  document.body.classList.add("is-locked");
  state.countdown?.show();
}

function showUnlock(preview = false) {
  state.previewMode = preview;
  hideEverything();
  document.body.classList.add("is-locked");
  state.countdown?.stop();
  state.countdown?.hide();

  const unlock = state.content.unlock || {};
  setText("#unlock-kicker", preview ? "Private preview · the real countdown is untouched" : unlock.kicker);
  setText("#unlock-heading", unlock.heading || "Happy Birthday, Love!");

  const message = document.getElementById("unlock-message");
  if (message) {
    message.innerHTML = (unlock.paragraphs || [])
      .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
      .join("");
  }
  setText("#enter-museum span", unlock.button || "Enter Your Museum");
  setText("#unlock-note", preview ? unlock.previewNote || "Preview mode." : unlock.songNote || "Headphones make it better.");
  if (previewBadge) previewBadge.hidden = !preview;

  unlockScreen.hidden = false;
  unlockScreen.classList.remove("is-opening", "is-ready");
  unlockScreen.classList.add("is-celebrating");
  playCelebrationSound();
  state.ui?.confetti?.({ count: 180, duration: 4800 });
  // Force the doors back to their closed position before opening.
  void unlockScreen.offsetWidth;
  window.requestAnimationFrame(() => {
    unlockScreen.classList.add("is-opening");
    window.setTimeout(() => unlockScreen.classList.add("is-ready"), 520);
  });

  if (window.gsap) {
    window.gsap.fromTo(unlockScreen, { opacity: 0.3 }, { opacity: 1, duration: 1.1, ease: "power2.out", overwrite: true });
  }
}

function routeAfterEntry() {
  if (state.countdown?.isPast()) showUnlock(false);
  else showCountdown();
}

function enterMuseum() {
  if (state.museumShown) return;
  document.body.classList.remove("is-locked");
  unlockScreen.hidden = true;
  unlockScreen.classList.remove("is-opening", "is-ready", "is-celebrating", "is-greeting", "is-welcome");
  window.clearTimeout(unlockScreen._phaseTimer);
  museum.hidden = false;
  state.museumShown = true;

  if (state.lenis) {
    state.lenis.scrollTo(0, { immediate: true });
    state.lenis.start();
  } else {
    window.scrollTo(0, 0);
  }

  state.scene?.setActive(true);
  state.scene?.setDoors(true);
  state.music?.reveal();

  if (previewChip) previewChip.hidden = !state.previewMode;
  if (previewBadge) previewBadge.hidden = true;

  state.interactions?.resetCandles();
  state.interactions?.resetSurprise?.();
  state.interactions?.resetSeenPanels?.();
  state.celebrationPanelShown = false;
  measureChapters();
  setupScrollTriggers();
  state.scene?.rebuildPath();
  updateMuseumUI();
  announceChapter(0, { force: true });
  window.setTimeout(() => state.scene?.rebuildPath(), 300);

  if (state.ui) {
    state.ui.toast("Scroll slowly. The museum moves with you.", { duration: 4200 });
  }

  // Called synchronously inside the click gesture so the browser allows audio.
  // It comes after the scroll hint so a missing-song message stays visible.
  state.music?.play();

  if (window.gsap) {
    window.gsap.fromTo(museum, { opacity: 0 }, { opacity: 1, duration: 1.1, ease: "power2.out", overwrite: true });
  }
}

function exitPreview() {
  if (!state.previewMode) return;
  state.previewMode = false;
  state.interactions?.resetSurprise?.();
  stopMuseum();
  unlockScreen.hidden = true;
  unlockScreen.classList.remove("is-opening", "is-ready", "is-celebrating", "is-greeting", "is-welcome");
  window.clearTimeout(unlockScreen._phaseTimer);
  if (previewBadge) previewBadge.hidden = true;
  if (state.lenis) state.lenis.scrollTo(0, { immediate: true });
  else window.scrollTo(0, 0);

  // If midnight passed while the preview was open, there is nothing left to
  // count down to.
  if (state.countdown?.isPast()) {
    state.suppressCountdownComplete = false;
    showUnlock(false);
    return;
  }

  state.suppressCountdownComplete = true;
  document.body.classList.add("is-locked");
  state.countdown?.show();
  window.setTimeout(() => {
    state.suppressCountdownComplete = false;
  }, 1400);
}

function startPreview() {
  state.previewMode = true;
  state.suppressCountdownComplete = false;
  state.countdown?.stop?.();
  state.countdown?.preview?.();
}

function celebrateTransition(preview) {
  const countdown = document.getElementById("screen-countdown");
  if (countdown && !countdown.hidden) {
    countdown.classList.add("is-ending");
    window.setTimeout(() => {
      countdown.classList.remove("is-ending");
      showUnlock(preview);
    }, 720);
    return;
  }
  showUnlock(preview);
}

function handleBirthdayMoment() {
  if (state.suppressCountdownComplete) {
    state.suppressCountdownComplete = false;
    return;
  }
  celebrateTransition(false);
}

/* ------------------------------------------------------------
   Museum UI and progress
   ------------------------------------------------------------ */

function chapterElements() {
  return Array.from(document.querySelectorAll(".chapter[data-chapter]"));
}

function announceChapter(index, { force = false } = {}) {
  const chapter = chapterElements()[index];
  if (!chapter) return;
  const id = chapter.getAttribute("data-chapter");
  document.dispatchEvent(
    new CustomEvent("museum:chapter", {
      detail: { index, id, chapter, force }
    })
  );
}

function measureChapters() {
  state.cachedChapters = chapterElements().map((chapter) => {
    const rect = chapter.getBoundingClientRect();
    return {
      element: chapter,
      top: rect.top + window.scrollY,
      height: chapter.offsetHeight
    };
  });
}

function setupScrollTriggers() {
  killScrollTriggers();
  if (!window.ScrollTrigger || !window.gsap) return;
  window.gsap.registerPlugin(window.ScrollTrigger);
  state.scrollTriggers = chapterElements().map((chapter) =>
    window.ScrollTrigger.create({
      trigger: chapter,
      start: "top 74%",
      end: "bottom 34%",
      onToggle: (self) => {
        chapter.classList.toggle("is-visible", self.isActive);
      }
    })
  );
  window.ScrollTrigger.refresh();
}

function killScrollTriggers() {
  state.scrollTriggers.forEach((trigger) => trigger.kill());
  state.scrollTriggers = [];
  chapterElements().forEach((chapter) => chapter.classList.remove("is-visible"));
}

function scrollToTop() {
  if (state.lenis) state.lenis.scrollTo(0, { duration: 1.3 });
  else window.scrollTo({ top: 0, behavior: state.reducedMotion ? "auto" : "smooth" });
}

function scrollToChapter(index) {
  if (!state.cachedChapters.length) measureChapters();
  const entry = state.cachedChapters[index];
  if (!entry) return;
  if (state.lenis) state.lenis.scrollTo(entry.top + 12, { duration: 1.5 });
  else window.scrollTo({ top: entry.top + 12, behavior: state.reducedMotion ? "auto" : "smooth" });
}

function replayJourney() {
  // The candles are relit, but the "explored" record is cumulative: she has
  // already seen those rooms, and that little 6/6 is worth keeping.
  state.interactions?.resetCandles();
  state.interactions?.resetSurprise?.();
  state.interactions?.resetSeenPanels?.();
  state.celebrationPanelShown = false;
  if (state.lenis) state.lenis.scrollTo(0, { immediate: true });
  scrollToTop();
  window.setTimeout(() => announceChapter(0, { force: true }), 120);
  state.ui?.toast("From the beginning, then.");
}

function showMilestone() {
  if (state.milestonesShown || !state.museumShown) return;
  if (document.body.classList.contains("modal-open")) return;
  const milestone = state.content.surprises?.milestone;
  if (!milestone) return;
  state.milestonesShown = true;
  state.ui.noteModal({
    emoji: "✦",
    kicker: milestone.kicker,
    title: milestone.title,
    message: milestone.message,
    actions: [
      {
        label: milestone.button || "Take me to the last room",
        variant: "btn--gold",
        onClick: () => scrollToChapter(5)
      }
    ]
  });
}

function updateMuseumUI() {
  if (!state.museumShown) return;
  if (!state.cachedChapters.length) measureChapters();
  const chapters = state.cachedChapters;
  if (!chapters.length) return;

  const probe = window.scrollY + window.innerHeight * 0.42;
  let index = 0;
  for (let i = 0; i < chapters.length; i += 1) {
    if (probe >= chapters[i].top - 30) index = i;
  }
  const entry = chapters[index];
  const local = clamp((probe - entry.top) / Math.max(1, entry.height), 0, 1);
  const overall = clamp((index + local) / chapters.length, 0, 1);

  const chapterChanged = index !== state.currentChapter;
  const previousChapter = state.currentChapter;
  state.currentChapter = index;
  state.visited.add(index);

  chapterElements().forEach((node, chapterIndex) => {
    node.classList.toggle("is-current", chapterIndex === index);
  });
  progressFill.style.width = `${Math.round(overall * 100)}%`;
  progressCount.textContent = `${state.visited.size} / ${chapters.length}`;

  const chapter = chapterElements()[index];
  const chapterCopy = state.content.museum?.chapters?.[index];
  currentRoman.textContent = chapter?.dataset.roman || chapterCopy?.roman || String(index + 1);
  currentTitle.textContent = chapterCopy?.nav || chapter?.getAttribute("data-nav") || "";

  if (scrollCue) scrollCue.classList.toggle("is-hidden", window.scrollY > 80);

  if (chapterChanged) announceChapter(index);
  if (chapterChanged && previousChapter === 5 && index !== 5) {
    state.interactions?.resetSurprise?.();
  }

  const currentId = chapterElements()[index]?.getAttribute("data-chapter");
  if (currentId === "celebration" && local > 0.35 && !state.celebrationPanelShown) {
    state.celebrationPanelShown = true;
    state.interactions?.openPanelTimed?.("celebration", 9000);
  }

  const sectionId = chapterElements()[index]?.getAttribute("data-chapter");
  if (sectionId && local > 0.12) {
    state.interactions?.collapsePanel?.(sectionId);
  }

  // Milestone popup disabled: it appeared too early and interrupted the visit.
  // (The data and function remain available if you want to re-enable later.)
}

function scheduleMuseumUI() {
  if (state.scrollRaf) return;
  state.scrollRaf = window.requestAnimationFrame(() => {
    state.scrollRaf = 0;
    updateMuseumUI();
  });
}

/* ------------------------------------------------------------
   Lenis + GSAP
   ------------------------------------------------------------ */

function setupScroll() {
  // Native scrolling is smoother and lighter on touch devices than Lenis.
  if (window.matchMedia("(max-width: 760px)").matches) return;
  if (state.reducedMotion || !window.Lenis) return;
  state.lenis = new window.Lenis({
    lerp: 0.1,
    smoothWheel: true,
    wheelMultiplier: 1,
    touchMultiplier: window.matchMedia("(max-width: 760px)").matches ? 1.35 : 1.15,
    syncTouch: window.matchMedia("(max-width: 760px)").matches
  });
  state.lenis.stop();
  state.lenis.on("scroll", () => {
    if (state.museumShown) scheduleMuseumUI();
  });

  if (window.gsap && window.ScrollTrigger) {
    window.gsap.registerPlugin(window.ScrollTrigger);
    state.lenis.on("scroll", window.ScrollTrigger.update);
    window.gsap.ticker.add((time) => state.lenis.raf(time * 1000));
    window.gsap.ticker.lagSmoothing(0);
  } else {
    const raf = (time) => {
      state.lenis.raf(time);
      window.requestAnimationFrame(raf);
    };
    window.requestAnimationFrame(raf);
  }

  document.addEventListener("museum:modal", (event) => {
    if (!state.lenis) return;
    if (event.detail?.open) state.lenis.stop();
    else if (state.museumShown) state.lenis.start();
  });
}

/* ------------------------------------------------------------
   Boot
   ------------------------------------------------------------ */

// This is a scroll-driven experience. Let the museum decide where the
// visitor starts instead of letting the browser restore an old position.
if ("scrollRestoration" in window.history) {
  window.history.scrollRestoration = "manual";
}

async function boot() {
  startLoader();
  setLoader(8, loadingMessages[0]);
  state.content = await loadContent();

  document.title = state.content.site?.title || "The Gioia Museum";
  applyCopy();

  state.ui = createUI({ reducedMotion: state.reducedMotion });
  state.interactions = createInteractions(state.content, {
    ui: state.ui,
    getScene: () => state.scene,
    getMusic: () => state.music,
    scrollToTop,
    scrollToChapter,
    onReplay: replayJourney,
    onCandlesOut: () => state.ui?.confetti({ count: 60, duration: 2600 })
  });
  state.interactions.applyContent();

  setLoader(34, "Lighting the rooms…");

  try {
    state.scene = createMuseumScene({
      content: state.content,
      reducedMotion: state.reducedMotion,
      onSelect: (payload) => state.interactions?.handleSelect(payload)
    });
  } catch (error) {
    console.warn("[Gioia Museum] 3D scene unavailable; using the atmospheric fallback.", error);
    document.body.classList.add("no-webgl");
    state.scene = null;
  }

  state.labels = createLabels({
    scene: state.scene,
    onSelect: (payload) => state.interactions?.handleSelect(payload)
  });

  if (state.scene) {
    state.scene.onFrame(({ camera, active }) => {
      const container = document.getElementById("cake-controls");
      if (!container) return;
      if (!active || !state.scene.isActive()) {
        container.hidden = true;
        return;
      }
      const anchor = state.scene.getCakeControlsAnchor?.();
      if (!anchor) {
        container.hidden = true;
        return;
      }
      const distance = anchor.distanceTo(camera.position);
      const toAnchor = anchor.clone().sub(camera.position);
      const forward = camera.getWorldDirection(toAnchor.clone().set(0, 0, 0));
      const facing = anchor.clone().sub(camera.position).normalize().dot(forward);
      if (distance > 16 || facing < 0.15) {
        container.hidden = true;
        return;
      }
      const projected = anchor.clone().project(camera);
      const x = (projected.x * 0.5 + 0.5) * window.innerWidth;
      const y = (-projected.y * 0.5 + 0.5) * window.innerHeight;
      container.style.transform = `translate3d(${x}px, ${y - 10}px, 0) translate(-50%, -100%)`;
      container.hidden = false;
    });
  }

  state.music = createMusic(state.content);
  state.music.onUnavailable = () => {
    state.ui.toast(state.content.music?.unavailable || "The song isn't in the museum yet. Try the Spotify button.", { duration: 5200 });
  };

  state.login = createLogin(state.content, { onSuccess: routeAfterEntry });

  const countdownAudio = createYouTubeSound("VpFdk24NUyM", { volume: 1 });
  state.countdown = createCountdown(state.content, {
    onComplete: handleBirthdayMoment,
    onPreview: startPreview,
    onPreviewComplete: () => showUnlock(true),
    onTenSeconds: () => {
      const tryPlay = () => {
        if (countdownAudio.play()) return;
        if (!countdownAudio.ready) window.setTimeout(tryPlay, 200);
      };
      tryPlay();
    }
  });

  setupScroll();

  const images = [
    ...(state.content.gallery?.photos || []).map((photo) => photo.image),
    ...(state.content.memories?.memories || []).map((memory) => memory.image)
  ];
  setLoader(44, "Hanging the photographs…");
  await preloadImages(images);

  setLoader(98, "Welcome.");
  await wait(420);
  stopLoader();
  setLoader(100, "Welcome.");
  loader?.classList.add("is-done");
  document.body.classList.remove("is-loading");
  window.setTimeout(() => {
    if (loader) loader.hidden = true;
  }, 1000);

  await document.fonts?.ready?.catch?.(() => {});

  if (state.login.isAuthenticated()) routeAfterEntry();
  else showLogin();
}

/* ------------------------------------------------------------
   Global wiring
   ------------------------------------------------------------ */

document.getElementById("enter-museum")?.addEventListener("click", enterMuseum);
document.getElementById("exit-preview")?.addEventListener("click", exitPreview);
document.querySelector(".skip-link")?.addEventListener("click", (event) => {
  event.preventDefault();
  if (!state.museumShown) return;
  scrollToTop();
  document.getElementById("museum")?.focus?.({ preventScroll: true });
});
document.querySelectorAll("[data-exit-preview]").forEach((button) => {
  button.addEventListener("click", exitPreview);
});

window.addEventListener("scroll", () => {
  if (state.museumShown) scheduleMuseumUI();
}, { passive: true });

window.addEventListener("resize", () => {
  if (!state.museumShown) return;
  window.requestAnimationFrame(() => {
    measureChapters();
    state.scene?.rebuildPath();
    updateMuseumUI();
    window.ScrollTrigger?.refresh();
  });
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    state.music?.pause();
  }
});

window.addEventListener("pagehide", () => {
  state.music?.stop();
});

boot().catch((error) => {
  console.error("[Gioia Museum] Failed to open the museum.", error);
  stopLoader();
  setLoader(100, "The doors are stuck. Please refresh.");
  document.body.classList.remove("is-loading");
});

/* Expose a tiny handle for debugging without affecting the experience. */
window.gioiaMuseum = {
  get content() {
    return state.content;
  },
  get scene() {
    return state.scene;
  },
  state
};
