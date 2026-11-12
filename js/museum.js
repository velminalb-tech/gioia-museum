/* ============================================================
   museum.js — the 3D world.
   A single continuous museum built along the Z axis. The camera
   travels through it as the page scrolls; nothing is a separate
   screen. Everything is built from the editable JSON content.
   ============================================================ */

import * as THREE from "../vendor/three.module.js";
import { buildCameraPath, sampleCameraPath } from "./camera.js";

const TAU = Math.PI * 2;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

/* ------------------------------------------------------------
   Canvas textures
   ------------------------------------------------------------ */

function seeded(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function canvasTexture(width, height, draw) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  draw(ctx, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function fitFont(ctx, text, maxWidth, baseSize, family, weight) {
  let size = baseSize;
  do {
    ctx.font = `${weight} ${size}px ${family}`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 2;
  } while (size > 12);
  return size;
}

function textTexture(lines, {
  width = 1024,
  height = 512,
  color = "#f0d9a4",
  family = "Georgia, 'Times New Roman', serif",
  weight = "500",
  base = 94,
  lineGap = 1.2,
  background = null,
  align = "center",
  glow = null
} = {}) {
  const rows = Array.isArray(lines) ? lines : String(lines).split("\n");
  return canvasTexture(width, height, (ctx, w, h) => {
    if (background) {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.textAlign = align;
    ctx.textBaseline = "middle";
    const maxWidth = w - 72;
    let size = base;
    for (const row of rows) {
      size = Math.min(size, fitFont(ctx, row, maxWidth, base, family, weight));
    }
    const lineHeight = size * lineGap;
    const total = lineHeight * rows.length;
    let y = h / 2 - total / 2 + lineHeight / 2;
    rows.forEach((row) => {
      if (glow) {
        ctx.shadowColor = glow;
        ctx.shadowBlur = size * 0.5;
      }
      ctx.fillStyle = color;
      ctx.font = `${weight} ${size}px ${family}`;
      ctx.fillText(row, w / 2, y);
      ctx.shadowBlur = 0;
      y += lineHeight;
    });
  });
}

function textPlane(texture, width, height, { opacity = 1, color = 0xffffff, doubleSide = true } = {}) {
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity,
    color,
    depthWrite: false,
    side: doubleSide ? THREE.DoubleSide : THREE.FrontSide,
    toneMapped: false
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
  mesh.renderOrder = 3;
  return mesh;
}

function glowTexture() {
  return canvasTexture(256, 256, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.14, "rgba(255,242,214,0.8)");
    g.addColorStop(0.4, "rgba(255,210,145,0.22)");
    g.addColorStop(1, "rgba(255,210,145,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

function dotTexture() {
  return canvasTexture(64, 64, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, "rgba(255,250,235,1)");
    g.addColorStop(0.4, "rgba(255,235,190,0.55)");
    g.addColorStop(1, "rgba(255,235,190,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

function plasterTexture(base, seed, lineColor) {
  const rand = seeded(seed);
  return canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 360; i += 1) {
      const x = rand() * w;
      const y = rand() * h;
      const r = 10 + rand() * 90;
      const light = rand() > 0.48;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, light ? `rgba(255,236,205,${0.012 + rand() * 0.03})` : `rgba(16,9,6,${0.02 + rand() * 0.05})`);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 1.4;
    for (let x = 0; x <= w; x += 128) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y <= h; y += 170) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
  });
}

function floorTexture() {
  const rand = seeded(77);
  return canvasTexture(512, 512, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, "#2a1c17");
    g.addColorStop(0.5, "#1d1310");
    g.addColorStop(1, "#271a15");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 26; i += 1) {
      ctx.beginPath();
      let x = rand() * w;
      let y = rand() * h;
      ctx.moveTo(x, y);
      for (let j = 0; j < 5; j += 1) {
        x += (rand() - 0.5) * 130;
        y += (rand() - 0.5) * 130;
        ctx.lineTo(x, y);
      }
      ctx.strokeStyle = `rgba(201,164,92,${0.03 + rand() * 0.06})`;
      ctx.lineWidth = 0.6 + rand() * 1.2;
      ctx.stroke();
    }
    for (let i = 0; i < 90; i += 1) {
      ctx.fillStyle = `rgba(255,235,195,${0.03 + rand() * 0.1})`;
      ctx.fillRect(rand() * w, rand() * h, 1.4, 1.4);
    }
  });
}

function panelInsetTexture() {
  return canvasTexture(128, 256, (ctx, w, h) => {
    // A soft vertical falloff: the top of a recess catches less light,
    // the lower half picks up the warm floor bounce. Kept very low
    // contrast so it reads as architecture rather than a painted panel.
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "rgba(120,120,120,1)");
    g.addColorStop(0.55, "rgba(158,158,158,1)");
    g.addColorStop(1, "rgba(186,186,186,1)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    const edge = ctx.createLinearGradient(0, 0, w, 0);
    edge.addColorStop(0, "rgba(90,90,90,0.34)");
    edge.addColorStop(0.08, "rgba(120,120,120,0)");
    edge.addColorStop(0.92, "rgba(120,120,120,0)");
    edge.addColorStop(1, "rgba(90,90,90,0.34)");
    ctx.fillStyle = edge;
    ctx.fillRect(0, 0, w, h);

    const rand = seeded(431);
    for (let i = 0; i < 90; i += 1) {
      const x = rand() * w;
      const y = rand() * h;
      const r = 2 + rand() * 14;
      const glow = rand() > 0.5;
      const dot = ctx.createRadialGradient(x, y, 0, x, y, r);
      dot.addColorStop(0, glow ? "rgba(255,245,225,0.05)" : "rgba(20,12,8,0.055)");
      dot.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = dot;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
  });
}

function wallWashTexture() {
  return canvasTexture(512, 256, (ctx, w, h) => {
    // Warm light descending from a concealed ceiling cove. The bright
    // pools repeat gently along the hall so the wall never looks banded.
    const base = ctx.createLinearGradient(0, 0, 0, h);
    base.addColorStop(0, "rgba(255,214,160,0.95)");
    base.addColorStop(0.08, "rgba(255,206,150,0.62)");
    base.addColorStop(0.3, "rgba(248,188,128,0.24)");
    base.addColorStop(0.64, "rgba(226,166,108,0.07)");
    base.addColorStop(1, "rgba(226,166,108,0)");
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);

    [96, 256, 416].forEach((x) => {
      const pool = ctx.createRadialGradient(x, 16, 4, x, 16, 120);
      pool.addColorStop(0, "rgba(255,230,190,0.4)");
      pool.addColorStop(0.4, "rgba(255,214,164,0.12)");
      pool.addColorStop(1, "rgba(255,214,164,0)");
      ctx.fillStyle = pool;
      ctx.fillRect(x - 130, 0, 260, 230);
    });
  });
}

function floorEdgeTexture() {
  return canvasTexture(128, 32, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, "rgba(255,218,168,0.9)");
    g.addColorStop(0.18, "rgba(255,208,152,0.44)");
    g.addColorStop(0.55, "rgba(255,198,138,0.12)");
    g.addColorStop(1, "rgba(255,198,138,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

function placeholderPhotoTexture() {
  return canvasTexture(640, 820, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, "#6c4a3f");
    g.addColorStop(0.48, "#4b322b");
    g.addColorStop(1, "#2e201c");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    const glow = ctx.createRadialGradient(w * 0.4, h * 0.34, 0, w * 0.4, h * 0.34, w * 0.7);
    glow.addColorStop(0, "rgba(255,233,194,0.28)");
    glow.addColorStop(1, "rgba(255,233,194,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(240,217,164,0.4)";
    ctx.lineWidth = 3;
    ctx.strokeRect(26, 26, w - 52, h - 52);
    ctx.fillStyle = "rgba(248,240,228,0.85)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "italic 300 50px Georgia, serif";
    ctx.fillText("A frame", w / 2, h / 2 - 34);
    ctx.fillText("waiting for you", w / 2, h / 2 + 28);
    ctx.font = "400 18px Georgia, serif";
    ctx.fillStyle = "rgba(240,217,164,0.7)";
    ctx.fillText("ADD A PHOTOGRAPH", w / 2, h - 96);
  });
}

/* ------------------------------------------------------------
   Scene setup
   ------------------------------------------------------------ */

export function createMuseumScene({ content, reducedMotion = false, onSelect = null, onHover = null } = {}) {
  const canvas = document.getElementById("webgl");
  if (!canvas) throw new Error("No WebGL canvas found.");

  const probe = document.createElement("canvas");
  const probeGl = probe.getContext("webgl2") || probe.getContext("webgl");
  if (!probeGl) throw new Error("WebGL is not available.");

  const isMobile = window.matchMedia("(max-width: 760px)").matches;
  const ROMAN = ["I", "II", "III", "IV", "V", "VI"];

  // Adaptive quality starts high and only steps down after several
  // seconds of genuinely slow frames. Caps are per device class, but a
  // capable phone is never forced into the lowest tier up front.
  const qualityCaps = isMobile ? [0.8, 1.0, 1.25] : [1.0, 1.35, 2.0];
  const quality = {
    level: 2,
    lastNow: 0,
    sampleSeconds: 0,
    sampleFrames: 0,
    lastAverage: 16.7,
    badStreak: 0,
    goodStreak: 0,
    cooldownUntil: 0,
    raiseLockUntil: 0,
    loweredAt: 0
  };
  const devicePixelRatio = window.devicePixelRatio || 1;
  function capForQuality(level) {
    return Math.min(devicePixelRatio, qualityCaps[Math.max(0, Math.min(2, level))]);
  }

  let applyQualityExtras = () => {};

  function applyQuality(level) {
    const next = Math.max(0, Math.min(2, level));
    if (next === quality.level) {
      applyQualityExtras(next);
      return;
    }
    quality.level = next;
    renderer.setPixelRatio(capForQuality(next));
    renderer.setSize(window.innerWidth, window.innerHeight);
    applyQualityExtras(next);
    quality.lastAverage = 16.7;
    quality.badStreak = 0;
    quality.goodStreak = 0;
  }

  // Only a sustained trend changes quality. Two slow windows in a row
  // step down; a long, clearly comfortable stretch steps back up.
  function evaluateQuality(averageMs, now) {
    quality.lastAverage = averageMs;
    if (now < quality.cooldownUntil) return;

    if (averageMs > 22.5 && quality.level > 0) {
      quality.badStreak += 1;
      quality.goodStreak = 0;
      if (quality.badStreak >= 2) {
        if (now - quality.loweredAt < 20000) {
          quality.raiseLockUntil = now + 12000;
        }
        quality.loweredAt = now;
        applyQuality(quality.level - 1);
        quality.cooldownUntil = now + 6500;
      }
      return;
    }

    if (averageMs > 19.5) {
      quality.goodStreak = 0;
      if (averageMs <= 22.5) quality.badStreak = Math.max(0, quality.badStreak - 1);
      return;
    }

    quality.badStreak = 0;
    if (averageMs < 18.0 && quality.level < 2 && now >= quality.raiseLockUntil) {
      quality.goodStreak += 1;
      if (quality.goodStreak >= 6) {
        applyQuality(quality.level + 1);
        quality.cooldownUntil = now + 7000;
      }
    } else {
      quality.goodStreak = Math.max(0, quality.goodStreak - 1);
    }
  }

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !isMobile,
    alpha: false,
    powerPreference: "high-performance"
  });
  renderer.setPixelRatio(capForQuality(quality.level));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x120b09);
  scene.fog = new THREE.FogExp2(0x120b09, 0.0105);

  const camera = new THREE.PerspectiveCamera(isMobile ? 64 : 55, window.innerWidth / window.innerHeight, 0.1, 420);
  camera.position.set(0, 1.78, 14.5);
  const lookCurrent = new THREE.Vector3(0, 1.72, -2);
  camera.lookAt(lookCurrent);

  const hotspots = [];
  const labelAnchors = [];
  const frameCallbacks = new Set();
  let cakeControlsAnchor = null;
  const bobbers = [];
  const flames = [];
  const floaters = [];
  const petals = [];

  function addLabelAnchor(anchor) {
    if (!anchor?.key || !anchor.position) return;
    const entry = {
      key: anchor.key,
      room: anchor.room || null,
      kind: anchor.kind || "object",
      title: anchor.title || "",
      kicker: anchor.kicker || "",
      caption: anchor.caption || "",
      hint: anchor.hint || "",
      position: anchor.position.clone(),
      maxDistance: anchor.maxDistance || 16,
      priority: anchor.priority || 0,
      cluster: anchor.cluster || null,
      maxPerCluster: anchor.maxPerCluster || null,
      payload: anchor.payload || null,
      interactive: anchor.interactive !== false,
      edge: Boolean(anchor.edge),
      ttl: anchor.ttl || null
    };
    labelAnchors.push(entry);
    return entry;
  }

  const maxAnisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const loader = new THREE.TextureLoader();
  const placeholder = placeholderPhotoTexture();
  const glowTex = glowTexture();
  const dotTex = dotTexture();

  /* Materials */
  const gold = new THREE.MeshStandardMaterial({ color: 0xc9a45c, metalness: 0.82, roughness: 0.33, emissive: 0x3a2a10, emissiveIntensity: 0.4 });
  const goldBright = new THREE.MeshStandardMaterial({ color: 0xf0d9a4, metalness: 0.55, roughness: 0.28, emissive: 0x5a421a, emissiveIntensity: 0.7 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x3a2419, roughness: 0.66, metalness: 0.08 });
  const woodDark = new THREE.MeshStandardMaterial({ color: 0x241610, roughness: 0.8, metalness: 0.04 });
  const ivory = new THREE.MeshStandardMaterial({ color: 0xefe1cc, roughness: 0.62, metalness: 0.02 });
  const blush = new THREE.MeshStandardMaterial({ color: 0xd9a89f, roughness: 0.58, metalness: 0.04 });
  const rose = new THREE.MeshStandardMaterial({ color: 0xb57068, roughness: 0.55, metalness: 0.04 });
  const stone = new THREE.MeshStandardMaterial({ color: 0x2c1f1a, roughness: 0.9, metalness: 0.02 });

  const wallTexture = plasterTexture("#3a2a22", 12, "rgba(201,164,92,0.045)");
  wallTexture.wrapS = wallTexture.wrapT = THREE.RepeatWrapping;
  wallTexture.repeat.set(isMobile ? 12 : 22, 1.4);
  const wallMat = new THREE.MeshStandardMaterial({ map: wallTexture, color: 0xbfae9f, roughness: 0.94, metalness: 0.02 });

  const floorTex = floorTexture();
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
  floorTex.repeat.set(7, 52);
  const floorMat = new THREE.MeshStandardMaterial({ map: floorTex, color: 0x9c8478, roughness: 0.4, metalness: 0.42 });

  /* Helpers */
  function addBox(w, h, d, material, x, y, z, parent = scene) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }

  function addVisualSpot(x, y, z, target, {
    color = 0xffd39a,
    intensity = 150,
    distance = 30,
    angle = 0.58,
    penumbra = 0.85,
    decay = 1.55
  } = {}) {
    const light = new THREE.SpotLight(color, intensity, distance, angle, penumbra, decay);
    light.position.set(x, y, z);
    light.target.position.copy(target);
    scene.add(light);
    scene.add(light.target);
    return light;
  }

  function addPoint(x, y, z, color, intensity, distance = 18, decay = 1.7) {
    const light = new THREE.PointLight(color, intensity, distance, decay);
    light.position.set(x, y, z);
    scene.add(light);
    return light;
  }

  function addGlowSprite(x, y, z, scale, color = 0xffd9a0, opacity = 0.5) {
    const material = new THREE.SpriteMaterial({
      map: glowTex,
      color,
      transparent: true,
      opacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false
    });
    const sprite = new THREE.Sprite(material);
    sprite.position.set(x, y, z);
    sprite.scale.set(scale, scale, 1);
    scene.add(sprite);
    return sprite;
  }

  function selectable(mesh, payload) {
    mesh.userData.select = payload;
    hotspots.push(mesh);
    return mesh;
  }

  function photoMaterial(path, targetAspect = null) {
    const material = new THREE.MeshStandardMaterial({
      map: placeholder,
      color: 0xffffff,
      roughness: 0.46,
      metalness: 0.03,
      emissive: 0x2a1c13,
      emissiveIntensity: 0.3
    });
    if (path) {
      loader.load(
        path,
        (texture) => {
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.anisotropy = maxAnisotropy;
          // Cover-fit the photograph inside the frame instead of stretching
          // it. The full image still appears in the click-through modal.
          const image = texture.image;
          if (targetAspect && image?.width && image?.height) {
            const imageAspect = image.width / image.height;
            if (imageAspect < targetAspect) {
              texture.repeat.y = imageAspect / targetAspect;
              texture.offset.y = (1 - texture.repeat.y) / 2;
            } else if (imageAspect > targetAspect) {
              texture.repeat.x = targetAspect / imageAspect;
              texture.offset.x = (1 - texture.repeat.x) / 2;
            }
          }
          material.map = texture;
          material.emissiveIntensity = 0.12;
          material.needsUpdate = true;
        },
        undefined,
        () => {
          /* Keep the beautiful placeholder. */
        }
      );
    }
    return material;
  }

  function photoFrame({ path, title, width = 2.3, height = 3.1, roman = "", key = null, index = null }) {
    const group = new THREE.Group();
    const accent = new THREE.Mesh(
      new THREE.PlaneGeometry(width + 0.7, height + 0.7),
      new THREE.MeshStandardMaterial({ color: 0x40271f, roughness: 0.72, metalness: 0.1, emissive: 0x160b07, emissiveIntensity: 0.6 })
    );
    accent.position.z = -0.04;
    group.add(accent);

    const backing = addBox(width + 0.26, height + 0.26, 0.12, gold, 0, 0, -0.01, group);
    const photo = new THREE.Mesh(new THREE.PlaneGeometry(width, height), photoMaterial(path, width / height));
    photo.position.z = 0.065;
    group.add(photo);
    selectable(photo, { type: "photo", path, title, index, key });
    selectable(backing, { type: "photo", path, title, index, key });

    const trim = 0.075;
    addBox(width + 0.26, trim, 0.08, goldBright, 0, height / 2 + 0.09, 0.08, group);
    addBox(width + 0.26, trim, 0.08, goldBright, 0, -height / 2 - 0.09, 0.08, group);
    addBox(trim, height + 0.26, 0.08, goldBright, -width / 2 - 0.09, 0, 0.08, group);
    addBox(trim, height + 0.26, 0.08, goldBright, width / 2 + 0.09, 0, 0.08, group);

    if (title) {
      const label = textPlane(
        textTexture([roman, title], {
          width: 720,
          height: 220,
          color: "#d9bd85",
          base: 40,
          lineGap: 1.55
        }),
        2.1,
        0.64
      );
      label.position.set(0, -height / 2 - 0.48, 0.04);
      group.add(label);
    }

    return group;
  }

  /* ------------------------------------------------------------
     Architecture
     ------------------------------------------------------------ */

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(19, 282), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, -102);
  scene.add(floor);

  const carpetMat = new THREE.MeshStandardMaterial({ color: 0x421f1c, roughness: 0.88, metalness: 0.06, emissive: 0x190806, emissiveIntensity: 0.5 });
  const carpet = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 276), carpetMat);
  carpet.rotation.x = -Math.PI / 2;
  carpet.position.set(0, 0.012, -100);
  scene.add(carpet);

  const runnerMat = new THREE.MeshBasicMaterial({ color: 0x8a6a35, toneMapped: false });
  [-1.84, 1.84].forEach((x) => {
    const line = new THREE.Mesh(new THREE.PlaneGeometry(0.045, 276), runnerMat);
    line.rotation.x = -Math.PI / 2;
    line.position.set(x, 0.02, -100);
    scene.add(line);
  });

  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(19, 282),
    new THREE.MeshStandardMaterial({ color: 0x1a110e, roughness: 0.95, metalness: 0.02 })
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, 6.4, -102);
  scene.add(ceiling);

  const wallGeo = new THREE.PlaneGeometry(282, 6.4);
  const leftWall = new THREE.Mesh(wallGeo, wallMat);
  leftWall.rotation.y = Math.PI / 2;
  leftWall.position.set(-9.2, 3.2, -102);
  scene.add(leftWall);

  const rightWall = new THREE.Mesh(wallGeo, wallMat);
  rightWall.rotation.y = -Math.PI / 2;
  rightWall.position.set(9.2, 3.2, -102);
  scene.add(rightWall);

  // Wainscot + gold line
  [-9.06, 9.06].forEach((x) => {
    addBox(0.18, 1.7, 282, woodDark, x, 0.85, -102);
    addBox(0.08, 0.07, 282, gold, x > 0 ? x - 0.08 : x + 0.08, 1.74, -102);
  });

  // Pilasters and ceiling beams
  const pilasterStep = isMobile ? 22 : 15;
  for (let z = 28; z >= -230; z -= pilasterStep) {
    [-8.92, 8.92].forEach((x) => {
      addBox(0.55, 6.4, 0.55, stone, x, 3.2, z);
      addBox(0.78, 0.16, 0.78, gold, x, 6.05, z);
      addBox(0.72, 0.2, 0.72, woodDark, x, 0.18, z);
    });
    addBox(18.4, 0.26, 0.42, woodDark, 0, 6.18, z);
    addBox(18.4, 0.04, 0.5, gold, 0, 6.04, z);
  }

  // Gentle light near the entrance and along the hall
  addPoint(0, 4.5, 12, 0xffd9a8, 90, 20);
  addPoint(0, 4.2, -34, 0xffcfa0, 80, 24);
  addPoint(0, 4.2, -73, 0xffc79a, 70, 20);
  addPoint(-2, 4.5, -104, 0xffcf9e, 60, 22);
  addPoint(2, 4.5, -126, 0xffcf9e, 60, 22);
  addPoint(0, 3.2, -149, 0xffb978, 65, 14);
  addPoint(0, 4.5, -176, 0xffc47e, 90, 24);
  addPoint(0, 4.5, -212, 0xffd29a, 95, 24);

  /* ------------------------------------------------------------
     Architectural detail · wall panels, rails, warm cove light
     ------------------------------------------------------------ */
  // The paneling is built as instanced strips and inset planes: the
  // richer walls cost two draw calls no matter how many panels there
  // are. Nothing is placed in the walking path or over the artwork.

  const panelInsetTex = panelInsetTexture();
  const panelInsetMat = new THREE.MeshStandardMaterial({
    map: panelInsetTex,
    color: 0x5b4638,
    roughness: 0.96,
    metalness: 0.02,
    emissive: 0x120a06,
    emissiveIntensity: 0.22
  });
  const moldingMat = new THREE.MeshStandardMaterial({
    color: 0x8f6d36,
    roughness: 0.5,
    metalness: 0.62,
    emissive: 0x241606,
    emissiveIntensity: 0.34
  });

  const detailDummy = new THREE.Object3D();
  const trimMatrices = [];
  const insetMatrices = [];
  const insetTints = [];

  function pushTrim(x, y, z, sx, sy, sz) {
    detailDummy.position.set(x, y, z);
    detailDummy.rotation.set(0, 0, 0);
    detailDummy.scale.set(sx, sy, sz);
    detailDummy.updateMatrix();
    trimMatrices.push(detailDummy.matrix.clone());
  }

  function pushInset(x, y, z, width, height, rotationY, tint = 0xffffff) {
    detailDummy.position.set(x, y, z);
    detailDummy.rotation.set(0, rotationY, 0);
    detailDummy.scale.set(width, height, 1);
    detailDummy.updateMatrix();
    insetMatrices.push(detailDummy.matrix.clone());
    insetTints.push(tint);
  }

  // One panel outline plus its recessed face.
  function addWallPanel(side, z, width, height, y, tint, innerBorder = false) {
    const faceX = side * (9.2 - 0.062);
    pushTrim(faceX, y + height / 2, z, 0.07, 0.045, width);
    pushTrim(faceX, y - height / 2, z, 0.07, 0.045, width);
    pushTrim(faceX, y, z - width / 2, 0.07, height, 0.045);
    pushTrim(faceX, y, z + width / 2, 0.07, height, 0.045);
    pushInset(side * (9.2 - 0.016), y, z, width - 0.06, height - 0.06, side < 0 ? Math.PI / 2 : -Math.PI / 2, tint);

    if (innerBorder) {
      const insetW = width - 0.46;
      const insetH = height - 0.46;
      pushTrim(faceX, y + insetH / 2, z, 0.045, 0.025, insetW);
      pushTrim(faceX, y - insetH / 2, z, 0.045, 0.025, insetW);
      pushTrim(faceX, y, z - insetW / 2, 0.045, insetH, 0.025);
      pushTrim(faceX, y, z + insetW / 2, 0.045, insetH, 0.025);
    }
  }

  const wallBays = [];
  for (let z = 28 - pilasterStep; z >= -211; z -= pilasterStep) {
    wallBays.push(z - pilasterStep / 2);
  }

  wallBays.forEach((bayZ, bayIndex) => {
    // Leave the entrance bay calm and give the eye an occasional
    // untouched stretch instead of papering every metre of wall.
    if (bayZ > 11) return;

    [-1, 1].forEach((side) => {
      const pattern = (bayIndex + (side > 0 ? 1 : 0)) % 4;
      const span = pilasterStep;

      if (pattern === 3) {
        // A single vertical brass reveal: quiet spatial variation.
        pushTrim(side * (9.2 - 0.055), 3.55, bayZ, 0.055, 3.3, 0.035);
        return;
      }

      if (pattern === 2) {
        // Two stacked panels, smaller and more intimate.
        const width = span - 5.1;
        const tint = 0xd8c6b4;
        addWallPanel(side, bayZ, width, 1.35, 4.62, tint);
        addWallPanel(side, bayZ, width, 0.82, 2.98, 0xe0cebc);
        return;
      }

      if (pattern === 0) {
        // A pair of tall panels.
        const gap = 1.15;
        const width = (span - 4.5 - gap) / 2;
        [-1, 1].forEach((offset) => {
          addWallPanel(side, bayZ + offset * (width / 2 + gap / 2), width, 2.55, 3.7, 0xd4c1ae, offset > 0);
        });
        return;
      }

      // One generous panel per bay.
      addWallPanel(side, bayZ, span - 4.9, 2.55, 3.7, 0xdccab8, true);
    });
  });

  // Picture rail and a lower reveal tie the long walls together.
  [-1, 1].forEach((side) => {
    pushTrim(side * (9.2 - 0.055), 5.38, -102, 0.07, 0.045, 282);
    pushTrim(side * (9.2 - 0.055), 5.52, -102, 0.07, 0.022, 282);
    pushTrim(side * (9.2 - 0.055), 1.84, -102, 0.065, 0.028, 282);
  });

  // Two shallow panels behind the final wall keep the dance backdrop
  // related to the rest of the museum without adding clutter.
  [-4.35, 4.35].forEach((x, index) => {
    const zFace = -223.56;
    const width = 5.4;
    const height = 3.35;
    const y = 3.15;
    const faceZ = zFace + 0.03;
    pushTrim(x, y + height / 2, faceZ, width, 0.045, 0.07);
    pushTrim(x, y - height / 2, faceZ, width, 0.045, 0.07);
    pushTrim(x - width / 2, y, faceZ, 0.045, height, 0.07);
    pushTrim(x + width / 2, y, faceZ, 0.045, height, 0.07);
    pushInset(x, y, zFace, width - 0.06, height - 0.06, 0, index === 0 ? 0xd7c4b0 : 0xe2d0bc);
    if (index === 0) {
      pushTrim(x, y + 1.18, faceZ, width - 0.5, 0.022, 0.045);
      pushTrim(x, y - 1.18, faceZ, width - 0.5, 0.022, 0.045);
      pushTrim(x - width / 2 + 0.23, y, faceZ, 0.022, height - 0.5, 0.045);
      pushTrim(x + width / 2 - 0.23, y, faceZ, 0.022, height - 0.5, 0.045);
    }
  });
  pushTrim(0, 5.38, -223.56, 17.1, 0.05, 0.07);

  const trimMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    moldingMat,
    Math.max(1, trimMatrices.length)
  );
  trimMesh.count = trimMatrices.length;
  trimMatrices.forEach((matrix, index) => trimMesh.setMatrixAt(index, matrix));
  trimMesh.instanceMatrix.needsUpdate = true;
  trimMesh.frustumCulled = false;
  scene.add(trimMesh);

  const insetMesh = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(1, 1),
    panelInsetMat,
    Math.max(1, insetMatrices.length)
  );
  insetMesh.count = insetMatrices.length;
  const insetColor = new THREE.Color();
  insetMatrices.forEach((matrix, index) => {
    insetMesh.setMatrixAt(index, matrix);
    insetMesh.setColorAt(index, insetColor.setHex(insetTints[index]));
  });
  insetMesh.instanceMatrix.needsUpdate = true;
  if (insetMesh.instanceColor) insetMesh.instanceColor.needsUpdate = true;
  insetMesh.frustumCulled = false;
  scene.add(insetMesh);

  // Baked wall-wash planes. Additive light with no real lights added:
  // warm cove pools above, a soft floor reveal below.
  const wallWashTex = wallWashTexture();
  wallWashTex.wrapS = THREE.RepeatWrapping;
  const wallWashGroup = new THREE.Group();
  wallWashGroup.renderOrder = 1;
  [-1, 1].forEach((side) => {
    const map = wallWashTex.clone();
    map.needsUpdate = true;
    map.wrapS = THREE.RepeatWrapping;
    map.repeat.set(isMobile ? 4 : 7, 1);
    const material = new THREE.MeshBasicMaterial({
      map,
      color: 0xffd9a8,
      transparent: true,
      opacity: 0.3,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    const wash = new THREE.Mesh(new THREE.PlaneGeometry(282, 6.2), material);
    wash.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
    wash.position.set(side * (9.2 - 0.08), 3.2, -102);
    wallWashGroup.add(wash);
  });

  // A gentler wash on the final wall so the dancer has depth behind it.
  const finalWashMap = wallWashTex.clone();
  finalWashMap.needsUpdate = true;
  finalWashMap.wrapS = THREE.RepeatWrapping;
  finalWashMap.repeat.set(2, 1);
  const finalWash = new THREE.Mesh(
    new THREE.PlaneGeometry(17.4, 6.2),
    new THREE.MeshBasicMaterial({
      map: finalWashMap,
      color: 0xffd9a8,
      transparent: true,
      opacity: 0.24,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  finalWash.position.set(0, 3.15, -223.48);
  wallWashGroup.add(finalWash);
  scene.add(wallWashGroup);

  const edgeGlowTex = floorEdgeTexture();
  const edgeGlowGroup = new THREE.Group();
  edgeGlowGroup.renderOrder = 1;
  [-1, 1].forEach((side) => {
    const map = edgeGlowTex.clone();
    map.needsUpdate = true;
    if (side > 0) {
      map.repeat.x = -1;
      map.offset.x = 1;
    }
    const floorGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(2.6, 276),
      new THREE.MeshBasicMaterial({
        map,
        color: 0xffcf96,
        transparent: true,
        opacity: 0.4,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    floorGlow.rotation.x = -Math.PI / 2;
    floorGlow.position.set(side * 8.0, 0.018, -102);
    edgeGlowGroup.add(floorGlow);

    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(0.045, 0.045, 276),
      new THREE.MeshBasicMaterial({
        color: 0xffcf9a,
        transparent: true,
        opacity: 0.52,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false
      })
    );
    strip.position.set(side * 8.72, 0.075, -102);
    edgeGlowGroup.add(strip);
  });
  scene.add(edgeGlowGroup);

  /* ------------------------------------------------------------
     Entrance
     ------------------------------------------------------------ */

  const entrance = new THREE.Group();
  scene.add(entrance);

  const title = textPlane(
    textTexture(["THE GIOIA MUSEUM"], {
      width: 1600,
      height: 260,
      color: "#f6e6c2",
      base: 104,
      glow: "rgba(240,217,164,0.8)"
    }),
    9.2,
    1.5
  );
  title.position.set(0, 3.3, 6.4);
  entrance.add(title);

  const eyebrow = textPlane(
    textTexture(["A PRIVATE EXHIBITION · FOR ONE"], {
      width: 1000,
      height: 120,
      color: "#c9a45c",
      base: 42
    }),
    5.4,
    0.64
  );
  eyebrow.position.set(0, 4.25, 6.35);
  entrance.add(eyebrow);

  [-3.7, 3.7].forEach((x) => {
    addBox(0.62, 5.2, 0.72, woodDark, x, 2.6, 3.6, entrance);
    addBox(0.78, 0.18, 0.86, gold, x, 5.15, 3.6, entrance);
    addBox(0.82, 0.24, 0.9, gold, x, 0.14, 3.6, entrance);
  });
  addBox(8.0, 0.42, 0.72, woodDark, 0, 5.22, 3.6, entrance);
  addBox(8.0, 0.06, 0.78, gold, 0, 5.0, 3.62, entrance);

  const doors = new THREE.Group();
  entrance.add(doors);
  const leftDoor = new THREE.Group();
  leftDoor.position.set(-3.35, 2.45, 3.85);
  const leftPanel = addBox(3.2, 4.9, 0.18, wood, 1.6, 0, 0, leftDoor);
  addBox(2.2, 0.08, 0.2, gold, 1.6, 1.4, 0.06, leftDoor);
  addBox(2.2, 0.08, 0.2, gold, 1.6, -1.4, 0.06, leftDoor);
  const handleL = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 16), goldBright);
  handleL.position.set(2.9, 0, 0.16);
  leftDoor.add(handleL);
  doors.add(leftDoor);

  const rightDoor = new THREE.Group();
  rightDoor.position.set(3.35, 2.45, 3.85);
  const rightPanel = addBox(3.2, 4.9, 0.18, wood, -1.6, 0, 0, rightDoor);
  addBox(2.2, 0.08, 0.2, gold, -1.6, 1.4, 0.06, rightDoor);
  addBox(2.2, 0.08, 0.2, gold, -1.6, -1.4, 0.06, rightDoor);
  const handleR = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 16), goldBright);
  handleR.position.set(-2.9, 0, 0.16);
  rightDoor.add(handleR);
  doors.add(rightDoor);

  selectable(leftPanel, { type: "entrance" });
  selectable(rightPanel, { type: "entrance" });

  addVisualSpot(0, 5.8, 9, new THREE.Vector3(0, 2.4, 4.2), { intensity: 190, distance: 24, angle: 0.52 });
  addGlowSprite(0, 2.8, 4.3, 6.5, 0xffd39a, 0.28);

  /* ------------------------------------------------------------
     I · The Gallery of Her
     ------------------------------------------------------------ */

  const galleryPhotos = (content.gallery?.photos || []).slice(0, 4);
  const frameSlots = [
    { x: -3.5, z: -23, rot: 0.36 },
    { x: 3.5, z: -31, rot: -0.36 },
    { x: -3.3, z: -39, rot: 0.32 },
    { x: 3.3, z: -47, rot: -0.32 }
  ];

  const galleryTitle = textPlane(
    textTexture(["I · THE GALLERY OF HER"], {
      width: 1500,
      height: 220,
      color: "#d9bd85",
      base: 78
    }),
    7.4,
    1.1
  );
  galleryTitle.position.set(0, 4.55, -18.2);
  scene.add(galleryTitle);
  addGlowSprite(0, 4.5, -18.4, 5.2, 0xffd9a0, 0.16);

  addLabelAnchor({
    key: "room-gallery",
    room: "gallery",
    kind: "room",
    title: content.gallery?.section?.title || "The Gallery of Her",
    kicker: content.gallery?.section?.label || "Exhibit 01",
    caption: content.gallery?.section?.lede || "",
    hint: "",
    position: new THREE.Vector3(0, 4.55, -18.2),
    maxDistance: 24,
    priority: 100,
    interactive: false,
    ttl: 6500
  });

  galleryPhotos.forEach((photo, index) => {
    const slot = frameSlots[index] || frameSlots[frameSlots.length - 1];
    const frame = photoFrame({
      path: photo.image,
      title: photo.title,
      roman: ["I", "II", "III", "IV"][index] || "",
      width: 2.15,
      height: 2.9,
      key: `photo-${index}`,
      index
    });
    frame.position.set(slot.x, 2.16, slot.z);
    frame.rotation.y = slot.rot;
    scene.add(frame);

    addLabelAnchor({
      key: `photo-${index}`,
      room: "gallery",
      cluster: "gallery",
      kind: "object",
      title: photo.title || `Photograph ${index + 1}`,
      kicker: `Frame ${ROMAN[index] || index + 1}`,
      caption: photo.caption || "",
      hint: "Open photograph",
      position: new THREE.Vector3(slot.x, 3.82, slot.z + 0.28),
      payload: { type: "photo", index, path: photo.image, key: `photo-${index}` },
      maxDistance: 18,
      priority: 10
    });

    addVisualSpot(slot.x * 0.55, 5.95, slot.z + 2.6, new THREE.Vector3(slot.x, 2.1, slot.z), {
      intensity: 120,
      distance: 22,
      angle: 0.42,
      penumbra: 0.9
    });
    addGlowSprite(slot.x, 2.2, slot.z + 0.12, 3.4, 0xffd8a2, 0.12);
  });

  // A bench in the middle of the gallery
  const bench = new THREE.Group();
  addBox(3.2, 0.18, 0.8, wood, 0, 0.55, 0, bench);
  addBox(0.16, 0.55, 0.7, woodDark, -1.35, 0.27, 0, bench);
  addBox(0.16, 0.55, 0.7, woodDark, 1.35, 0.27, 0, bench);
  bench.position.set(0, 0, -33.5);
  scene.add(bench);

  /* ------------------------------------------------------------
     II · Little Things
     ------------------------------------------------------------ */

  const favoriteItems = (content.favorites?.items || []).slice(0, 4);
  const pedestalSlots = [
    { x: -2.6, z: -71.5 },
    { x: 2.6, z: -71.5 },
    { x: -2.6, z: -76.5 },
    { x: 2.6, z: -76.5 }
  ];

  const favoritesTitle = textPlane(
    textTexture(["II · LITTLE THINGS ABOUT YOU"], {
      width: 1600,
      height: 220,
      color: "#d9bd85",
      base: 74
    }),
    7.8,
    1.08
  );
  favoritesTitle.position.set(0, 4.6, -67.2);
  scene.add(favoritesTitle);
  addGlowSprite(0, 4.5, -67.4, 5.2, 0xffd9a0, 0.15);

  addLabelAnchor({
    key: "room-favorites",
    room: "favorites",
    kind: "room",
    title: content.favorites?.section?.title || "Little Things About You",
    kicker: content.favorites?.section?.label || "Exhibit 02",
    caption: content.favorites?.section?.lede || "",
    hint: "",
    position: new THREE.Vector3(0, 4.6, -67.2),
    maxDistance: 22,
    priority: 100,
    interactive: false,
    ttl: 6500
  });

  function buildFries() {
    const group = new THREE.Group();
    const carton = new THREE.MeshStandardMaterial({ color: 0xb03a30, roughness: 0.58, metalness: 0.05 });
    addBox(0.62, 0.86, 0.45, carton, 0, 0.43, 0, group);
    addBox(0.68, 0.16, 0.5, goldBright, 0, 0.82, 0, group);
    addBox(0.4, 0.24, 0.46, ivory, 0, 0.5, 0.001, group);
    const fryMat = new THREE.MeshStandardMaterial({ color: 0xf2c15e, roughness: 0.5, metalness: 0.03, emissive: 0x6b3d08, emissiveIntensity: 0.5 });
    for (let i = 0; i < 9; i += 1) {
      const fry = addBox(0.075, 0.7 + Math.random() * 0.18, 0.075, fryMat, 0, 1.1, 0, group);
      fry.position.x = (Math.random() - 0.5) * 0.42;
      fry.position.z = (Math.random() - 0.5) * 0.28;
      fry.rotation.z = (Math.random() - 0.5) * 0.5;
      fry.rotation.x = (Math.random() - 0.5) * 0.35;
    }
    return group;
  }

  function buildShrimp() {
    const group = new THREE.Group();
    const shrimpMat = new THREE.MeshStandardMaterial({ color: 0xe08a72, roughness: 0.4, metalness: 0.08, emissive: 0x5c1e11, emissiveIntensity: 0.4 });
    const body = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.145, 16, 40, Math.PI * 1.45), shrimpMat);
    body.rotation.x = Math.PI / 2;
    body.rotation.z = 0.55;
    body.position.y = 0.42;
    group.add(body);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.35, 12), shrimpMat);
    tail.position.set(0.36, 0.3, 0.15);
    tail.rotation.z = -1.05;
    group.add(tail);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x24100c });
    [-0.06, 0.06].forEach((x) => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 8), eyeMat);
      eye.position.set(x, 0.4, 0.34);
      group.add(eye);
    });
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.56, 0.06, 32), ivory);
    plate.position.y = 0.03;
    group.add(plate);
    return group;
  }

  function buildChips() {
    const group = new THREE.Group();
    const bagMat = new THREE.MeshStandardMaterial({ color: 0xd8a83f, roughness: 0.32, metalness: 0.35, emissive: 0x4a2c05, emissiveIntensity: 0.4 });
    const bag = new THREE.Mesh(new THREE.SphereGeometry(0.46, 24, 24), bagMat);
    bag.scale.set(0.8, 1.05, 0.42);
    bag.position.y = 0.6;
    group.add(bag);
    const label = textPlane(
      textTexture(["OISHI"], {
        width: 420,
        height: 240,
        color: "#7d2f20",
        base: 108
      }),
      0.46,
      0.26
    );
    label.position.set(0, 0.66, 0.2);
    group.add(label);
    const crimp = new THREE.Mesh(new THREE.CylinderGeometry(0.37, 0.37, 0.1, 16), bagMat);
    crimp.scale.z = 0.55;
    crimp.position.y = 1.05;
    group.add(crimp);
    return group;
  }

  function buildPasta() {
    const group = new THREE.Group();
    const bowlMat = new THREE.MeshStandardMaterial({ color: 0xefe1cc, roughness: 0.45, metalness: 0.08, emissive: 0x3a2b16, emissiveIntensity: 0.2 });
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.46, 0.24, 32), bowlMat);
    bowl.position.y = 0.12;
    group.add(bowl);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.05, 10, 40), goldBright);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.24;
    group.add(rim);
    const pastaMat = new THREE.MeshStandardMaterial({ color: 0xe8c97a, roughness: 0.55, metalness: 0.04, emissive: 0x5a3a08, emissiveIntensity: 0.35 });
    for (let i = 0; i < 12; i += 1) {
      const strand = new THREE.Mesh(new THREE.TorusGeometry(0.3 + Math.random() * 0.12, 0.035, 8, 24, Math.PI * 1.6), pastaMat);
      strand.position.set((Math.random() - 0.5) * 0.5, 0.28 + Math.random() * 0.06, (Math.random() - 0.5) * 0.5);
      strand.rotation.set(Math.random() * 0.6, Math.random() * TAU, Math.random() * 0.6);
      group.add(strand);
    }
    const sauce = new THREE.Mesh(new THREE.SphereGeometry(0.34, 18, 18), new THREE.MeshStandardMaterial({ color: 0xb5523a, roughness: 0.4, metalness: 0.05, emissive: 0x4a140a, emissiveIntensity: 0.35 }));
    sauce.scale.set(1, 0.35, 1);
    sauce.position.y = 0.26;
    group.add(sauce);
    const leaf = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.12), new THREE.MeshStandardMaterial({ color: 0x4a7a3a, roughness: 0.5, side: THREE.DoubleSide, emissive: 0x1a3a12, emissiveIntensity: 0.25 }));
    leaf.position.set(0.15, 0.3, 0.1);
    leaf.rotation.set(-0.4, 0.3, 0.2);
    group.add(leaf);
    return group;
  }

  const foodBuilders = [buildFries, buildShrimp, buildChips, buildPasta];

  favoriteItems.forEach((item, index) => {
    const slot = pedestalSlots[index] || pedestalSlots[0];
    const pedestal = new THREE.Group();
    pedestal.position.set(slot.x, 0, slot.z);
    scene.add(pedestal);

    const plinth = addBox(1.7, 1.15, 1.7, stone, 0, 0.575, 0, pedestal);
    addBox(1.86, 0.11, 1.86, gold, 0, 1.17, 0, pedestal);
    addBox(1.46, 0.24, 1.46, woodDark, 0, 0.15, 0, pedestal);
    addBox(1.2, 0.02, 1.2, goldBright, 0, 1.235, 0, pedestal);

    const label = textPlane(
      textTexture([item.label || "", item.name || ""], {
        width: 720,
        height: 240,
        color: "#e3ca95",
        base: 44,
        lineGap: 1.5
      }),
      1.55,
      0.52
    );
    label.position.set(0, 0.82, 0.861);
    pedestal.add(label);

    const food = (foodBuilders[index] || buildChips)();
    food.position.y = 1.28;
    pedestal.add(food);

    const hit = new THREE.Mesh(
      new THREE.BoxGeometry(1.9, 2.1, 1.9),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
    );
    hit.position.y = 1.05;
    pedestal.add(hit);
    selectable(hit, { type: "favorite", index, key: `favorite-${index}` });
    selectable(plinth, { type: "favorite", index, key: `favorite-${index}` });

    addLabelAnchor({
      key: `favorite-${index}`,
      room: "favorites",
      cluster: "favorites",
      kind: "object",
      title: item.name || `Favorite ${index + 1}`,
      kicker: item.label || "Little things",
      caption: item.note || "",
      hint: "Open the display",
      position: new THREE.Vector3(slot.x, 2.95, slot.z),
      payload: { type: "favorite", index, key: `favorite-${index}` },
      maxDistance: 16,
      priority: 12
    });

    addVisualSpot(slot.x * 0.4, 5.6, slot.z + 2.4, new THREE.Vector3(slot.x, 1.6, slot.z), {
      intensity: 130,
      distance: 18,
      angle: 0.35,
      penumbra: 0.9
    });

    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(1.05, 2.5, 32, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xffd9a0,
        transparent: true,
        opacity: 0.045,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false
      })
    );
    cone.position.set(0, 3.1, 0);
    pedestal.add(cone);
  });

  /* ------------------------------------------------------------
     III · The Memory Hall
     ------------------------------------------------------------ */

  const memories = (content.memories?.memories || []).slice(0, 4);
  const archZ = [-88, -101, -114, -127, -140];

  const memoryTitle = textPlane(
    textTexture(["III · THE MEMORY HALL"], {
      width: 1400,
      height: 220,
      color: "#d9bd85",
      base: 78
    }),
    7,
    1.1
  );
  memoryTitle.position.set(0, 4.55, -89.6);
  scene.add(memoryTitle);

  addLabelAnchor({
    key: "room-memories",
    room: "memories",
    kind: "room",
    title: content.memories?.section?.title || "The Memory Hall",
    kicker: content.memories?.section?.label || "Exhibit 03",
    caption: content.memories?.section?.lede || "",
    hint: "",
    position: new THREE.Vector3(0, 4.55, -89.6),
    maxDistance: 24,
    priority: 100,
    interactive: false,
    ttl: 6500
  });

  archZ.forEach((z, archIndex) => {
    const arch = new THREE.Group();
    [-5.5, 5.5].forEach((x) => {
      addBox(0.55, 4.5, 0.55, stone, x, 2.25, 0, arch);
      addBox(0.75, 0.16, 0.75, gold, x, 4.42, 0, arch);
      addBox(0.7, 0.22, 0.7, woodDark, x, 0.12, 0, arch);
    });
    addBox(11.55, 0.32, 0.55, woodDark, 0, 4.5, 0, arch);
    addBox(11.6, 0.05, 0.6, gold, 0, 4.3, 0, arch);
    arch.position.z = z;
    scene.add(arch);

    if (archIndex % 2 === 0) {
      addGlowSprite(0, 4.35, z, 3.2, 0xffd9a0, 0.12);
    }
  });

  const memorySlots = [
    { x: -5.0, z: -96, rot: 1.05 },
    { x: 5.0, z: -106, rot: -1.05 },
    { x: -5.0, z: -117, rot: 1.05 },
    { x: 5.0, z: -129, rot: -1.05 }
  ];

  memories.forEach((memory, index) => {
    const slot = memorySlots[index] || memorySlots[memorySlots.length - 1];
    const group = new THREE.Group();
    group.position.set(slot.x, 2.25, slot.z);
    group.rotation.y = slot.rot;
    scene.add(group);

    const back = addBox(3.1, 4.2, 0.16, woodDark, 0, 0, -0.18, group);
    selectable(back, { type: "memory", index, key: `memory-${index}` });
    const photo = new THREE.Mesh(new THREE.PlaneGeometry(2.25, 2.95), photoMaterial(memory.image, 2.25 / 2.95));
    photo.position.z = 0.02;
    group.add(photo);
    selectable(photo, { type: "memory", index, key: `memory-${index}` });

    addLabelAnchor({
      key: `memory-${index}`,
      room: "memories",
      cluster: "memories",
      kind: "object",
      title: memory.title || `Memory ${index + 1}`,
      kicker: memory.date || "Memory",
      caption: memory.caption || "",
      hint: "Open the memory",
      position: new THREE.Vector3(slot.x * 0.92, 4.3, slot.z),
      payload: { type: "memory", index, key: `memory-${index}` },
      maxDistance: 20,
      priority: 12,
      edge: true
    });

    const trimMat = goldBright;
    addBox(2.5, 0.07, 0.1, trimMat, 0, 1.56, 0.06, group);
    addBox(2.5, 0.07, 0.1, trimMat, 0, -1.56, 0.06, group);
    addBox(0.07, 3.1, 0.1, trimMat, -1.2, 0, 0.06, group);
    addBox(0.07, 3.1, 0.1, trimMat, 1.2, 0, 0.06, group);

    addVisualSpot(slot.x * 0.5, 5.4, slot.z + 1.8, new THREE.Vector3(slot.x, 2.3, slot.z), {
      intensity: 105,
      distance: 20,
      angle: 0.44,
      penumbra: 0.95
    });
  });

  [-93, -105, -117, -129, -141].forEach((z) => {
    const cord = addBox(0.02, 1.15, 0.02, gold, 0, 5.75, z);
    cord.material = new THREE.MeshBasicMaterial({ color: 0x6b5228 });
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0xffe3ad, toneMapped: false })
    );
    bulb.position.set(0, 5.1, z);
    scene.add(bulb);
    addGlowSprite(0, 5.1, z, 1.5, 0xffd9a0, 0.55);
  });

  // Soft light pools on the wall behind the gallery and memory pieces.
  // One instanced additive mesh: a single extra draw call.
  const wallPoolSpots = [
    ...frameSlots.map((slot) => ({ x: slot.x, z: slot.z, y: 3.35, w: 7.2, h: 4.6 })),
    ...memorySlots.map((slot) => ({ x: slot.x, z: slot.z, y: 2.9, w: 8.4, h: 5.4 }))
  ];
  const wallPoolMesh = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({
      map: glowTex,
      color: 0xffd2a0,
      transparent: true,
      opacity: 0.2,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    }),
    Math.max(1, wallPoolSpots.length)
  );
  wallPoolMesh.count = wallPoolSpots.length;
  wallPoolSpots.forEach((spot, index) => {
    detailDummy.position.set(Math.sign(spot.x) * (9.2 - 0.05), spot.y, spot.z);
    detailDummy.rotation.set(0, spot.x < 0 ? Math.PI / 2 : -Math.PI / 2, 0);
    detailDummy.scale.set(spot.w, spot.h, 1);
    detailDummy.updateMatrix();
    wallPoolMesh.setMatrixAt(index, detailDummy.matrix);
  });
  wallPoolMesh.instanceMatrix.needsUpdate = true;
  wallPoolMesh.frustumCulled = false;
  scene.add(wallPoolMesh);

  /* ------------------------------------------------------------
     IV · Letters for You
     ------------------------------------------------------------ */

  const letters = (content.letters?.letters || []).slice(0, 10);
  const paper = new THREE.MeshStandardMaterial({ color: 0xf1e2c8, roughness: 0.86, metalness: 0.01, emissive: 0x3a2b16, emissiveIntensity: 0.28 });
  const wax = new THREE.MeshStandardMaterial({ color: 0x9d5a51, roughness: 0.38, metalness: 0.12, emissive: 0x3a120e, emissiveIntensity: 0.4 });

  const lettersTitle = textPlane(
    textTexture(["IV · LETTERS FOR YOU"], {
      width: 1400,
      height: 220,
      color: "#d9bd85",
      base: 78
    }),
    7,
    1.1
  );
  lettersTitle.position.set(0, 4.25, -153.6);
  scene.add(lettersTitle);

  addLabelAnchor({
    key: "room-letters",
    room: "letters",
    kind: "room",
    title: content.letters?.section?.title || "Letters for You",
    kicker: content.letters?.section?.label || "Exhibit 04",
    caption: content.letters?.section?.lede || "",
    hint: "",
    position: new THREE.Vector3(0, 4.25, -153.6),
    maxDistance: 22,
    priority: 100,
    interactive: false,
    ttl: 6500
  });
  addGlowSprite(0, 4.2, -153.8, 4.4, 0xffd9a0, 0.14);

  const desk = new THREE.Group();
  // The top is pitched back a few degrees so the surface faces the camera
  // and the letters resting on it are easier to read from the walkway.
  const DESK_TILT = 0.13;
  const deskSurface = new THREE.Group();
  deskSurface.position.set(0, 1.02, 0);
  deskSurface.rotation.x = DESK_TILT;
  desk.add(deskSurface);
  addBox(4.6, 0.16, 1.8, wood, 0, 0, 0, deskSurface);
  addBox(0.18, 1.0, 1.5, woodDark, -2.1, 0.5, 0, desk);
  addBox(0.18, 1.0, 1.5, woodDark, 2.1, 0.5, 0, desk);
  addBox(4.3, 0.08, 1.55, gold, 0, -0.1, 0, deskSurface);
  desk.position.set(0, 0, -149.6);
  scene.add(desk);

  function makeEnvelope() {
    const group = new THREE.Group();
    const body = addBox(0.94, 0.07, 0.62, paper, 0, 0, 0, group);
    const seal = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.035, 20), wax);
    seal.position.set(0, 0.05, 0.16);
    group.add(seal);
    const foldLine = addBox(0.94, 0.075, 0.02, gold, 0, 0.004, 0.31, group);
    foldLine.material = new THREE.MeshStandardMaterial({ color: 0xb08a45, metalness: 0.5, roughness: 0.4 });
    return { group, body };
  }

  letters.forEach((letter, index) => {
    // The first five letters sit on the desk; the rest float around the
    // room. Each 3D envelope opens its own letter, so all ten are unique.
    const floatingIndex = index - 5;
    const isFloating = floatingIndex >= 0;
    const slot = isFloating ? floatingIndex : index;
    const env = makeEnvelope();
    let labelPosition;

    if (isFloating) {
      const x = slot % 2 === 0 ? -2.2 - (slot % 3) * 0.25 : 2.2 + (slot % 3) * 0.25;
      const y = 2.35 + (slot % 3) * 0.36;
      const z = -147.2 - slot * 0.85;
      env.group.position.set(x, y, z);
      env.group.rotation.set(-0.35, slot % 2 === 0 ? 0.5 : -0.5, 0.08);
      env.group.scale.setScalar(0.9);
      labelPosition = new THREE.Vector3(x, y + 0.42, z);
      scene.add(env.group);
    } else {
      const x = -1.75 + slot * 0.88;
      const z = 0.05 + (slot % 2 === 0 ? 0.12 : -0.12);
      env.group.position.set(x, 0.12, z);
      env.group.rotation.y = (slot % 2 === 0 ? -1 : 1) * 0.12;
      deskSurface.add(env.group);
      env.group.updateWorldMatrix(true, false);
      labelPosition = env.group
        .getWorldPosition(new THREE.Vector3())
        .add(new THREE.Vector3(0, 0.52, 0));
    }

    const payload = { type: "letter", index, key: `letter-${index}` };
    selectable(env.body, payload);

    if (isFloating) {
      floaters.push({ group: env.group, baseY: env.group.position.y, phase: slot * 1.7 });
    }

    addLabelAnchor({
      key: `letter-${index}`,
      room: "letters",
      cluster: "letters",
      kind: "object",
      title: letter.seal || letter.title || `Letter ${index + 1}`,
      kicker: `Letter ${String(index + 1).padStart(2, "0")}`,
      caption: letter.title || "",
      hint: "Open the letter",
      position: labelPosition,
      payload,
      maxDistance: isFloating ? 16 : 12,
      priority: 14
    });
  });

  const lampLocalZ = -0.55;
  const lampSurfaceY = 1.02 + 0.08 * Math.cos(DESK_TILT) - lampLocalZ * Math.sin(DESK_TILT);
  const lampLift = lampSurfaceY + 0.03 - 1.13;
  const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 0.06, 20), gold);
  lampBase.position.set(-1.75, 1.13 + lampLift, -150.15);
  scene.add(lampBase);
  const lampStem = addBox(0.035, 0.7, 0.035, gold, -1.75, 1.48 + lampLift, -150.15);
  lampStem.material = gold;
  const lampShade = new THREE.Mesh(
    new THREE.ConeGeometry(0.32, 0.35, 24, 1, true),
    new THREE.MeshStandardMaterial({ color: 0xe8c3a0, roughness: 0.7, side: THREE.DoubleSide, emissive: 0x6a3a10, emissiveIntensity: 0.25 })
  );
  lampShade.position.set(-1.75, 1.85 + lampLift, -150.15);
  lampShade.rotation.x = Math.PI;
  scene.add(lampShade);
  const lampGlow = addGlowSprite(-1.75, 1.72 + lampLift, -150.15, 1.7, 0xffbb78, 0.7);
  lampGlow.userData.pulse = true;
  const lampLight = addPoint(-1.75, 1.72 + lampLift, -150.15, 0xffb768, 36, 8, 1.8);

  /* ------------------------------------------------------------
     V · The Celebration Room
     ------------------------------------------------------------ */

  const celebrationTitle = textPlane(
    textTexture(["V · THE CELEBRATION ROOM"], {
      width: 1600,
      height: 220,
      color: "#d9bd85",
      base: 74
    }),
    7.8,
    1.08
  );
  celebrationTitle.position.set(0, 4.55, -168.4);
  scene.add(celebrationTitle);
  addGlowSprite(0, 4.4, -168.6, 5.6, 0xffd9a0, 0.16);

  const cakeTable = new THREE.Group();
  cakeTable.position.set(0, 0, -176);
  scene.add(cakeTable);

  const tableTop = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.9, 0.14, 40), wood);
  tableTop.position.y = 0.98;
  cakeTable.add(tableTop);
  const tableStem = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.62, 0.92, 24), woodDark);
  tableStem.position.y = 0.47;
  cakeTable.add(tableStem);
  const tableBase = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.35, 0.1, 32), woodDark);
  tableBase.position.y = 0.05;
  cakeTable.add(tableBase);
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(2.02, 2.02, 0.06, 48), gold);
  plate.position.y = 1.06;
  cakeTable.add(plate);

  const tiers = [
    { radius: 1.02, height: 0.4, y: 1.28, material: ivory },
    { radius: 0.8, height: 0.36, y: 1.66, material: blush },
    { radius: 0.56, height: 0.32, y: 2.0, material: ivory }
  ];
  tiers.forEach((tier, index) => {
    const layer = new THREE.Mesh(new THREE.CylinderGeometry(tier.radius, tier.radius, tier.height, 40), tier.material);
    layer.position.y = tier.y;
    cakeTable.add(layer);
    selectable(layer, { type: "cake", key: "cake" });
    const frosting = new THREE.Mesh(new THREE.TorusGeometry(tier.radius - 0.015, 0.045, 10, 40), index === 1 ? rose : goldBright);
    frosting.rotation.x = Math.PI / 2;
    frosting.position.y = tier.y + tier.height / 2;
    cakeTable.add(frosting);
  });

  const candleMat = new THREE.MeshStandardMaterial({ color: 0xf4e4c8, roughness: 0.6, emissive: 0x4a3418, emissiveIntensity: 0.4 });
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xffc46b, transparent: true, opacity: 0.95, toneMapped: false });
  for (let i = 0; i < 5; i += 1) {
    const angle = (i / 5) * TAU;
    const x = Math.cos(angle) * 0.35;
    const z = Math.sin(angle) * 0.35;
    const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.034, 0.32, 10), candleMat);
    candle.position.set(x, 2.3, z);
    cakeTable.add(candle);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.19, 8), flameMat.clone());
    flame.position.set(x, 2.55, z);
    flame.userData.phase = i * 1.3;
    cakeTable.add(flame);
    flames.push(flame);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex,
      color: 0xffb060,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false
    }));
    halo.position.set(x, 2.56, z);
    halo.scale.set(0.5, 0.5, 1);
    cakeTable.add(halo);
    flame.userData.halo = halo;
  }

  const candleLight = addPoint(0, 2.75, -176, 0xffa95e, 55, 9, 1.9);
  addGlowSprite(0, 2.5, -176, 4.5, 0xffb570, 0.3);

  cakeControlsAnchor = new THREE.Vector3(0, 1.05, -174.2);

  addLabelAnchor({
    key: "cake",
    room: "celebration",
    cluster: "celebration",
    kind: "object",
    title: "The Birthday Cake",
    kicker: "Five candles",
    caption: content.surprises?.cake?.title || "Make a wish, Love.",
    hint: "Select the cake",
    position: new THREE.Vector3(0, 3.05, -176),
    payload: { type: "cake", key: "cake" },
    maxDistance: 15,
    priority: 20
  });

  addLabelAnchor({
    key: "gift",
    room: "celebration",
    cluster: "celebration",
    kind: "object",
    title: "A Little Gift",
    kicker: "For you",
    caption: "There's something inside.",
    hint: "Open the gift",
    position: new THREE.Vector3(1.52, 1.95, -174.9),
    payload: { type: "gift", key: "gift" },
    maxDistance: 12,
    priority: 18
  });

  addLabelAnchor({
    key: "headline-celebration",
    room: "celebration",
    kind: "headline",
    title: "Happy Birthday, Love",
    kicker: "The Celebration Room",
    caption: content.unlock?.heading ? "Make a wish." : "",
    hint: "",
    position: new THREE.Vector3(0, 4.45, -176),
    maxDistance: 16,
    priority: 100,
    interactive: false,
    ttl: 8000
  });

  selectable(tableTop, { type: "cake", key: "cake" });
  selectable(plate, { type: "cake", key: "cake" });

  // Balloons
  const balloonColors = [0xe8c3bd, 0xc88f86, 0xd8b570, 0xefe1cc, 0xb57068];
  const balloonPositions = [
    [-4.2, 3.0, -170.5],
    [4.3, 2.8, -172.5],
    [-4.8, 3.8, -178.5],
    [4.6, 4.1, -180.5],
    [-3.6, 4.5, -184.5],
    [3.4, 4.8, -186.5],
    [-5.2, 2.5, -187]
  ];
  balloonPositions.forEach((position, index) => {
    const balloon = new THREE.Group();
    const material = new THREE.MeshStandardMaterial({
      color: balloonColors[index % balloonColors.length],
      roughness: 0.34,
      metalness: 0.14,
      emissive: balloonColors[index % balloonColors.length],
      emissiveIntensity: 0.14
    });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 24), material);
    body.scale.set(1, 1.22, 1);
    balloon.add(body);
    const knot = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.16, 10), material);
    knot.position.y = -0.56;
    knot.rotation.x = Math.PI;
    balloon.add(knot);
    const stringGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, -0.64, 0),
      new THREE.Vector3((index % 2 ? 1 : -1) * 0.16, -2.9, 0.05)
    ]);
    const string = new THREE.Line(stringGeometry, new THREE.LineBasicMaterial({ color: 0xc9a45c, transparent: true, opacity: 0.28 }));
    balloon.add(string);
    balloon.position.set(position[0], position[1], position[2]);
    scene.add(balloon);
    bobbers.push({ group: balloon, baseY: position[1], phase: index * 0.9, sway: 0.06 });
  });

  function buildGift(size, bodyColor, ribbonColor) {
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.48, metalness: 0.1, emissive: bodyColor, emissiveIntensity: 0.1 });
    const ribbonMat = new THREE.MeshStandardMaterial({ color: ribbonColor, roughness: 0.3, metalness: 0.55, emissive: ribbonColor, emissiveIntensity: 0.24 });
    addBox(size, size * 0.85, size, bodyMat, 0, size * 0.425, 0, group);
    addBox(size * 0.16, size * 0.87, size * 1.02, ribbonMat, 0, size * 0.425, 0, group);
    addBox(size * 1.02, size * 0.87, size * 0.16, ribbonMat, 0, size * 0.425, 0, group);
    const bow = new THREE.Mesh(new THREE.TorusGeometry(size * 0.17, size * 0.035, 8, 20), ribbonMat);
    bow.rotation.x = Math.PI / 2;
    bow.position.y = size * 0.87;
    group.add(bow);
    return group;
  }

  const tableGift = buildGift(0.52, 0xb57068, 0xf0d9a4);
  tableGift.position.set(1.52, 1.1, -174.9);
  cakeTable.add(tableGift);
  tableGift.traverse((child) => {
    if (child.isMesh) selectable(child, { type: "gift", key: "gift" });
  });
  addGlowSprite(1.52, 1.55, -174.9, 1.9, 0xffd9a0, 0.3);

  const floorGift = buildGift(0.9, 0x9d5a51, 0xf0d9a4);
  floorGift.position.set(3.9, 0, -181.5);
  floorGift.rotation.y = -0.4;
  scene.add(floorGift);
  floorGift.traverse((child) => {
    if (child.isMesh) selectable(child, { type: "gift", key: "gift" });
  });

  const floorGiftTwo = buildGift(0.72, 0xc9a45c, 0x9d5a51);
  floorGiftTwo.position.set(-4.1, 0, -184.5);
  floorGiftTwo.rotation.y = 0.5;
  scene.add(floorGiftTwo);
  floorGiftTwo.traverse((child) => {
    if (child.isMesh) selectable(child, { type: "gift", key: "gift" });
  });

  /* ------------------------------------------------------------
     VI · The Final Room
     ------------------------------------------------------------ */

  const finalWall = new THREE.Mesh(
    new THREE.PlaneGeometry(17.5, 6.4),
    new THREE.MeshStandardMaterial({ color: 0x2b1b16, roughness: 0.82, metalness: 0.06, emissive: 0x170a06, emissiveIntensity: 0.55 })
  );
  finalWall.position.set(0, 3.2, -223.6);
  scene.add(finalWall);

  [-5.9, 5.9].forEach((x) => {
    addBox(0.7, 6.4, 0.7, stone, x, 3.2, -215.5);
    addBox(0.92, 0.18, 0.92, gold, x, 6.08, -215.5);
    addBox(0.86, 0.26, 0.86, woodDark, x, 0.16, -215.5);
  });

  const heartShape = new THREE.Shape();
  heartShape.moveTo(0, 0.35);
  heartShape.bezierCurveTo(0, 0.78, -0.5, 1.12, -0.9, 0.66);
  heartShape.bezierCurveTo(-1.34, 0.14, -0.7, -0.5, 0, -1.12);
  heartShape.bezierCurveTo(0.7, -0.5, 1.34, 0.14, 0.9, 0.66);
  heartShape.bezierCurveTo(0.5, 1.12, 0, 0.78, 0, 0.35);
  const heartGeometry = new THREE.ExtrudeGeometry(heartShape, { depth: 0.16, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 4, curveSegments: 24 });
  heartGeometry.center();
  const heartMaterial = new THREE.MeshStandardMaterial({ color: 0xd59486, metalness: 0.42, roughness: 0.28, emissive: 0x7a2f26, emissiveIntensity: 0.7 });
  const heart = new THREE.Mesh(heartGeometry, heartMaterial);
  heart.position.set(0, 3.1, -219.4);
  heart.scale.setScalar(1.45);
  scene.add(heart);
  const heartGlowWide = addGlowSprite(0, 3.1, -220.1, 9, 0xffb98f, 0.45);
  const heartGlowCore = addGlowSprite(0, 3.1, -219.7, 4.2, 0xffd9a0, 0.4);

  const halo = new THREE.Mesh(new THREE.TorusGeometry(2.15, 0.028, 8, 96), new THREE.MeshBasicMaterial({ color: 0xf0d9a4, transparent: true, opacity: 0.7, toneMapped: false }));
  halo.position.set(0, 3.1, -219.75);
  scene.add(halo);
  bobbers.push({ group: halo, baseY: 3.1, phase: 0.4, sway: 0.02 });

  const finalHeading = textPlane(
    textTexture(["HAPPY BIRTHDAY, LOVE"], {
      width: 1600,
      height: 220,
      color: "#f6e6c2",
      base: 88,
      glow: "rgba(240,217,164,0.8)"
    }),
    10.2,
    1.4
  );
  finalHeading.position.set(0, 5.2, -223.2);
  scene.add(finalHeading);

  const finalSub = textPlane(
    textTexture(["I love you. Always."], {
      width: 1000,
      height: 150,
      color: "#d9bd85",
      base: 58
    }),
    4.6,
    0.68
  );
  finalSub.position.set(0, 1.35, -223.2);
  scene.add(finalSub);

  // Hidden surprise attraction, revealed by "One Last Surprise".
  const surpriseGroup = new THREE.Group();
  surpriseGroup.position.set(4.6, 0, -219.2);
  surpriseGroup.visible = false;
  surpriseGroup.scale.setScalar(0.001);
  scene.add(surpriseGroup);

  // --- Stylised dancer -------------------------------------------------
  // Soft capsule limbs pivoted at the shoulder and hip, a rounded torso
  // and a larger head read as one designed character instead of a pile
  // of boxes. Everything shares three small materials.
  const surpriseBodyMat = new THREE.MeshStandardMaterial({
    color: 0x8b67ad,
    roughness: 0.46,
    metalness: 0.08,
    emissive: 0x2a1838,
    emissiveIntensity: 0.42
  });
  const surpriseHeadMat = new THREE.MeshStandardMaterial({
    color: 0xd8c4ea,
    roughness: 0.52,
    metalness: 0.04,
    emissive: 0x2a1a38,
    emissiveIntensity: 0.32
  });
  const surpriseTrimMat = new THREE.MeshStandardMaterial({
    color: 0xf0d9a4,
    roughness: 0.32,
    metalness: 0.55,
    emissive: 0x4a3410,
    emissiveIntensity: 0.5,
    side: THREE.DoubleSide
  });
  const surpriseShoeMat = new THREE.MeshStandardMaterial({
    color: 0x4a305e,
    roughness: 0.44,
    metalness: 0.12,
    emissive: 0x180c22,
    emissiveIntensity: 0.36
  });

  // Rounded torso / belly.
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.42, 8, 24), surpriseBodyMat);
  torso.position.set(0, 1.32, 0);
  torso.scale.set(1, 1, 0.74);
  surpriseGroup.add(torso);

  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.31, 22, 18), surpriseBodyMat);
  belly.position.set(0, 1.08, 0.13);
  belly.scale.set(1.12, 0.86, 0.72);
  surpriseGroup.add(belly);

  // A soft collar where the neck meets the body.
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.145, 0.028, 6, 24), surpriseTrimMat);
  collar.rotation.x = Math.PI / 2;
  collar.position.set(0, 1.9, 0);
  surpriseGroup.add(collar);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.12, 0.2, 16), surpriseHeadMat);
  neck.position.set(0, 1.92, 0);
  surpriseGroup.add(neck);

  // Head group so the portrait face turns with the head.
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 2.2, 0);
  surpriseGroup.add(headGroup);

  const surpriseHead = new THREE.Mesh(new THREE.SphereGeometry(0.47, 32, 26), surpriseHeadMat);
  headGroup.add(surpriseHead);

  // A rounded-rectangle portrait, projected onto the head so it hugs
  // the skull instead of hovering like a flat sticker. The gold
  // backplate is the same curved panel, slightly larger, so only a
  // neat border shows around the photograph.
  const FACE_W = 0.47;
  const FACE_H = 0.626;
  const HEAD_R = 0.47;

  const roundedFaceMask = canvasTexture(256, 342, (ctx, w, h) => {
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, w, h);
    const r = 38;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(w - r, 0);
    ctx.quadraticCurveTo(w, 0, w, r);
    ctx.lineTo(w, h - r);
    ctx.quadraticCurveTo(w, h, w - r, h);
    ctx.lineTo(r, h);
    ctx.quadraticCurveTo(0, h, 0, h - r);
    ctx.lineTo(0, r);
    ctx.quadraticCurveTo(0, 0, r, 0);
    ctx.closePath();
    ctx.fill();
  });
  roundedFaceMask.wrapS = roundedFaceMask.wrapT = THREE.ClampToEdgeWrapping;

  function curvedPanelGeometry(width, height, lift) {
    // A subdivided panel keeps the surface on the outside of the
    // sphere; a shape with only border vertices would chord through it.
    const geometry = new THREE.PlaneGeometry(width, height, 22, 30);
    const position = geometry.attributes.position;
    for (let i = 0; i < position.count; i += 1) {
      const x = position.getX(i);
      const y = position.getY(i);
      const z = Math.sqrt(Math.max(0.0001, HEAD_R * HEAD_R - x * x - y * y)) + lift;
      position.setZ(i, z);
    }
    position.needsUpdate = true;
    geometry.computeVertexNormals();
    return geometry;
  }

  const faceTexture = placeholderPhotoTexture();
  const faceMaterial = new THREE.MeshStandardMaterial({
    map: faceTexture,
    alphaMap: roundedFaceMask,
    color: 0xffffff,
    roughness: 0.52,
    metalness: 0.02,
    emissive: 0x1a1018,
    emissiveIntensity: 0.18,
    transparent: true,
    alphaTest: 0.08,
    side: THREE.DoubleSide
  });
  const face = new THREE.Mesh(curvedPanelGeometry(FACE_W, FACE_H, 0.02), faceMaterial);
  face.position.set(0, 0, 0);
  face.renderOrder = 2;
  headGroup.add(face);

  const faceFrameMat = new THREE.MeshStandardMaterial({
    color: 0xf0d9a4,
    roughness: 0.32,
    metalness: 0.58,
    emissive: 0x4a3410,
    emissiveIntensity: 0.55,
    alphaMap: roundedFaceMask,
    transparent: true,
    alphaTest: 0.08,
    side: THREE.DoubleSide
  });
  const faceFrame = new THREE.Mesh(curvedPanelGeometry(FACE_W + 0.075, FACE_H + 0.075, 0.012), faceFrameMat);
  faceFrame.position.set(0, 0, 0);
  faceFrame.renderOrder = 1;
  headGroup.add(faceFrame);

  const faceLoader = new THREE.TextureLoader();
  faceLoader.load("assets/images/surprise/surprise-head.jpg", (texture) => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const image = texture.image;
    if (image?.width && image?.height) {
      const aspect = image.width / image.height;
      const target = FACE_W / FACE_H;
      if (aspect < target) {
        texture.repeat.y = aspect / target;
        texture.offset.y = (1 - texture.repeat.y) / 2;
      } else if (aspect > target) {
        texture.repeat.x = target / aspect;
        texture.offset.x = (1 - texture.repeat.x) / 2;
      }
    }
    faceMaterial.map = texture;
    faceMaterial.needsUpdate = true;
  });

  // A shoulder / hip pivot makes swinging limbs stay connected.
  function makeLimbPivot(x, y, radius, length, material, cap = true) {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    surpriseGroup.add(pivot);

    if (cap) {
      const joint = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.28, 16, 12), material);
      pivot.add(joint);
    }

    const limb = new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 6, 16), material);
    limb.position.y = -(length / 2 + radius);
    pivot.add(limb);
    return pivot;
  }

  const armL = makeLimbPivot(-0.355, 1.62, 0.082, 0.4, surpriseBodyMat);
  const armR = makeLimbPivot(0.355, 1.62, 0.082, 0.4, surpriseBodyMat);
  const handL = new THREE.Mesh(new THREE.SphereGeometry(0.105, 14, 12), surpriseHeadMat);
  handL.position.y = -0.57;
  armL.add(handL);
  const handR = new THREE.Mesh(new THREE.SphereGeometry(0.105, 14, 12), surpriseHeadMat);
  handR.position.y = -0.57;
  armR.add(handR);

  const legL = makeLimbPivot(-0.175, 0.78, 0.095, 0.38, surpriseBodyMat);
  const legR = makeLimbPivot(0.175, 0.78, 0.095, 0.38, surpriseBodyMat);
  [legL, legR].forEach((leg) => {
    const shoe = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), surpriseShoeMat);
    shoe.position.set(0, -0.61, 0.055);
    shoe.scale.set(1, 0.58, 1.42);
    leg.add(shoe);
  });

  // Arm rest pose: slightly away from the body.
  armL.rotation.z = -0.18;
  armR.rotation.z = 0.18;
  legL.rotation.z = 0.04;
  legR.rotation.z = -0.04;

  // --- Party dressing: floating laugh captions and an overhead beam ---
  // Six lightweight sprites share small canvas textures. They live inside
  // the surprise group so they reveal, scale and hide with the dancer.
  const laughWords = [
    { text: "HAHAHA", color: 0xffc9dc, x: -0.82, y: 2.42, z: 0.42, width: 0.62, rotation: -0.14, phase: 0.0 },
    { text: "HA!", color: 0xffe3ae, x: 0.82, y: 2.52, z: 0.3, width: 0.44, rotation: 0.12, phase: 1.4 },
    { text: "LOL", color: 0xc9ecff, x: -0.82, y: 1.0, z: 0.5, width: 0.5, rotation: 0.1, phase: 2.1 },
    { text: "hehe", color: 0xe0ccff, x: 0.82, y: 0.95, z: 0.5, width: 0.52, rotation: -0.1, phase: 3.0 },
    { text: "♪", color: 0xfff0c4, x: 0.96, y: 1.7, z: 0.32, width: 0.3, rotation: 0.22, phase: 4.2 },
    { text: "!!", color: 0xffb8c9, x: -0.96, y: 1.66, z: 0.32, width: 0.32, rotation: -0.2, phase: 5.1 }
  ];

  function laughTexture(text) {
    return canvasTexture(320, 160, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const size = text.length > 4 ? 74 : 104;
      ctx.font = `900 ${size}px Jost, Arial, sans-serif`;
      ctx.lineJoin = "round";
      ctx.lineWidth = 16;
      ctx.strokeStyle = "rgba(26,10,20,0.9)";
      ctx.strokeText(text, w / 2, h / 2 + 4);
      ctx.fillStyle = "#ffffff";
      ctx.fillText(text, w / 2, h / 2 + 4);
    });
  }

  const laughGroup = new THREE.Group();
  laughGroup.visible = false;
  surpriseGroup.add(laughGroup);

  const laughSprites = laughWords.map((word) => {
    const material = new THREE.SpriteMaterial({
      map: laughTexture(word.text),
      color: word.color,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      toneMapped: false
    });
    material.rotation = word.rotation;
    const sprite = new THREE.Sprite(material);
    sprite.position.set(word.x, word.y, word.z);
    sprite.scale.set(word.width, word.width * 0.5, 1);
    sprite.renderOrder = 4;
    sprite.userData = { ...word, baseX: word.x, baseY: word.y, baseZ: word.z, height: word.width * 0.5 };
    laughGroup.add(sprite);
    return sprite;
  });

  // A warm, soft-edged beam from above. Two open cone shells plus a floor
  // pool sell the light with three basic transparent draw calls and no
  // extra real-time light or shadow.
  const danceSpot = new THREE.Group();
  danceSpot.position.set(4.6, 0, -219.2);
  danceSpot.visible = false;
  scene.add(danceSpot);

  const spotShaftTex = canvasTexture(64, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "rgba(255,244,214,0)");
    g.addColorStop(0.24, "rgba(255,244,214,0.72)");
    g.addColorStop(0.72, "rgba(255,236,190,0.3)");
    g.addColorStop(1, "rgba(255,236,190,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });

  function shaftMaterial() {
    return new THREE.MeshBasicMaterial({
      map: spotShaftTex,
      color: 0xffe9c4,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      toneMapped: false
    });
  }

  const shaftOuter = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 1.42, 6.2, 22, 1, true), shaftMaterial());
  shaftOuter.position.y = 3.12;
  shaftOuter.renderOrder = 2;
  danceSpot.add(shaftOuter);

  const shaftInner = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.98, 6.1, 22, 1, true), shaftMaterial());
  shaftInner.position.y = 3.08;
  shaftInner.renderOrder = 2;
  danceSpot.add(shaftInner);

  const spotPool = new THREE.Mesh(
    new THREE.CircleGeometry(1.55, 28),
    new THREE.MeshBasicMaterial({
      map: glowTex,
      color: 0xffe6b8,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false
    })
  );
  spotPool.rotation.x = -Math.PI / 2;
  spotPool.position.y = 0.025;
  spotPool.renderOrder = 2;
  danceSpot.add(spotPool);

  const surpriseLight = addVisualSpot(4.6, 6.0, -215, new THREE.Vector3(4.6, 2.0, -219.2), { intensity: 160, distance: 20, angle: 0.45, penumbra: 0.9, color: 0xffd39a });
  addGlowSprite(4.6, 2.05, -219.9, 3.4, 0xffd0a0, 0.2);
  addGlowSprite(4.6, 1.75, -218.85, 2.3, 0xffe0b0, 0.12);


  let surpriseMode = false;
  let surpriseDancing = false;
  let surpriseTime = 0;
  let danceShake = 0;
  let danceFx = 0;

  const finalRoomDecor = [finalHeading, finalSub, heart, halo, heartGlowWide, heartGlowCore];
  function setFinalRoomDecor(visible) {
    finalRoomDecor.forEach((object) => {
      object.visible = visible;
    });
  }

  function revealSurprise() {
    surpriseGroup.visible = true;
    surpriseMode = true;
    surpriseDancing = true;
    surpriseTime = 0;
    surpriseGroup.position.set(4.6, 0, -219.2);
    // Give the dancer a clean backdrop: the old 3D greeting and the
    // heart stay in the room, but they step out of the composition.
    setFinalRoomDecor(false);
  }

  function setSurpriseDancing(value) {
    surpriseDancing = Boolean(value);
  }

  function resetSurprise() {
    surpriseMode = false;
    surpriseDancing = false;
    danceShake = 0;
    danceFx = 0;
    danceSpot.visible = false;
    laughGroup.visible = false;
    surpriseGroup.visible = false;
    surpriseGroup.scale.setScalar(0.001);
    surpriseGroup.position.set(4.6, 0, -219.2);
    surpriseGroup.rotation.set(0, 0, 0);
    headGroup.rotation.set(0, 0, 0);
    armL.rotation.set(0, 0, -0.18);
    armR.rotation.set(0, 0, 0.18);
    legL.rotation.set(0, 0, 0.04);
    legR.rotation.set(0, 0, -0.04);
    setFinalRoomDecor(true);
  }

  // Store on scene for external access.
  scene.userData.surprise = { revealSurprise, resetSurprise, group: surpriseGroup };

  addVisualSpot(0, 6.1, -207, new THREE.Vector3(0, 3.1, -220), { intensity: 220, distance: 28, angle: 0.4, penumbra: 0.9 });
  addGlowSprite(0, 5.2, -222.9, 7, 0xffd9a0, 0.18);

  /* ------------------------------------------------------------
     Floating lantern sculptures (magical atmosphere)
     ------------------------------------------------------------ */
  // One shared silhouette: a wide, softly rounded body that tapers
  // into a slim rounded crown. The profile is lathed once, then
  // drawn with instancing per colour family so the whole collection
  // costs only a handful of draw calls.
  const LANTERN_H = 1.33;
  const LANTERN_W = 0.94;
  const lanternProfile = [
    [0.000, 0.000],
    [0.170, 0.030],
    [0.290, 0.090],
    [0.375, 0.170],
    [0.430, 0.270],
    [0.462, 0.400],
    [0.470, 0.550],
    [0.462, 0.720],
    [0.438, 0.880],
    [0.392, 1.020],
    [0.325, 1.130],
    [0.238, 1.220],
    [0.140, 1.290],
    [0.000, 1.330]
  ].map(([radius, y]) => new THREE.Vector2(Math.max(0.0001, radius), y - LANTERN_H / 2));

  const lanternGeometry = new THREE.LatheGeometry(lanternProfile, isMobile ? 16 : 26);

  // Neutral white halo texture so each family can tint it cleanly.
  const lanternGlowTex = canvasTexture(128, 128, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, "rgba(255,255,255,0.95)");
    g.addColorStop(0.24, "rgba(255,255,255,0.42)");
    g.addColorStop(0.58, "rgba(255,255,255,0.11)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });

  const lanternFamilies = [
    { base: 0xd7c2ff, halo: 0xc9aaff, aspect: 0.66 },
    { base: 0xffcfe6, halo: 0xffb6da, aspect: 0.7 },
    { base: 0xc6f2ff, halo: 0xa9e7ff, aspect: 0.62 },
    { base: 0xe4d8ff, halo: 0xd2bfff, aspect: 0.74 },
    { base: 0xffdcf0, halo: 0xffc4e2, aspect: 0.68 },
    { base: 0xa9ffd8, halo: 0x8dffc4, aspect: 0.52, accent: true }
  ];
  lanternFamilies.forEach((family, index) => {
    const hsl = { h: 0, s: 0, l: 0 };
    new THREE.Color(family.base).getHSL(hsl);
    family.hue = hsl.h;
    family.sat = hsl.s;
    family.light = hsl.l;
    family.core = new THREE.Color().setHSL(hsl.h, hsl.s * 0.3, Math.min(1, hsl.l + 0.12));
    family.pulse = index * 1.37;
  });

  const lanternSeeds = seeded(9173);
  const lanternDummy = new THREE.Object3D();
  const lanternList = [];
  const lanternCount = isMobile ? 26 : 48;
  const accentEvery = Math.max(1, Math.floor(lanternCount / (isMobile ? 2 : 4)));
  const lanternZFrom = 7;
  const lanternZTo = -220;
  const lanternZSpan = lanternZFrom - lanternZTo;

  for (let i = 0; i < lanternCount; i += 1) {
    const accent = lanternCount > 8 && i > 2 && i % accentEvery === 3;
    const familyIndex = accent ? lanternFamilies.length - 1 : Math.floor(lanternSeeds() * 5) % 5;
    const family = lanternFamilies[familyIndex];

    // Layered depth: alternating sides, biased toward the aisle but
    // never close enough to sit in front of a frame (|x| ≥ 4.55).
    const side = i % 2 === 0 ? 1 : -1;
    const depthSeed = lanternSeeds();
    const x = side * (4.55 + depthSeed * depthSeed * 3.3);
    const z = lanternZFrom - lanternZSpan * ((i + 0.15 + lanternSeeds() * 0.7) / lanternCount);

    // The memory boards are taller than the painting frames, so that
    // hall keeps the lanterns higher still.
    const memoryHall = z < -92 && z > -134;

    // Generous size variation: a few oversized hero lanterns, a
    // majority of medium ones, and small green accent points.
    const hero = !accent && lanternSeeds() > 0.8;
    const baseHeight = accent
      ? 0.24 + lanternSeeds() * 0.16
      : hero
        ? 1.4 + lanternSeeds() * 0.25
        : 0.72 + lanternSeeds() * 0.5;
    const height = memoryHall ? Math.min(baseHeight, 1.3) : baseHeight;
    const aspect = family.aspect * (0.92 + lanternSeeds() * 0.16);
    const width = height * aspect;

    // Hang high in the room, always clear of the frames below
    // (painting tops sit below y = 4.0, memory boards below y = 4.35).
    const bottom = accent
      ? 5.05 + lanternSeeds() * 0.5
      : (memoryHall ? 4.6 : 4.3) + lanternSeeds() * 0.2;
    let y = bottom + height / 2;
    // Keep the crown just below the ceiling beams so nothing clips.
    if (y + height / 2 > 6.0) y = 6.0 - height / 2;

    const haloOpacity = accent ? 0.18 : 0.07 + lanternSeeds() * 0.04;
    const haloMaterial = new THREE.SpriteMaterial({
      map: lanternGlowTex,
      color: family.halo,
      transparent: true,
      opacity: haloOpacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false
    });
    const halo = new THREE.Sprite(haloMaterial);
    halo.position.set(x, y, z);
    const haloSize = width * 1.9 + 0.3;
    halo.scale.set(haloSize, haloSize, 1);
    scene.add(halo);

    lanternList.push({
      x,
      z,
      baseY: y,
      height,
      scaleY: height / LANTERN_H,
      scaleX: width / LANTERN_W,
      phase: lanternSeeds() * Math.PI * 2,
      swayPhase: lanternSeeds() * Math.PI * 2,
      speed: 0.16 + lanternSeeds() * 0.24,
      familyIndex,
      halo,
      haloOpacity,
      floorIndex: i
    });
  }

  // Suspension strings: one merged line segment per lantern.
  const stringPositions = new Float32Array(lanternList.length * 6);
  lanternList.forEach((item, index) => {
    const offset = index * 6;
    stringPositions[offset] = item.x;
    stringPositions[offset + 1] = item.baseY + item.height * 0.5;
    stringPositions[offset + 2] = item.z;
    stringPositions[offset + 3] = item.x;
    stringPositions[offset + 4] = 6.35;
    stringPositions[offset + 5] = item.z;
  });
  const stringGeometry = new THREE.BufferGeometry();
  stringGeometry.setAttribute("position", new THREE.BufferAttribute(stringPositions, 3));
  const lanternStrings = new THREE.LineSegments(
    stringGeometry,
    new THREE.LineBasicMaterial({ color: 0xd8c7b4, transparent: true, opacity: 0.15, depthWrite: false })
  );
  lanternStrings.frustumCulled = false;
  scene.add(lanternStrings);

  // Faint pools of lantern light on the floor. One instanced additive
  // plane for the whole collection: a single extra draw call, no real
  // lights, and it makes the polished floor feel lit from above.
  const lanternFloorDummy = new THREE.Object3D();
  const lanternFloorMesh = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({
      map: lanternGlowTex,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false
    }),
    lanternList.length
  );
  const lanternFloorTint = new THREE.Color();
  lanternList.forEach((item, index) => {
    const family = lanternFamilies[item.familyIndex];
    lanternFloorTint.setHex(family.halo).multiplyScalar(family.accent ? 0.12 : 0.2);
    lanternFloorMesh.setColorAt(index, lanternFloorTint);
    lanternFloorDummy.position.set(item.x, 0.028, item.z + 0.18);
    lanternFloorDummy.rotation.set(-Math.PI / 2, 0, 0);
    lanternFloorDummy.scale.set(item.scaleX * LANTERN_W * 2.4, item.scaleX * LANTERN_W * 4.1, 1);
    lanternFloorDummy.updateMatrix();
    lanternFloorMesh.setMatrixAt(index, lanternFloorDummy.matrix);
  });
  lanternFloorMesh.instanceMatrix.needsUpdate = true;
  if (lanternFloorMesh.instanceColor) lanternFloorMesh.instanceColor.needsUpdate = true;
  lanternFloorMesh.frustumCulled = false;
  scene.add(lanternFloorMesh);

  // Group the lanterns by colour family and build one instanced mesh
  // per family (6 draw calls total at most).
  const lanternGroups = lanternFamilies.map((family) => ({ family, items: [] }));
  lanternList.forEach((item) => lanternGroups[item.familyIndex].items.push(item));

  // Two additive passes per family: a frosted outer shell whose edge
  // melts into the air, and a smaller, whiter inner volume that reads
  // as the light source suspended inside it. Still only leaves and
  // instanced meshes, so the cost stays tiny.
  const lanternVertexShader = `
    varying vec3 vNormalW;
    varying vec3 vViewDirW;
    varying float vCrown;

    void main() {
      vec3 objectNormal = vec3(normal);
      vec4 worldPosition = vec4(position, 1.0);

      #ifdef USE_INSTANCING
        objectNormal = mat3(instanceMatrix) * objectNormal;
        worldPosition = instanceMatrix * worldPosition;
      #endif

      worldPosition = modelMatrix * worldPosition;
      vNormalW = normalize(mat3(modelMatrix) * objectNormal);
      vViewDirW = normalize(cameraPosition - worldPosition.xyz);
      vCrown = uv.y;
      gl_Position = projectionMatrix * viewMatrix * worldPosition;
    }
  `;

  const lanternFragmentShader = `
    uniform vec3 uTint;
    uniform vec3 uCore;
    uniform float uAlpha;
    uniform float uGlow;
    varying vec3 vNormalW;
    varying vec3 vViewDirW;
    varying float vCrown;

    void main() {
      vec3 n = normalize(vNormalW);
      vec3 v = normalize(vViewDirW);
      float facing = clamp(dot(n, v), 0.0, 1.0);

      // The silhouette fades almost entirely into the air.
      float falloff = smoothstep(0.0, 0.46, facing);
      // Light diffusing outward from the heart of the lantern.
      float inner = pow(facing, 1.7);

      vec3 color = mix(uTint, uCore, inner * 0.9);
      float alpha = uAlpha * (0.06 + 0.94 * falloff);
      alpha += 0.03 * (1.0 - facing);

      // Delicate fade at the base and crown so neither end reads
      // as a hard edge.
      float crown = smoothstep(0.0, 0.38, vCrown) * (1.0 - 0.42 * smoothstep(0.84, 1.0, vCrown));
      alpha *= crown * uGlow;

      gl_FragColor = vec4(color, alpha);
    }
  `;

  function lanternMaterial(tint, core, alpha) {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTint: { value: tint.clone() },
        uCore: { value: core.clone() },
        uAlpha: { value: alpha },
        uGlow: { value: 1 }
      },
      vertexShader: lanternVertexShader,
      fragmentShader: lanternFragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.FrontSide
    });
  }

  const CORE_SCALE = 0.56;

  lanternGroups.forEach(({ family, items }) => {
    if (!items.length) return;
    const tint = new THREE.Color(family.base);
    const coreTint = family.core.clone();
    const hot = new THREE.Color().setHSL(family.hue, family.sat * 0.14, 0.98);

    const shellMaterial = lanternMaterial(tint, coreTint, family.accent ? 0.44 : 0.48);
    const coreMaterial = lanternMaterial(coreTint, hot, family.accent ? 0.54 : 0.58);

    const mesh = new THREE.InstancedMesh(lanternGeometry, shellMaterial, items.length);
    const coreMesh = new THREE.InstancedMesh(lanternGeometry, coreMaterial, items.length);
    [mesh, coreMesh].forEach((entry) => {
      entry.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      entry.frustumCulled = false;
    });

    items.forEach((item, index) => {
      item.mesh = mesh;
      item.coreMesh = coreMesh;
      item.index = index;

      lanternDummy.position.set(item.x, item.baseY, item.z);
      lanternDummy.scale.set(item.scaleX, item.scaleY, item.scaleX);
      lanternDummy.updateMatrix();
      mesh.setMatrixAt(index, lanternDummy.matrix);

      lanternDummy.scale.set(item.scaleX * CORE_SCALE, item.scaleY * CORE_SCALE, item.scaleX * CORE_SCALE);
      lanternDummy.updateMatrix();
      coreMesh.setMatrixAt(index, lanternDummy.matrix);
    });

    mesh.instanceMatrix.needsUpdate = true;
    coreMesh.instanceMatrix.needsUpdate = true;
    scene.add(mesh);
    scene.add(coreMesh);
    family.material = shellMaterial;
    family.coreMaterial = coreMaterial;
  });

  /* ------------------------------------------------------------
     Atmosphere · dust and petals
     ------------------------------------------------------------ */

  const dustCount = isMobile ? 120 : 430;
  const dustGeometry = new THREE.BufferGeometry();
  const dustPositions = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i += 1) {
    dustPositions[i * 3] = (Math.random() - 0.5) * 16;
    dustPositions[i * 3 + 1] = 0.3 + Math.random() * 5.4;
    dustPositions[i * 3 + 2] = 24 - Math.random() * 252;
  }
  dustGeometry.setAttribute("position", new THREE.BufferAttribute(dustPositions, 3));
  const dust = new THREE.Points(dustGeometry, new THREE.PointsMaterial({
    size: 0.055,
    map: dotTex,
    color: 0xffe3b5,
    transparent: true,
    opacity: 0.52,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true
  }));
  scene.add(dust);

  const petalCount = isMobile ? 30 : 100;
  const petalGeometry = new THREE.BufferGeometry();
  const petalPositions = new Float32Array(petalCount * 3);
  const petalSpeeds = new Float32Array(petalCount);
  for (let i = 0; i < petalCount; i += 1) {
    petalPositions[i * 3] = (Math.random() - 0.5) * 14;
    petalPositions[i * 3 + 1] = Math.random() * 5.6;
    petalPositions[i * 3 + 2] = -194 - Math.random() * 33;
    petalSpeeds[i] = 0.08 + Math.random() * 0.16;
  }
  petalGeometry.setAttribute("position", new THREE.BufferAttribute(petalPositions, 3));
  const petalPoints = new THREE.Points(petalGeometry, new THREE.PointsMaterial({
    size: 0.15,
    map: dotTex,
    color: 0xe8b6ac,
    transparent: true,
    opacity: 0.75,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true
  }));
  scene.add(petalPoints);
  petals.push({ points: petalPoints, speeds: petalSpeeds });

  // Effects that can step out at the lowest tier without touching the
  // architecture, photographs, lantern bodies or event schedule.
  applyQualityExtras = (level) => {
    const low = level === 0;
    dust.visible = !low;
    petalPoints.visible = !low;
    lanternFloorMesh.visible = !low;
    edgeGlowGroup.visible = !low;
    lanternList.forEach((item) => {
      item.halo.visible = !low;
    });
    if (wallWashGroup) wallWashGroup.visible = true;
  };
  applyQualityExtras(quality.level);

  /* ------------------------------------------------------------
     Camera, scroll binding, animation
     ------------------------------------------------------------ */

  const chapters = Array.from(document.querySelectorAll(".chapter"));
  const ENTRANCE = {
    position: [0, 1.78, 14.5],
    look: [0, 1.72, -2]
  };

  let keys = [];
  let active = false;
  let doorsOpen = false;
  let candlesLit = true;
  let targetProgress = 0;
  let smoothProgress = 0;
  let lastTime = 0;
  let downPoint = null;
  let lastHover = 0;
  let hoveredKey = null;

  const clock = new THREE.Clock();
  const currentLook = new THREE.Vector3(ENTRANCE.look[0], ENTRANCE.look[1], ENTRANCE.look[2]);
  const desiredPosition = new THREE.Vector3(ENTRANCE.position[0], ENTRANCE.position[1], ENTRANCE.position[2]);
  const desiredLook = new THREE.Vector3(ENTRANCE.look[0], ENTRANCE.look[1], ENTRANCE.look[2]);
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  function rebuildPath() {
    if (!chapters.length) return;
    keys = buildCameraPath(chapters);
  }

  function readScroll() {
    const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    targetProgress = clamp(window.scrollY / max, 0, 1);
  }

  function pick(clientX, clientY) {
    if (!active) return;
    pointer.x = (clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(hotspots, false);
    if (hits.length) {
      const payload = hits[0].object.userData.select;
      if (payload) onSelect?.(payload);
    }
  }

  function onPointerDown(event) {
    if (event.target !== canvas) return;
    downPoint = { x: event.clientX, y: event.clientY, time: performance.now() };
  }

  function onPointerUp(event) {
    if (!downPoint) return;
    const moved = Math.hypot(event.clientX - downPoint.x, event.clientY - downPoint.y);
    const elapsed = performance.now() - downPoint.time;
    downPoint = null;
    if (event.target !== canvas || moved > 10 || elapsed > 700) return;
    pick(event.clientX, event.clientY);
  }

  function onPointerMove(event) {
    if (event.target !== canvas) {
      canvas.style.cursor = "";
      if (hoveredKey !== null) {
        hoveredKey = null;
        onHover?.(null);
      }
      return;
    }
    const now = performance.now();
    if (now - lastHover < 90) return;
    lastHover = now;
    if (!active) {
      canvas.style.cursor = "";
      return;
    }
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(hotspots, false);
    canvas.style.cursor = hits.length ? "pointer" : "";
    const nextKey = hits.length ? hits[0].object.userData.select?.key || null : null;
    if (nextKey !== hoveredKey) {
      hoveredKey = nextKey;
      onHover?.(hits.length ? hits[0].object.userData.select : null);
    }
  }

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(capForQuality(quality.level));
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (active) rebuildPath();
  }

  canvas.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointermove", onPointerMove, { passive: true });
  canvas.addEventListener("pointerleave", () => {
    if (hoveredKey !== null) {
      hoveredKey = null;
      onHover?.(null);
    }
    canvas.style.cursor = "";
  });
  window.addEventListener("resize", onResize);

  function onFrame(callback) {
    frameCallbacks.add(callback);
    return () => frameCallbacks.delete(callback);
  }

  function setOnHover(callback) {
    onHover = callback;
  }

  function tick() {
    const raf = requestAnimationFrame(tick);
    tick.raf = raf;
    if (document.hidden) {
      quality.lastNow = 0;
      quality.sampleSeconds = 0;
      quality.sampleFrames = 0;
      return;
    }
    const unlockScreen = document.getElementById("screen-unlock");
    const unlockVisible = !!unlockScreen && !unlockScreen.hidden;
    if (!active && !unlockVisible) {
      quality.lastNow = 0;
      return;
    }

    if (active) {
      const nowMs = performance.now();
      const frameMs = quality.lastNow ? nowMs - quality.lastNow : 16.7;
      quality.lastNow = nowMs;
      if (frameMs > 0 && frameMs < 250) {
        quality.sampleSeconds += frameMs / 1000;
        quality.sampleFrames += 1;
        if (quality.sampleSeconds >= 1.25 && quality.sampleFrames > 8) {
          evaluateQuality((quality.sampleSeconds * 1000) / quality.sampleFrames, nowMs);
          quality.sampleSeconds = 0;
          quality.sampleFrames = 0;
        }
      }
    } else {
      quality.lastNow = 0;
    }

    const time = clock.getElapsedTime();
    const delta = Math.min(0.05, Math.max(0, time - lastTime));
    lastTime = time;

    if (active) readScroll();
    else targetProgress = 0;

    smoothProgress += (targetProgress - smoothProgress) * (reducedMotion ? 1 : 0.115);
    if (Math.abs(targetProgress - smoothProgress) < 0.0002) smoothProgress = targetProgress;

    const sample = keys.length ? sampleCameraPath(keys, smoothProgress) : ENTRANCE;

    if (surpriseMode) {
      // Frame the dancer to the safe area of the current viewport: on
      // tall phones and short landscape windows the camera steps back
      // so the character sits above the fixed action row.
      const vh = window.innerHeight;
      const vw = window.innerWidth;
      const portrait = vh >= vw * 1.08;
      const short = vh < 620;
      if (portrait) {
        desiredPosition.set(4.6, 2.1, -215.5);
        desiredLook.set(4.6, 1.335, -219.2);
      } else if (short) {
        desiredPosition.set(4.6, 1.95, -213.4);
        desiredLook.set(4.6, 0.85, -219.2);
      } else {
        desiredPosition.set(4.6, 2.0, -215.6);
        desiredLook.set(4.6, 1.15, -219.2);
      }
    } else {

    const idle = reducedMotion ? 0 : 1;
    const swayX = Math.sin(time * 0.42) * 0.035 * idle;
    const swayY = Math.sin(time * 0.33 + 1.2) * 0.022 * idle;
    const entranceBreath = !active && !reducedMotion ? Math.sin(time * 0.2) * 0.14 : 0;

    desiredPosition.set(
      sample.position[0] + swayX,
      sample.position[1] + swayY,
      sample.position[2] + entranceBreath
    );
    desiredLook.set(sample.look[0], sample.look[1], sample.look[2]);
    }

    const positionEase = reducedMotion ? 1 : 0.14;
    const lookEase = reducedMotion ? 1 : 0.16;
    camera.position.lerp(desiredPosition, positionEase);
    currentLook.lerp(desiredLook, lookEase);
    camera.lookAt(currentLook);

    // The entrance doors swing inward when the museum is entered.
    const leftTarget = doorsOpen ? 1.55 : 0.02;
    const rightTarget = doorsOpen ? -1.55 : -0.02;
    leftDoor.rotation.y += (leftTarget - leftDoor.rotation.y) * (reducedMotion ? 1 : 0.05);
    rightDoor.rotation.y += (rightTarget - rightDoor.rotation.y) * (reducedMotion ? 1 : 0.05);

    // Candles flicker while they are lit.
    flames.forEach((flame) => {
      if (!flame.visible) return;
      const phase = flame.userData.phase || 0;
      const flicker = 0.9 + Math.sin(time * 12 + phase) * 0.09 + Math.sin(time * 21 + phase * 2) * 0.05;
      flame.scale.set(1, flicker, 1);
      if (flame.userData.halo) {
        flame.userData.halo.material.opacity = 0.45 + flicker * 0.25;
      }
    });

    bobbers.forEach((item) => {
      const bob = reducedMotion ? 0 : Math.sin(time * 0.6 + item.phase) * (item.sway || 0.08);
      item.group.position.y = item.baseY + bob;
      item.group.rotation.z = reducedMotion ? 0 : Math.sin(time * 0.4 + item.phase) * 0.025;
    });

    floaters.forEach((item) => {
      item.group.position.y = item.baseY + (reducedMotion ? 0 : Math.sin(time * 0.7 + item.phase) * 0.1);
      item.group.rotation.y += (reducedMotion ? 0 : 0.0012);
    });

    if (heart && !reducedMotion) {
      const pulse = 1.45 + Math.sin(time * 0.9) * 0.012;
      heart.scale.setScalar(pulse);
      halo.rotation.z = time * 0.1;
    }

    if (lampGlow && !reducedMotion) {
      lampGlow.material.opacity = 0.55 + Math.sin(time * 2.2) * 0.1;
    }

    if (dust && !reducedMotion) {
      dust.rotation.y = Math.sin(time * 0.045) * 0.04;
      dust.position.y = Math.sin(time * 0.24) * 0.05;
    }

    if (!reducedMotion) {
      petals.forEach((petal) => {
        const positions = petal.points.geometry.attributes.position.array;
        for (let i = 0; i < petal.speeds.length; i += 1) {
          positions[i * 3 + 1] -= petal.speeds[i] * delta * 1.4;
          positions[i * 3] += Math.sin(time * 0.5 + i) * delta * 0.04;
          if (positions[i * 3 + 1] < 0.15) {
            positions[i * 3 + 1] = 5.6;
            positions[i * 3] = (Math.random() - 0.5) * 14;
          }
        }
        petal.points.geometry.attributes.position.needsUpdate = true;
      });
    }

    // Lanterns drift almost imperceptibly; their colour breathes
    // over minutes rather than pulsing visibly.
    const lanternMotion = reducedMotion ? 0 : 1;
    lanternGroups.forEach(({ family, items }) => {
      if (!items.length) return;
      if (family.material) {
        const breath = 0.5 + 0.5 * Math.sin(time * 0.32 + family.pulse);
        const hue = family.hue + Math.sin(time * 0.05 + family.pulse) * 0.02;
        const glow = 0.9 + breath * 0.12;

        const shell = family.material.uniforms;
        shell.uGlow.value = glow;
        shell.uTint.value.setHSL(hue, family.sat, family.light);
        shell.uCore.value.setHSL(hue, family.sat * 0.3, Math.min(1, family.light + 0.12));

        const core = family.coreMaterial.uniforms;
        core.uGlow.value = glow;
        core.uTint.value.setHSL(hue, family.sat * 0.22, Math.min(1, family.light + 0.06));
        core.uCore.value.setHSL(hue, family.sat * 0.12, 1);
      }
      items.forEach((item) => {
        const bob = Math.sin(time * item.speed + item.phase) * 0.07 * lanternMotion;
        const sway = Math.sin(time * item.speed * 0.6 + item.swayPhase) * 0.018 * lanternMotion;
        lanternDummy.position.set(item.x + sway, item.baseY + bob, item.z);
        lanternDummy.scale.set(item.scaleX, item.scaleY, item.scaleX);
        lanternDummy.updateMatrix();
        item.mesh.setMatrixAt(item.index, lanternDummy.matrix);
        lanternDummy.scale.set(item.scaleX * CORE_SCALE, item.scaleY * CORE_SCALE, item.scaleX * CORE_SCALE);
        lanternDummy.updateMatrix();
        item.coreMesh.setMatrixAt(item.index, lanternDummy.matrix);
        item.halo.position.set(item.x + sway, item.baseY + bob, item.z);
        item.halo.material.opacity = item.haloOpacity + Math.sin(time * 0.35 + item.phase) * 0.02;
      });
      items[0].mesh.instanceMatrix.needsUpdate = true;
      items[0].coreMesh.instanceMatrix.needsUpdate = true;
    });

    if (surpriseGroup.visible) {
      const targetScale = surpriseMode ? 1 : 0.001;
      surpriseGroup.scale.x += (targetScale - surpriseGroup.scale.x) * 0.12;
      surpriseGroup.scale.y += (targetScale - surpriseGroup.scale.y) * 0.12;
      surpriseGroup.scale.z += (targetScale - surpriseGroup.scale.z) * 0.12;
      if (surpriseDancing) {
        surpriseTime += delta;
        surpriseGroup.position.x = 4.6 + Math.sin(surpriseTime * 2.2) * 0.045;
        surpriseGroup.position.y = Math.sin(surpriseTime * 6) * 0.1;
        surpriseGroup.rotation.y = Math.sin(surpriseTime * 2.2) * 0.16;
        headGroup.rotation.z = Math.sin(surpriseTime * 4) * 0.14;
        headGroup.rotation.y = Math.sin(surpriseTime * 2.6 + 0.8) * 0.09;
        armL.rotation.z = Math.sin(surpriseTime * 5) * 0.95 - 0.3;
        armR.rotation.z = -Math.sin(surpriseTime * 5) * 0.95 + 0.3;
        legL.rotation.z = Math.sin(surpriseTime * 5 + Math.PI) * 0.2;
        legR.rotation.z = -Math.sin(surpriseTime * 5 + Math.PI) * 0.2;
        legL.rotation.x = Math.sin(surpriseTime * 2.5) * 0.1;
        legR.rotation.x = -Math.sin(surpriseTime * 2.5) * 0.1;
      } else {
        surpriseGroup.position.y *= 0.9;
        surpriseGroup.rotation.y *= 0.9;
      }
    }

    // Dance-party dressing. The captions float and pop on the dancer's
    // beat; the light beam breathes with the same pulse. Both fade out
    // when the dance stops, so the stage returns to normal.
    const danceFxTarget = surpriseMode && surpriseDancing ? 1 : 0;
    danceFx += (danceFxTarget - danceFx) * (reducedMotion ? 1 : 0.08);
    if (danceFx < 0.002) danceFx = 0;

    laughGroup.visible = danceFx > 0.002;
    if (laughGroup.visible) {
      const motion = reducedMotion ? 0 : 1;
      // Tall phones have a narrow frame, so pull the captions inward and
      // shrink them a little to keep every one inside the safe area.
      const portraitLayout = camera.aspect < 0.85;
      const xScale = portraitLayout ? 0.6 : 1;
      const sizeScale = portraitLayout ? 0.72 : 1;
      laughSprites.forEach((sprite) => {
        const data = sprite.userData;
        const lift = portraitLayout && data.baseY > 2.2 ? 0.16 : 0;
        sprite.position.set(
          data.baseX * xScale + Math.sin(time * 0.85 + data.phase * 1.7) * 0.06 * motion * xScale,
          data.baseY + lift + Math.sin(time * 1.7 + data.phase) * 0.1 * motion,
          data.baseZ
        );
        const pop = 1 + Math.abs(Math.sin(surpriseTime * 5 + data.phase)) * 0.14 * motion;
        sprite.scale.set(data.width * pop * sizeScale, data.height * pop * sizeScale, 1);
        sprite.material.opacity = (0.68 + Math.sin(time * 1.3 + data.phase) * 0.14 * motion) * danceFx;
      });
    }

    danceSpot.visible = danceFx > 0.002;
    if (danceSpot.visible) {
      const beat = Math.abs(Math.sin(surpriseTime * 5));
      shaftInner.material.opacity = (0.13 + beat * 0.05) * danceFx;
      shaftOuter.material.opacity = (0.05 + beat * 0.02) * danceFx;
      spotPool.material.opacity = (0.26 + beat * 0.08) * danceFx;
    }

    if (frameCallbacks.size) {
      const snapshot = Array.from(frameCallbacks);
      snapshot.forEach((callback) => {
        try {
          callback({ time, camera, anchors: labelAnchors, active });
        } catch (error) {
          console.warn("[Gioia Museum] frame callback failed", error);
        }
      });
    }

    // Rhythmic camera bump, locked to the dancer's own motion. It only
    // runs while the character is actually dancing, eases in and out so
    // it never pops, and is skipped entirely for reduced-motion visitors.
    const shakeTarget = surpriseMode && surpriseDancing && !reducedMotion ? 1 : 0;
    danceShake += (shakeTarget - danceShake) * (reducedMotion ? 1 : 0.06);
    if (danceShake < 0.002) danceShake = 0;

    const baseCameraX = camera.position.x;
    const baseCameraY = camera.position.y;
    const baseCameraZ = camera.position.z;
    const baseRoll = camera.rotation.z;

    if (danceShake > 0) {
      // The dance swings its arms on sin(t * 5), so the half-rectified
      // `pulse` lands on every arm beat; `sway` and `bounce` mirror the
      // torso and head movement.
      const pulse = Math.pow(Math.abs(Math.sin(surpriseTime * 5)), 2);
      const sway = Math.sin(surpriseTime * 2.2);
      const bounce = Math.sin(surpriseTime * 6);
      camera.position.set(
        baseCameraX + (sway * 0.02 + Math.sin(surpriseTime * 5 + 1.1) * 0.007) * danceShake,
        baseCameraY + (bounce * 0.028 - pulse * 0.034) * danceShake,
        baseCameraZ - pulse * 0.008 * danceShake
      );
      camera.rotation.z = baseRoll + Math.sin(surpriseTime * 5 + 0.5) * 0.0035 * danceShake;
    }

    renderer.render(scene, camera);

    if (danceShake > 0) {
      camera.position.set(baseCameraX, baseCameraY, baseCameraZ);
      camera.rotation.z = baseRoll;
    }
  }

  function setActive(value) {
    active = Boolean(value);
    if (active) {
      rebuildPath();
      smoothProgress = 0;
      targetProgress = 0;
      // Ignore the first few seconds of shader warm-up and camera
      // settling so quality never drops because of a one-off compile.
      quality.lastNow = 0;
      quality.sampleSeconds = 0;
      quality.sampleFrames = 0;
      quality.cooldownUntil = performance.now() + 4000;
    } else {
      smoothProgress = 0;
      targetProgress = 0;
      keys = [];
      quality.lastNow = 0;
    }
  }

  function setDoors(value) {
    doorsOpen = Boolean(value);
  }

  function setCandlesLit(value) {
    candlesLit = Boolean(value);
    flames.forEach((flame) => {
      flame.visible = candlesLit;
      if (flame.userData.halo) flame.userData.halo.visible = candlesLit;
    });
    if (candleLight) candleLight.intensity = candlesLit ? 55 : 4;
  }

  function dispose() {
    cancelAnimationFrame(tick.raf);
    canvas.removeEventListener("pointerdown", onPointerDown);
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("resize", onResize);
    renderer.dispose();
  }

  tick.raf = 0;
  tick();

  return {
    setActive,
    setDoors,
    setCandlesLit,
    rebuildPath,
    dispose,
    onFrame,
    setOnHover,
    getLabelAnchors: () => labelAnchors,
    getCakeControlsAnchor: () => cakeControlsAnchor,
    revealSurprise: () => { if (typeof revealSurprise === "function") revealSurprise(); },
    resetSurprise: () => { if (typeof resetSurprise === "function") resetSurprise(); },
    setSurpriseDancing: (value) => { if (typeof setSurpriseDancing === "function") setSurpriseDancing(value); },
    getQuality: () => ({
      level: quality.level,
      pixelRatio: renderer.getPixelRatio(),
      averageFrameMs: Number(quality.lastAverage.toFixed(2))
    }),
    setQuality: (level) => {
      applyQuality(level);
      quality.cooldownUntil = performance.now() + 6000;
    },
    camera,
    renderer,
    scene,
    isActive: () => active
  };
}

