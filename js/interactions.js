/* ============================================================
   interactions.js — everything the visitor can touch.
   Compact exhibit panels, 3D object modals, surprises, final room.
   ============================================================ */

import { escapeHtml } from "./content.js";
import { playCakeSound as playSynthesizedCakeSound } from "./sound.js";
import { createYouTubeSound } from "./youtubeSound.js";

const ROMAN = ["I", "II", "III", "IV", "V", "VI"];

export function createInteractions(content, {
  ui,
  getScene = () => null,
  getMusic = () => null,
  scrollToTop = null,
  scrollToChapter = null,
  onCandlesOut = null,
  onReplay = null
} = {}) {
  const photos = content.gallery?.photos || [];
  const favorites = content.favorites?.items || [];
  const memories = content.memories?.memories || [];
  const letters = content.letters?.letters || [];
  const surprises = content.surprises || {};
  const final = surprises.final || {};

  const cakeAudioPlayer = createYouTubeSound("0KUGkoL-VXA", {
    volume: 1,
    onStart: () => getMusic?.()?.setVolume?.(0.25),
    onEnd: () => getMusic?.()?.setVolume?.(0.85)
  });

  const finalSurprisePlayer = createYouTubeSound("HmW428UT43A", {
    volume: 1,
    onStart: () => {
      getMusic?.()?.setVolume?.(0.2);
      getScene?.()?.setSurpriseDancing?.(true);
    },
    onEnd: () => {
      getMusic?.()?.setVolume?.(0.85);
      getScene?.()?.setSurpriseDancing?.(false);
    }
  });

  const panels = Array.from(document.querySelectorAll("[data-exhibit-panel]"));
  const candleButton = document.getElementById("candles-button");
  const candleCount = document.getElementById("candle-count");
  let candlesLeft = 5;

  const seenPanels = new Set();

  function floatingWish() {
    const wishes = surprises.floatingWishes || [];
    if (!wishes.length) return "";
    return wishes[Math.floor(Math.random() * wishes.length)];
  }

  function updateCandleCount() {
    if (!candleCount) return;
    if (candlesLeft > 0) candleCount.textContent = `· ${candlesLeft} left`;
    else candleCount.textContent = "· all out";
  }

  /* ---------------- Content binding ---------------- */

  function setText(node, value) {
    if (node && value != null) node.textContent = value;
  }

  function panelFor(id) {
    return panels.find((panel) => panel.dataset.panelId === id) || null;
  }

  function setPanel(panel, open) {
    if (!panel) return;
    panel.classList.toggle("is-collapsed", !open);
    const toggle = panel.querySelector(".exhibit-panel__toggle");
    if (toggle) {
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Minimize exhibit information" : "Show exhibit information");
    }
  }

  function collapseAllPanels() {
    panels.forEach((panel) => setPanel(panel, false));
  }

  function applyContent() {
    document.querySelectorAll(".chapter[data-chapter]").forEach((chapter) => {
      const id = chapter.getAttribute("data-chapter");
      const section = content[id]?.section || {};
      let roman = section.roman || ROMAN[Number(chapter.getAttribute("data-index"))] || "";
      let label = section.label || `Exhibit ${String(Number(chapter.getAttribute("data-index")) + 1).padStart(2, "0")}`;
      let title = section.title || "";
      let lede = section.lede || "";
      let hint = section.hint || "";
      let note = section.note || "";

      if (id === "celebration") {
        const extra = content.museum?.celebration || {};
        title = title || "The Celebration Room";
        lede = extra.lede || lede;
        hint = extra.hint || hint;
        note = extra.note || note;
        roman = "V";
        label = "Exhibit 05";
      }

      if (id === "final") {
        const extra = content.museum?.final || {};
        roman = "VI";
        label = final.kicker || "Exhibit 06";
        title = final.heading || "And that's my favorite exhibit.";
        lede = final.supporting || extra.lede || lede;
        hint = extra.hint || "";
        note = "";
      }

      setText(chapter.querySelector("[data-exhibit-label]"), label);
      setText(chapter.querySelector("[data-exhibit-title]"), title);
      setText(chapter.querySelector("[data-exhibit-lede]"), lede);
      setText(chapter.querySelector("[data-exhibit-hint]"), hint);
      setText(chapter.querySelector("[data-exhibit-note]"), note);
      chapter.dataset.roman = roman;
    });

    // Final room letter
    const finalLetter = document.getElementById("final-letter");
    if (finalLetter && Array.isArray(final.letter)) {
      finalLetter.innerHTML = final.letter.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("");
    }
    setText(document.getElementById("final-closing"), final.closing || "");
    setText(document.getElementById("final-signoff"), final.signoff || "");

    // Museum bar chapter names
    const chapters = content.museum?.chapters || [];
    chapters.forEach((chapter, index) => {
      const section = document.querySelector(`.chapter[data-index="${index}"]`);
      if (section && chapter.nav) section.setAttribute("data-nav", chapter.nav);
    });

    buildPanelIndex();
    updateCandleCount();
  }

  function buildPanelIndex() {
    const specs = {
      gallery: photos.map((photo, index) => ({
        key: `photo-${index}`,
        label: photo.title || `Photograph ${index + 1}`,
        meta: `Frame ${ROMAN[index] || index + 1}`,
        onSelect: () => openPhotoAt(index)
      })),
      favorites: favorites.map((item, index) => ({
        key: `favorite-${index}`,
        label: item.name || `Favorite ${index + 1}`,
        meta: item.label || "",
        onSelect: () => openFavoriteAt(index)
      })),
      memories: memories.map((memory, index) => ({
        key: `memory-${index}`,
        label: memory.title || `Memory ${index + 1}`,
        meta: memory.date || "",
        onSelect: () => openMemoryAt(index)
      })),
      letters: letters.map((letter, index) => ({
        key: `letter-${index}`,
        label: letter.seal || letter.title || `Letter ${index + 1}`,
        meta: `Letter ${String(index + 1).padStart(2, "0")}`,
        onSelect: () => openLetterAt(index)
      }))
    };

    panels.forEach((panel) => {
      const list = panel.querySelector("[data-panel-index]");
      if (!list) return;
      const spec = specs[panel.dataset.panelId];
      if (!spec || !spec.length) {
        list.hidden = true;
        return;
      }
      list.hidden = false;
      const listId = `${panel.dataset.panelId}-index-list`;
      list.innerHTML = `
        <button class="exhibit-panel__index-toggle" type="button" aria-expanded="false" aria-controls="${listId}">Browse this room</button>
        <div class="exhibit-panel__index-list" id="${listId}" hidden>
          ${spec
            .map(
              (item) => `
            <button type="button" data-index-key="${escapeHtml(item.key)}">
              <span>${escapeHtml(item.label)}</span>
              <small>${escapeHtml(item.meta)}</small>
            </button>
          `
            )
            .join("")}
        </div>
      `;
      const toggle = list.querySelector(".exhibit-panel__index-toggle");
      const items = list.querySelector(".exhibit-panel__index-list");
      toggle?.addEventListener("click", () => {
        const open = items.hidden;
        items.hidden = !open;
        list.classList.toggle("is-open", open);
        toggle.setAttribute("aria-expanded", String(open));
      });
      items?.querySelectorAll("button").forEach((button, itemIndex) => {
        button.addEventListener("click", () => spec[itemIndex]?.onSelect?.());
      });
    });
  }

  /* ---------------- Panel wiring ---------------- */

  panels.forEach((panel) => {
    const toggle = panel.querySelector(".exhibit-panel__toggle");
    toggle?.addEventListener("click", () => {
      const open = panel.classList.contains("is-collapsed");
      setPanel(panel, open);
      window.clearTimeout(panel._autoTimer);
    });
  });

  document.addEventListener("museum:chapter", (event) => {
    const id = event.detail?.id;
    if (!id) return;
    if (id === "final") finalSurprisePlayer.preload?.();
    if (id === "celebration") return;
    const panel = panelFor(id);
    if (!panel) return;
    // Reopen the compact card whenever a section is (re)entered, then
    // let it fade away again as the visitor scrolls through it.
    setPanel(panel, true);
    window.clearTimeout(panel._autoTimer);
    panel._autoTimer = window.setTimeout(() => setPanel(panel, false), 9000);
  });

  document.addEventListener("museum:modal", (event) => {
    if (event.detail?.open) collapseAllPanels();
  });

  document.addEventListener("pointerdown", (event) => {
    const panel = event.target?.closest?.(".exhibit-panel");
    if (panel) window.clearTimeout(panel._autoTimer);
  });

  /* ---------------- Modals ---------------- */

  function openPhotoAt(index) {
    const photo = photos[index];
    if (!photo) return;
    ui.photoModal({
      image: photo.image,
      title: photo.title,
      date: photo.date,
      caption: photo.caption,
      message: photo.message,
      kicker: `The Gallery of Her · Frame ${ROMAN[index] || index + 1}`,
      index,
      total: photos.length,
      onPrev: (next) => openPhotoAt(next),
      onNext: (next) => openPhotoAt(next)
    });
  }

  function openMemoryAt(index) {
    const memory = memories[index];
    if (!memory) return;
    ui.photoModal({
      image: memory.image,
      title: memory.title,
      date: memory.date,
      caption: memory.caption,
      message: memory.message,
      kicker: `The Memory Hall · ${ROMAN[index] || index + 1}`,
      index,
      total: memories.length,
      onPrev: (next) => openMemoryAt(next),
      onNext: (next) => openMemoryAt(next)
    });
  }

  function openFavoriteAt(index) {
    const item = favorites[index];
    if (!item) return;
    ui.noteModal({
      emoji: item.emoji || "✦",
      kicker: item.label || "Little things",
      title: item.name,
      message: item.message,
      extra: item.note ? `<p class="note-modal__aside">${escapeHtml(item.note)}</p>` : "",
      actions: [{ label: "I'll allow it", variant: "btn--gold" }]
    });
  }

  function openLetterAt(index) {
    const letter = letters[index];
    if (!letter) return;
    ui.letterModal(letter, index, letters.length);
  }

  function openStarAt(index) {
    const message = surprises.stars?.[index];
    if (!message) return;
    ui.noteModal({
      emoji: "✦",
      kicker: "You found a tiny star",
      title: "A small thing I wanted to say.",
      message,
      actions: [{ label: "Keep looking", variant: "btn--gold" }]
    });
  }

  function openCake() {
    const cake = surprises.cake || {};
    ui.noteModal({
      emoji: "🎂",
      kicker: cake.kicker || "The birthday room",
      title: cake.title || "Make a wish, Love.",
      message: cake.message || "Whatever you wish for, I hope it comes true.",
      actions: [
        {
          label: cake.button || "Wish made",
          variant: "btn--gold",
          onClick: () => {
            ui.confetti({ count: 130 });
            const wish = floatingWish();
            if (wish) ui.toast(wish);
          }
        }
      ]
    });
  }

  function openGift() {
    const gift = surprises.gift || {};
    ui.noteModal({
      emoji: "🎁",
      kicker: gift.kicker || "You found the little box",
      title: gift.title || "A gift that doesn't fit in a box.",
      message: gift.message || "I owe you a real one.",
      actions: [
        {
          label: gift.button || "I'll take it",
          variant: "btn--gold",
          onClick: () => {
            ui.confetti({ count: 170 });
            ui.toast("Redeemable whenever you want. No expiry.");
          }
        }
      ]
    });
  }

  function openCandlesDone() {
    const candles = surprises.candles || {};
    ui.noteModal({
      emoji: "🕯️",
      kicker: candles.kicker || "All the candles, out",
      title: candles.title || "You got them all.",
      message: candles.message || "Happy birthday, Love.",
      actions: [
        {
          label: candles.button || "I feel celebrated",
          variant: "btn--gold",
          onClick: () => {
            ui.confetti({ count: 210, duration: 5200 });
            const wish = floatingWish();
            if (wish) ui.toast(wish);
          }
        }
      ]
    });
  }

  /* ---------------- Celebration buttons ---------------- */

  document.getElementById("wish-button")?.addEventListener("click", openCake);
  document.getElementById("gift-button")?.addEventListener("click", openGift);

  candleButton?.addEventListener("click", () => {
    if (candlesLeft <= 0) {
      openCandlesDone();
      return;
    }
    candlesLeft -= 1;
    updateCandleCount();
    getScene()?.setCandlesLit?.(candlesLeft > 0);
    if (candlesLeft === 0) {
      getScene()?.setCandlesLit?.(false);
      const played = cakeAudioPlayer.play();
      if (!played) playSynthesizedCakeSound();
      window.setTimeout(openCandlesDone, 450);
      onCandlesOut?.();
    } else if (candlesLeft === 1) {
      ui.toast("One left.");
    }
  });

  /* ---------------- Stars ---------------- */

  document.querySelectorAll("[data-star]").forEach((star) => {
    star.addEventListener("click", () => openStarAt(Number(star.dataset.star)));
  });

  /* ---------------- Scene clicks ---------------- */

  function handleSelect(payload) {
    if (!payload) return;
    if (payload.type === "photo") {
      let index = Number(payload.index);
      if (!Number.isFinite(index) || index < 0 || index >= photos.length) {
        index = photos.findIndex((photo) => photo.image === payload.path);
      }
      if (index >= 0) openPhotoAt(index);
      else ui.toast("That frame is still being hung.");
      return;
    }
    if (payload.type === "memory") {
      openMemoryAt(Number(payload.index) || 0);
      return;
    }
    if (payload.type === "favorite") {
      openFavoriteAt(Number(payload.index) || 0);
      return;
    }
    if (payload.type === "letter") {
      openLetterAt(Number(payload.index) || 0);
      return;
    }
    if (payload.type === "cake") {
      openCake();
      return;
    }
    if (payload.type === "gift") {
      openGift();
      return;
    }
    if (payload.type === "entrance") {
      ui.toast("You're already inside. Scroll slowly.");
    }
  }

  document.getElementById("brand-home")?.addEventListener("click", () => {
    if (scrollToTop) scrollToTop();
    else window.scrollTo({ top: 0, behavior: "smooth" });
  });

  /* ---------------- Final room ---------------- */

  document.getElementById("replay-button")?.addEventListener("click", () => {
    if (onReplay) {
      onReplay();
      return;
    }
    if (scrollToTop) scrollToTop();
    else window.scrollTo({ top: 0, behavior: "smooth" });
    ui.toast("From the beginning, then.");
  });

  document.getElementById("doors-button")?.addEventListener("click", () => {
    resetSeenPanels();
    if (scrollToChapter) scrollToChapter(0);
    if (scrollToTop) scrollToTop();
    window.setTimeout(() => {
      document.dispatchEvent(new CustomEvent("museum:chapter", { detail: { index: 0, id: "gallery", force: true } }));
    }, 120);
  });

  document.getElementById("final-read-letter")?.addEventListener("click", () => {
    const body = (final.letter || []).map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("");
    ui.openModal(`<div class="final-letter">${body}</div>`);
  });

  document.getElementById("surprise-button")?.addEventListener("click", () => {
    const scene = getScene();
    scene?.resetSurprise?.();
    scene?.revealSurprise?.();
    finalSurprisePlayer.preload?.();
    const tryPlay = () => {
      const played = finalSurprisePlayer.play();
      if (!played && !finalSurprisePlayer.ready) {
        window.setTimeout(tryPlay, 300);
      }
    };
    tryPlay();
  });

  function collapsePanel(id) {
    const panel = panelFor(id);
    if (panel) setPanel(panel, false);
  }

  function resetSurprise() {
    finalSurprisePlayer.stop();
    getScene?.()?.setSurpriseDancing?.(false);
    getScene?.()?.resetSurprise?.();
  }

  function openPanel(id) {
    const panel = panelFor(id);
    if (panel) setPanel(panel, true);
  }

  function openPanelTimed(id, delay = 9000) {
    const panel = panelFor(id);
    if (!panel) return;
    setPanel(panel, true);
    window.clearTimeout(panel._autoTimer);
    panel._autoTimer = window.setTimeout(() => setPanel(panel, false), delay);
  }

  function resetSeenPanels() {
    seenPanels.clear();
  }

  return {
    applyContent,
    handleSelect,
    resetSeenPanels,
    collapsePanel,
    openPanel,
    openPanelTimed,
    resetSurprise,
    openPhotoAt,
    openFavoriteAt,
    openMemoryAt,
    openLetterAt,
    openCake,
    openGift,
    resetCandles() {
      candlesLeft = 5;
      updateCandleCount();
      getScene()?.setCandlesLit?.(true);
    },
    collapseAllPanels
  };
}