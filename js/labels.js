/* ============================================================
   labels.js — floating labels anchored to the 3D world.
   ============================================================ */

import { escapeHtml } from "./content.js";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function rectsOverlap(a, b) {
  return !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top);
}

export function createLabels({ scene, onSelect }) {
  const layer = document.getElementById("float-layer");
  if (!layer) return { handleHover() {}, destroy() {} };

  if (!scene) {
    return { handleHover() {}, destroy() {} };
  }

  const museumBar = document.getElementById("museum-bar");
  const musicDock = document.getElementById("music-dock");
  const anchors = typeof scene.getLabelAnchors === "function" ? scene.getLabelAnchors() : [];

  const clusterLimits = {
    gallery: window.matchMedia("(max-width: 760px)").matches ? 1 : 3,
    favorites: window.matchMedia("(max-width: 760px)").matches ? 1 : 2,
    memories: window.matchMedia("(max-width: 760px)").matches ? 1 : 2,
    letters: window.matchMedia("(max-width: 760px)").matches ? 1 : 2,
    celebration: window.matchMedia("(max-width: 760px)").matches ? 1 : 2
  };

  let currentRoom = null;
  let roomEnterTime = 0;
  let hoverKey = null;

  const states = anchors.map((anchor) => {
    const interactive = anchor.interactive !== false;
    const element = document.createElement(interactive ? "button" : "div");
    if (interactive) {
      element.type = "button";
      element.addEventListener("click", () => onSelect?.(anchor.payload));
    }
    element.className = `float-label float-label--${anchor.kind || "object"}`;
    element.dataset.labelKey = anchor.key;
    element.setAttribute("aria-hidden", "true");
    element.tabIndex = -1;

    const kicker = anchor.kicker
      ? `<span class="float-label__kicker">${escapeHtml(anchor.kicker)}</span>`
      : "";
    const title = `<span class="float-label__title">${escapeHtml(anchor.title || "")}</span>`;
    const caption = anchor.caption
      ? `<span class="float-label__caption">${escapeHtml(anchor.caption)}</span>`
      : "";
    const hint = anchor.hint
      ? `<span class="float-label__hint">${escapeHtml(anchor.hint)}</span>`
      : "";
    element.innerHTML = kicker + title + caption + hint;
    layer.appendChild(element);

    return {
      anchor,
      element,
      measured: false,
      width: 0,
      height: 0,
      visible: false
    };
  });

  function hideAll() {
    states.forEach((state) => {
      state.element.classList.remove("is-visible", "is-hot");
      state.element.style.opacity = "";
      state.element.tabIndex = -1;
      state.element.setAttribute("aria-hidden", "true");
    });
  }

  function handleHover(payload) {
    hoverKey = payload?.key || null;
  }

  document.addEventListener("museum:chapter", (event) => {
    currentRoom = event.detail?.id || null;
    roomEnterTime = performance.now();
  });

  function update(camera) {
    if (!camera || !scene.isActive()) {
      hideAll();
      return;
    }

    const now = performance.now();
    const isMobile = window.innerWidth < 760;
    const safeTop = (museumBar?.getBoundingClientRect().bottom || 58) + 8;
    const dockRect = musicDock?.getBoundingClientRect();
    const safeBottom = (dockRect ? dockRect.top : window.innerHeight - 72) - 12;

    const roomAge = now - roomEnterTime;

    // Determine candidates.
    const evaluated = states
      .map((state) => {
        const anchor = state.anchor;
        const distance = anchor.position.distanceTo(camera.position);

        let allowedRoom = anchor.room === null || anchor.room === currentRoom;
        if (!allowedRoom && distance < 9) allowedRoom = true;

        let ttlOk = true;
        if (anchor.ttl) {
          if (anchor.room === currentRoom) ttlOk = roomAge < anchor.ttl;
          else ttlOk = false;
        }

        const inDistance = distance <= anchor.maxDistance && distance >= 1.1;
        const toAnchor = anchor.position.clone().sub(camera.position);
        const camForward = camera.getWorldDirection(toAnchor.clone().set(0, 0, 0));
        const facing = anchor.position.clone().sub(camera.position).normalize().dot(camForward);
        const inFront = facing > 0.05;

        const projected = anchor.position.clone().project(camera);
        const screenX = (projected.x * 0.5 + 0.5) * window.innerWidth;
        const screenY = (-projected.y * 0.5 + 0.5) * window.innerHeight;

        const offscreenX = screenX < -24 || screenX > window.innerWidth + 24;
        const offscreenY = screenY < -24 || screenY > window.innerHeight + 24;

        let baseVisible =
          allowedRoom && ttlOk && inDistance && inFront &&
          (!offscreenX || anchor.edge) &&
          (!offscreenY || anchor.edge);

        const isHovered = hoverKey === anchor.key;
        if (isHovered && inDistance && inFront) baseVisible = true;

        if (baseVisible && anchor.cluster) {
          const limit =
            anchor.maxPerCluster ||
            clusterLimits[anchor.cluster] ||
            (isMobile ? 1 : 3);
          // Limit is applied after sorting; mark for now.
          state._cluster = anchor.cluster;
        } else {
          state._cluster = null;
        }

        return {
          state,
          anchor,
          distance,
          screenX,
          screenY,
          baseVisible,
          isHovered
        };
      })
      .filter((item) => item.baseVisible);

    // Cluster limiting.
    const clusterCounts = {};
    evaluated.sort((a, b) => {
      if (a.isHovered !== b.isHovered) return a.isHovered ? -1 : 1;
      if (a.anchor.priority !== b.anchor.priority) return b.anchor.priority - a.anchor.priority;
      return a.distance - b.distance;
    });
    const limited = [];
    evaluated.forEach((item) => {
      const cluster = item.anchor.cluster;
      if (cluster) {
        const limit =
          item.anchor.maxPerCluster ||
          clusterLimits[cluster] ||
          (isMobile ? 1 : 3);
        const count = clusterCounts[cluster] || 0;
        if (!item.isHovered && count >= limit) return;
        clusterCounts[cluster] = count + 1;
      }
      limited.push(item);
    });

    // Hide all first.
    hideAll();

    // Measure candidates.
    limited.forEach((item) => {
      const state = item.state;
      if (!state.measured) {
        state.element.style.visibility = "hidden";
        state.width = state.element.offsetWidth || 140;
        state.height = state.element.offsetHeight || 44;
        state.measured = true;
        state.element.style.visibility = "";
      }
    });

    const placed = [];
    limited.forEach((item) => {
      const state = item.state;
      const anchor = item.anchor;
      const ls = state;

      let x = item.screenX;
      let y = item.screenY;

      if (anchor.edge) {
        x = clamp(x, 18, window.innerWidth - 18);
        y = clamp(y, safeTop + ls.height, safeBottom);
      } else {
        x = clamp(x, ls.width / 2 + 8, window.innerWidth - ls.width / 2 - 8);
        y = clamp(y, safeTop + ls.height, safeBottom);
      }
      y -= 12;

      let placedRect = null;
      const offsets = [0, 20, -20, 42, -42, 64, -64];
      for (const offset of offsets) {
        const tryY = clamp(y + offset, safeTop + ls.height, safeBottom);
        const rect = {
          left: x - ls.width / 2,
          right: x + ls.width / 2,
          top: tryY - ls.height,
          bottom: tryY
        };
        if (!placed.some((placedRect) => rectsOverlap(placedRect, rect))) {
          placedRect = rect;
          y = tryY;
          break;
        }
      }

      if (!placedRect) return;

      placed.push(placedRect);
      ls.element.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -100%)`;
      const maxD = anchor.maxDistance;
      const alpha = clamp((maxD - item.distance) / Math.max(2, maxD * 0.45), 0.2, 1);
      ls.element.style.opacity = String(alpha);
      ls.element.classList.add("is-visible");
      if (item.isHovered || hoverKey === anchor.key) ls.element.classList.add("is-hot");

      if (ls.element.tagName === "BUTTON") {
        ls.element.tabIndex = 0;
      }
      ls.element.setAttribute("aria-hidden", "false");
      ls.visible = true;
    });
  }

  const unsubscribe = scene.onFrame(({ camera, active }) => {
    if (!active || !scene.isActive()) {
      hideAll();
      return;
    }
    update(camera);
  });

  if (typeof scene.setOnHover === "function") {
    scene.setOnHover((payload) => handleHover(payload));
  }

  return {
    handleHover,
    destroy() {
      unsubscribe?.();
      hideAll();
    }
  };
}