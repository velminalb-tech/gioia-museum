/* ============================================================
   countdown.js — real time in Asia/Manila via an ISO timestamp
   with an explicit +08:00 offset. No hardcoded durations.
   ============================================================ */

const FALLBACK_TARGET = "2026-11-15T00:00:00+08:00";

function resolveTarget(iso) {
  let target = new Date(iso);
  if (Number.isNaN(target.getTime())) {
    console.warn("[Gioia Museum] Invalid birthdayIso in data/birthday.json — using the fallback date.");
    target = new Date(FALLBACK_TARGET);
  }
  return target;
}

function pad(value) {
  return String(Math.max(0, value)).padStart(2, "0");
}

export function createCountdown(content, { onComplete, onPreview, onPreviewComplete, onTenSeconds }) {
  const target = resolveTarget(content.site.birthdayIso || FALLBACK_TARGET);
  const screen = document.getElementById("screen-countdown");
  const star = document.getElementById("preview-star");
  const fields = {
    days: document.getElementById("cd-days"),
    hours: document.getElementById("cd-hours"),
    minutes: document.getElementById("cd-minutes"),
    seconds: document.getElementById("cd-seconds")
  };

  const clock = screen.querySelector(".countdown__clock");
  const dateNote = screen.querySelector(".countdown__date span");
  if (dateNote) dateNote.textContent = content.countdown.dateNote;
  if (clock) {
    clock.setAttribute(
      "aria-label",
      `Countdown to ${content.site.birthdayDisplay} at ${content.site.birthdayTimeDisplay}`
    );
  }

  let timer = null;
  let finished = false;
  let tenSecondsTriggered = false;
  let previewMode = false;
  let previewTarget = 0;
  let previewAudioTriggered = false;

  function clearTimer() {
    if (timer !== null) {
      window.clearInterval(timer);
      timer = null;
    }
  }

  function finish() {
    if (finished) return;
    finished = true;
    clearTimer();
    onComplete?.();
  }

  function tick() {
    const diff = target.getTime() - Date.now();
    if (diff <= 0) {
      fields.days.textContent = "00";
      fields.hours.textContent = "00";
      fields.minutes.textContent = "00";
      fields.seconds.textContent = "00";
      finish();
      return;
    }

    const totalSeconds = Math.floor(diff / 1000);
    if (!tenSecondsTriggered && diff <= 11300 && diff > 10000) {
      tenSecondsTriggered = true;
      onTenSeconds?.();
    }
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    fields.days.textContent = pad(days);
    fields.hours.textContent = pad(hours);
    fields.minutes.textContent = pad(minutes);
    fields.seconds.textContent = pad(seconds);
  }

  star.hidden = !content.site.devPreview;
  const earlyNote = screen.querySelector(".countdown__early");
  if (earlyNote && !content.site.devPreview) earlyNote.hidden = true;
  star.addEventListener("click", () => {
    if (!content.site.devPreview) return;
    onPreview?.();
  });

  function show() {
    screen.hidden = false;
    screen.classList.remove("is-ready");
    finished = false;
    tenSecondsTriggered = false;
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => screen.classList.add("is-ready"));
    });
    tick();
    clearTimer();
    timer = window.setInterval(tick, 250);
  }

  function hide() {
    screen.hidden = true;
    screen.classList.remove("is-ready");
    clearTimer();
  }

  function isPast() {
    return target.getTime() <= Date.now();
  }

  function preview() {
    previewMode = true;
    finished = false;
    clearTimer();
    previewTarget = Date.now() + 11000;
    previewAudioTriggered = false;
    tenSecondsTriggered = true;
    screen.hidden = false;
    screen.classList.remove("is-ready");
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => screen.classList.add("is-ready"));
    });

    function previewTick() {
      const diff = previewTarget - Date.now();
      if (diff <= 0) {
        fields.days.textContent = "00";
        fields.hours.textContent = "00";
        fields.minutes.textContent = "00";
        fields.seconds.textContent = "00";
        clearTimer();
        previewMode = false;
        onPreviewComplete?.();
        return;
      }
      const totalSeconds = Math.ceil(diff / 1000);
      const days = Math.floor(totalSeconds / 86400);
      const hours = Math.floor((totalSeconds % 86400) / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;

      fields.days.textContent = pad(days);
      fields.hours.textContent = pad(hours);
      fields.minutes.textContent = pad(minutes);
      fields.seconds.textContent = pad(seconds);

      if (!previewAudioTriggered && diff <= 11300 && diff > 0) {
        previewAudioTriggered = true;
        onTenSeconds?.();
      }
    }

    previewTick();
    timer = window.setInterval(previewTick, 250);
  }

  function stop() {
    clearTimer();
  }

  function start() {
    clearTimer();
    tenSecondsTriggered = false;
    tick();
    timer = window.setInterval(tick, 250);
  }

  return { show, hide, start, stop, isPast, target, screen, preview };
}
