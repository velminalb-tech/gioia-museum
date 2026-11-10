/* ============================================================
   ui.js — modals, toasts, confetti and image fallbacks.
   Shared by the exhibits and the main flow.
   ============================================================ */

import { escapeHtml } from "./content.js";

const TAU = Math.PI * 2;

function placeholderPhoto(label = "A photograph will hang here soon.") {
  return `
    <div class="photo-modal__placeholder">
      <span>✦</span>
      <p>${escapeHtml(label)}<br>Add it in <code>data/</code> whenever you're ready.</p>
    </div>
  `;
}

export function createUI({ reducedMotion = false } = {}) {
  const modal = document.getElementById("modal");
  const dialog = modal.querySelector(".modal__dialog");
  const modalBody = document.getElementById("modal-body");
  const closeBtn = document.getElementById("modal-close");
  const backdrop = modal.querySelector(".modal__backdrop");
  const toastEl = document.getElementById("toast");
  const confettiCanvas = document.getElementById("confetti");

  let lastFocus = null;
  let closeHandler = null;
  let toastTimer = 0;
  let confettiRaf = 0;

  function focusableInDialog() {
    return Array.from(
      dialog.querySelectorAll('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])')
    ).filter((node) => node.offsetParent !== null || node === document.activeElement);
  }

  function onKeydown(event) {
    if (modal.hidden) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeModal();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = focusableInDialog();
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function attachImageFallbacks(root, kind = "photo") {
    root.querySelectorAll("img[data-fallback]").forEach((img) => {
      const fail = () => {
        if (kind === "rail") {
          const holder = document.createElement("div");
          holder.className = "rail-card__ph";
          holder.innerHTML = "<span>✦</span>";
          img.replaceWith(holder);
          return;
        }
        const placeholder = document.createElement("div");
        placeholder.innerHTML = placeholderPhoto();
        const node = placeholder.firstElementChild;
        const frame = img.closest(".photo-modal__frame");
        if (frame) frame.replaceWith(node);
        else img.replaceWith(node);
      };
      img.addEventListener("error", fail, { once: true });
      if (img.complete && img.naturalWidth === 0) fail();
    });
  }

  function openModal(html, { variant = "", onClose = null, initialFocus = null } = {}) {
    const wasOpen = !modal.hidden;
    if (!wasOpen) {
      lastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    }
    modalBody.innerHTML = html;
    dialog.className = "modal__dialog" + (variant ? ` modal__dialog--${variant}` : "");
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
    closeHandler = onClose;
    attachImageFallbacks(modalBody, "photo");
    document.dispatchEvent(new CustomEvent("museum:modal", { detail: { open: true } }));
    window.requestAnimationFrame(() => {
      const target =
        initialFocus?.() ||
        dialog.querySelector("[data-autofocus]") ||
        (variant === "letter" ? dialog.querySelector(".letter-modal__close") : closeBtn);
      target?.focus({ preventScroll: true });
    });
  }

  function closeModal() {
    if (modal.hidden) return;
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
    modalBody.innerHTML = "";
    dialog.className = "modal__dialog";
    const callback = closeHandler;
    closeHandler = null;
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
    lastFocus = null;
    document.dispatchEvent(new CustomEvent("museum:modal", { detail: { open: false } }));
    callback?.();
  }

  closeBtn.addEventListener("click", closeModal);
  backdrop.addEventListener("click", closeModal);
  document.addEventListener("keydown", onKeydown);

  /* ---------------- Photo modal ---------------- */

  function photoModal(data) {
    const {
      image = "",
      title = "",
      date = "",
      caption = "",
      message = "",
      kicker = "",
      index = 0,
      total = 1,
      onPrev = null,
      onNext = null
    } = data;

    const visual = image
      ? `<figure class="photo-modal__frame"><img src="${escapeHtml(image)}" alt="${escapeHtml(title || "A photograph")}" data-fallback="photo" decoding="async"></figure>`
      : placeholderPhoto();

    const html = `
      <div class="photo-modal">
        <div class="photo-modal__visual">${visual}</div>
        <div class="photo-modal__copy">
          <p class="photo-modal__kicker">${escapeHtml(kicker)}</p>
          <h2 class="photo-modal__title" id="modal-title">${escapeHtml(title)}</h2>
          ${date ? `<p class="photo-modal__date">${escapeHtml(date)}</p>` : ""}
          ${caption ? `<p class="photo-modal__caption">${escapeHtml(caption)}</p>` : ""}
          ${message ? `<p class="photo-modal__message">${escapeHtml(message)}</p>` : ""}
          <div class="photo-modal__nav">
            <button type="button" data-prev ${index <= 0 ? "disabled" : ""}>← Previous</button>
            <span class="photo-modal__count">${index + 1} / ${total}</span>
            <button type="button" data-next ${index >= total - 1 ? "disabled" : ""}>Next →</button>
          </div>
        </div>
      </div>
    `;

    openModal(html);
    modalBody.querySelector("[data-prev]")?.addEventListener("click", () => {
      if (index > 0) onPrev?.(index - 1);
    });
    modalBody.querySelector("[data-next]")?.addEventListener("click", () => {
      if (index < total - 1) onNext?.(index + 1);
    });
  }

  /* ---------------- Letter modal ---------------- */

  function letterModal(letter, index = 0, total = 1) {
    const body = (letter.body || [])
      .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
      .join("");
    const html = `
      <article class="letter-modal">
        <button class="letter-modal__close" type="button" aria-label="Close the letter" data-autofocus>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
        <div class="letter-modal__seal" aria-hidden="true">✦</div>
        <p class="letter-modal__kicker">Letter ${String(index + 1).padStart(2, "0")} · ${escapeHtml(letter.seal || "For you")}</p>
        <h2 class="letter-modal__title" id="modal-title">${escapeHtml(letter.title || "A letter")}</h2>
        <p class="letter-modal__subtitle">${escapeHtml(letter.subtitle || `${index + 1} of ${total}`)}</p>
        <div class="letter-modal__body">${body}</div>
        <p class="letter-modal__signoff">${escapeHtml(letter.signoff || "")}</p>
      </article>
    `;
    openModal(html, { variant: "letter" });
    modalBody.querySelector(".letter-modal__close")?.addEventListener("click", closeModal);
  }

  /* ---------------- Note modal ---------------- */

  function noteModal({ emoji = "✦", kicker = "", title = "", message = "", actions = [], extra = "" }) {
    const actionHtml = actions
      .map((action, index) => {
        const variant = action.variant || "btn--soft";
        return `<button class="btn ${variant}" type="button" data-note-action="${index}">${escapeHtml(action.label)}</button>`;
      })
      .join("");

    const html = `
      <div class="note-modal">
        <div class="note-modal__emoji" aria-hidden="true">${emoji}</div>
        ${kicker ? `<p class="note-modal__kicker">${escapeHtml(kicker)}</p>` : ""}
        <h2 class="note-modal__title" id="modal-title">${escapeHtml(title)}</h2>
        ${message ? `<p class="note-modal__message">${escapeHtml(message)}</p>` : ""}
        ${extra}
        ${actionHtml ? `<div class="note-modal__actions">${actionHtml}</div>` : ""}
      </div>
    `;

    openModal(html);
    actions.forEach((action, index) => {
      modalBody.querySelector(`[data-note-action="${index}"]`)?.addEventListener("click", () => {
        const keepOpen = action.keepOpen === true;
        if (!keepOpen) closeModal();
        action.onClick?.();
      });
    });
  }

  /* ---------------- Toast ---------------- */

  function toast(message, { duration = 3800 } = {}) {
    toastEl.textContent = message;
    toastEl.classList.add("is-visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toastEl.classList.remove("is-visible"), duration);
  }

  /* ---------------- Confetti ---------------- */

  function confetti({ count = 150, duration = 4200 } = {}) {
    if (reducedMotion) return;
    const ctx = confettiCanvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    confettiCanvas.width = Math.floor(window.innerWidth * dpr);
    confettiCanvas.height = Math.floor(window.innerHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const colors = ["#f0d9a4", "#c9a45c", "#e8c3bd", "#c88f86", "#f8f0e4", "#b57068"];
    const particles = Array.from({ length: count }, () => ({
      x: Math.random() * window.innerWidth,
      y: -30 - Math.random() * window.innerHeight * 0.6,
      vx: (Math.random() - 0.5) * 2.4,
      vy: 1.4 + Math.random() * 3.2,
      w: 4 + Math.random() * 7,
      h: 7 + Math.random() * 9,
      rot: Math.random() * TAU,
      spin: (Math.random() - 0.5) * 0.22,
      color: colors[Math.floor(Math.random() * colors.length)]
    }));

    const start = performance.now();
    window.cancelAnimationFrame(confettiRaf);

    function frame(now) {
      const elapsed = now - start;
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      particles.forEach((particle) => {
        particle.vy += 0.035;
        particle.x += particle.vx + Math.sin(now / 700 + particle.rot) * 0.4;
        particle.y += particle.vy;
        particle.rot += particle.spin;
        ctx.save();
        ctx.translate(particle.x, particle.y);
        ctx.rotate(particle.rot);
        ctx.globalAlpha = Math.max(0, 1 - Math.max(0, elapsed - duration * 0.7) / (duration * 0.3));
        ctx.fillStyle = particle.color;
        ctx.fillRect(-particle.w / 2, -particle.h / 2, particle.w, particle.h);
        ctx.restore();
      });
      if (elapsed < duration) {
        confettiRaf = window.requestAnimationFrame(frame);
      } else {
        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      }
    }

    confettiRaf = window.requestAnimationFrame(frame);
  }

  return {
    openModal,
    closeModal,
    photoModal,
    letterModal,
    noteModal,
    toast,
    confetti,
    attachImageFallbacks
  };
}
