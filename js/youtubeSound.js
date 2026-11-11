/* ============================================================
   youtubeSound.js — play a short YouTube clip as a sound effect.
   Player creation is lazy to avoid loading hidden iframes until
   the sound is actually needed.
   ============================================================ */

export function createYouTubeSound(videoId, { volume = 1, onStart, onEnd } = {}) {
  if (!videoId) {
    return { ready: false, play() { return false; }, stop() {}, preload() {} };
  }

  let player = null;
  let ready = false;
  let playing = false;
  let creating = false;
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.width = "1px";
  container.style.height = "1px";
  container.style.opacity = "0";
  container.style.pointerEvents = "none";
  container.style.left = "-9999px";
  document.body.appendChild(container);

  function loadApi() {
    return new Promise((resolve) => {
      if (window.YT && window.YT.Player) {
        resolve();
        return;
      }
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (typeof previous === "function") previous();
        resolve();
      };
      if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
        const script = document.createElement("script");
        script.src = "https://www.youtube.com/iframe_api";
        document.head.appendChild(script);
      }
    });
  }

  function createPlayer() {
    if (player) return Promise.resolve();
    if (creating) return new Promise((resolve) => { const check = () => { if (ready) resolve(); else setTimeout(check, 100); }; check(); });
    creating = true;
    return loadApi().then(() => {
      player = new window.YT.Player(container, {
        width: "1",
        height: "1",
        videoId,
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          iv_load_policy: 3,
          modestbranding: 1,
          rel: 0
        },
        events: {
          onReady: () => {
            ready = true;
            creating = false;
            try { player.setVolume(Math.round(volume * 100)); } catch (e) {}
          },
          onStateChange: (event) => {
            if (event.data === 0) {
              playing = false;
              onEnd?.();
            } else if (event.data === 1) {
              playing = true;
              onStart?.();
            }
          }
        }
      });
    }).catch(() => { creating = false; });
  }

  function preload() {
    createPlayer();
  }

  return {
    get ready() { return ready; },
    play() {
      if (!ready || !player) {
        createPlayer().then(() => {
          if (ready && player && !playing) {
            try { player.seekTo(0, true); player.playVideo(); } catch (e) {}
          }
        });
        return false;
      }
      if (playing) return false;
      try {
        player.seekTo(0, true);
        player.playVideo();
      } catch (e) {
        return false;
      }
      return true;
    },
    stop() {
      if (!ready || !player) return;
      try { player.stopVideo(); } catch (e) {}
      playing = false;
    },
    preload
  };
}