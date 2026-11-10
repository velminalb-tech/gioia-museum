/* ============================================================
   music.js — background music for the whole museum.
   Supports YouTube (preferred) or a local audio file.
   ============================================================ */

export function createMusic(content) {
  const dock = document.getElementById("music-dock");
  const toggle = document.getElementById("music-toggle");
  const mute = document.getElementById("music-mute");
  const spotify = document.getElementById("music-spotify");
  const status = document.getElementById("music-status");
  const title = document.getElementById("music-title");
  const artist = document.getElementById("music-artist");

  title.textContent = content.music?.title || "Panata";
  artist.textContent = content.music?.artist || "Tothapi";
  if (spotify) spotify.href = content.music?.spotify || "https://open.spotify.com/";

  const youtubeId = content.music?.youtubeVideoId || content.music?.youtube?.videoId || "";
  const youtubeStart = Number(content.music?.youtubeStart ?? content.music?.youtube?.start ?? 0) || 0;

  if (youtubeId) {
    return createYouTubeMusic({ dock, toggle, mute, status, title, artist, content, youtubeId, youtubeStart });
  }

  return createFileMusic({ dock, toggle, mute, spotify, status, title, artist, content });
}

/* ============================================================
   YouTube IFrame Player
   ============================================================ */

function createYouTubeMusic({ dock, toggle, mute, status, title, artist, content, youtubeId, youtubeStart }) {
  const videoTitle = content.music?.title || "Panata";
  const videoArtist = content.music?.artist || "Tothapi";

  let player = null;
  let ready = false;
  let hasStarted = false;
  let blockedOnce = false;
  let muted = false;
  let volume = 0.85;

  const container = document.createElement("div");
  container.id = "youtube-music-player";
  container.style.position = "fixed";
  container.style.width = "1px";
  container.style.height = "1px";
  container.style.opacity = "0";
  container.style.pointerEvents = "none";
  container.style.left = "-9999px";
  document.body.appendChild(container);

  const api = {
    onUnavailable: null,
    reveal,
    hide,
    play,
    pause,
    toggle: togglePlayback,
    stop,
    setVolume: (value) => {
      volume = Math.max(0, Math.min(1, Number(value) || 0));
      if (ready && player) {
        try { player.setVolume(Math.round(volume * 100)); } catch (e) {}
      }
    },
    isPlaying: () => ready && player && player.getPlayerState && player.getPlayerState() === 1,
    getPlayer: () => player,
    isReady: () => ready
  };

  function reveal() { if (dock) dock.hidden = false; }
  function hide() { if (dock) dock.hidden = true; }

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
    return new Promise((resolve) => {
      player = new window.YT.Player(container, {
        width: "1",
        height: "1",
        videoId: youtubeId,
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          iv_load_policy: 3,
          modestbranding: 1,
          rel: 0,
          start: youtubeStart
        },
        events: {
          onReady: () => {
            ready = true;
            try { player.setVolume(Math.round(volume * 100)); } catch (error) {}
            if (muted) try { player.mute(); } catch (error) {}
            console.log("[music] ready", youtubeId);
            resolve();
          },
          onError: (event) => {
            console.warn("[music] YouTube player error", event.data, youtubeId);
            dock?.classList.add("is-missing");
            if (status) status.textContent = "Listen on Spotify";
          },
          onStateChange: (event) => {
            const state = event.data;
            if (state === 1) {
              dock?.classList.add("is-playing");
              dock?.classList.remove("needs-tap", "is-missing");
              toggle?.setAttribute("aria-pressed", "true");
              if (toggle) toggle.setAttribute("aria-label", `Pause ${videoTitle} by ${videoArtist}`);
              if (status) status.textContent = "Now playing";
            } else if (state === 2) {
              dock?.classList.remove("is-playing");
              toggle?.setAttribute("aria-pressed", "false");
              if (toggle) toggle.setAttribute("aria-label", `Play ${videoTitle} by ${videoArtist}`);
              if (status) status.textContent = "Paused";
            } else if (state === 0) {
              dock?.classList.remove("is-playing");
              toggle?.setAttribute("aria-pressed", "false");
              if (toggle) toggle.setAttribute("aria-label", `Play ${videoTitle} by ${videoArtist}`);
              if (status) status.textContent = "The song has ended";
            }
          },
          onError: () => {
            dock?.classList.add("is-missing");
            if (status) status.textContent = "Listen on Spotify";
            api.onUnavailable?.();
          }
        }
      });
    });
  }

  // Prepare the player during loading so the Enter click can start it.
  loadApi().then(createPlayer).catch(() => {
    dock?.classList.add("is-missing");
    if (status) status.textContent = "Listen on Spotify";
  });

  function play() {
    reveal();
    if (!ready || !player) {
      // Fall back to a tap prompt if the API is not ready yet.
      if (status) status.textContent = "Tap play to start the song";
      dock?.classList.add("needs-tap");
      // Try again shortly.
      loadApi().then(createPlayer).then(() => play()).catch(() => {});
      return;
    }

    if (!hasStarted) {
      hasStarted = true;
      try { player.seekTo(youtubeStart, true); } catch (error) {}
    }

    try {
      player.playVideo();
    } catch (error) {
      if (status) status.textContent = "Tap play to start the song";
      dock?.classList.add("needs-tap");
    }
  }

  function pause() {
    if (ready && player) {
      try { player.pauseVideo(); } catch (error) {}
    }
  }

  function togglePlayback() {
    if (api.isPlaying()) pause();
    else play();
  }

  function stop() {
    pause();
    hasStarted = false;
    dock?.classList.remove("is-playing", "needs-tap");
  }

  toggle?.addEventListener("click", togglePlayback);

  mute?.addEventListener("click", () => {
    muted = !muted;
    if (ready && player) {
      try {
        if (muted) player.mute();
        else player.unMute();
      } catch (error) {}
    }
    dock?.classList.toggle("is-muted", muted);
    mute.setAttribute("aria-pressed", String(muted));
    mute.setAttribute("aria-label", muted ? "Unmute music" : "Mute music");
  });

  return api;
}

/* ============================================================
   Local audio file (fallback)
   ============================================================ */

function createFileMusic({ dock, toggle, mute, spotify, status, title, artist, content }) {
  const file = content.music?.file || "assets/audio/panata-by-tothapi.mp3";

  const audio = new Audio();
  audio.loop = false;
  audio.preload = "metadata";
  audio.volume = 0.85;

  let hasFile = null;
  let sourceReady = false;
  let blockedOnce = false;

  const api = {
    onUnavailable: null,
    audio,
    reveal,
    hide,
    play,
    pause,
    toggle: togglePlayback,
    stop,
    setVolume: (value) => {
      audio.volume = Math.max(0, Math.min(1, Number(value) || 0));
    },
    isPlaying: () => !audio.paused && !audio.ended
  };

  function setSource() {
    if (sourceReady) return;
    sourceReady = true;
    audio.src = file;
    audio.load();
  }

  async function checkFile() {
    if (/^https?:\/\//i.test(file)) {
      hasFile = true;
      setSource();
      return;
    }
    try {
      const response = await fetch(file, { method: "HEAD", cache: "no-store" });
      if (response.ok || response.status === 405) {
        hasFile = true;
        setSource();
      } else {
        hasFile = false;
        markMissing();
      }
    } catch {
      hasFile = false;
      markMissing();
    }
  }

  function markMissing() {
    dock?.classList.add("is-missing");
    if (status) status.textContent = "Listen on Spotify";
    audio.pause();
  }

  function reveal() { if (dock) dock.hidden = false; }
  function hide() { if (dock) dock.hidden = true; }

  function play() {
    reveal();
    if (hasFile === false) {
      markMissing();
      api.onUnavailable?.();
      return;
    }
    setSource();
    if (audio.ended || (Number.isFinite(audio.duration) && audio.duration > 0 && audio.currentTime >= audio.duration - 0.15)) {
      try { audio.currentTime = 0; } catch (error) {}
    }
    const promise = audio.play();
    if (promise && typeof promise.catch === "function") {
      promise.catch((error) => {
        if (error && error.name === "NotAllowedError") {
          if (status) status.textContent = "Tap play to start the song";
          dock?.classList.add("needs-tap");
          return;
        }
        hasFile = false;
        markMissing();
        if (!blockedOnce) {
          blockedOnce = true;
          api.onUnavailable?.();
        }
      });
    }
  }

  function pause() { audio.pause(); }

  function togglePlayback() {
    if (hasFile === false) {
      markMissing();
      api.onUnavailable?.();
      return;
    }
    if (audio.paused) play();
    else audio.pause();
  }

  function stop() {
    audio.pause();
    try { audio.currentTime = 0; } catch (error) {}
    dock?.classList.remove("is-playing", "needs-tap");
  }

  toggle?.addEventListener("click", togglePlayback);

  mute?.addEventListener("click", () => {
    audio.muted = !audio.muted;
    dock?.classList.toggle("is-muted", audio.muted);
    mute.setAttribute("aria-pressed", String(audio.muted));
    mute.setAttribute("aria-label", audio.muted ? "Unmute music" : "Mute music");
  });

  audio.addEventListener("playing", () => {
    dock.hidden = false;
    dock.classList.add("is-playing");
    dock.classList.remove("needs-tap", "is-missing");
    toggle?.setAttribute("aria-pressed", "true");
    if (toggle) toggle.setAttribute("aria-label", `Pause ${content.music?.title || "Panata"} by ${content.music?.artist || "Tothapi"}`);
    if (status) status.textContent = "Now playing";
    blockedOnce = false;
  });

  audio.addEventListener("pause", () => {
    dock?.classList.remove("is-playing");
    toggle?.setAttribute("aria-pressed", "false");
    if (toggle) toggle.setAttribute("aria-label", `Play ${content.music?.title || "Panata"} by ${content.music?.artist || "Tothapi"}`);
    if (!audio.ended && status) status.textContent = "Paused";
  });

  audio.addEventListener("ended", () => {
    dock?.classList.remove("is-playing");
    toggle?.setAttribute("aria-pressed", "false");
    if (toggle) toggle.setAttribute("aria-label", `Play ${content.music?.title || "Panata"} by ${content.music?.artist || "Tothapi"}`);
    if (status) status.textContent = "The song has ended";
  });

  audio.addEventListener("error", () => {
    if (!audio.src) return;
    hasFile = false;
    markMissing();
  });

  audio.addEventListener("volumechange", () => {
    dock?.classList.toggle("is-muted", audio.muted);
  });

  checkFile();
  return api;
}