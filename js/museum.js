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

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !isMobile,
    alpha: false,
    powerPreference: "high-performance"
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? (window.innerWidth < 380 ? 1.0 : 1.2) : 2));
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

  /* ------------------------------------------------------------
     IV · Letters for You
     ------------------------------------------------------------ */

  const letters = (content.letters?.letters || []).slice(0, 5);
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
  addBox(4.6, 0.16, 1.8, wood, 0, 1.02, 0, desk);
  addBox(0.18, 1.0, 1.5, woodDark, -2.1, 0.5, 0, desk);
  addBox(0.18, 1.0, 1.5, woodDark, 2.1, 0.5, 0, desk);
  addBox(4.3, 0.08, 1.55, gold, 0, 0.92, 0, desk);
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
    const env = makeEnvelope();
    const x = -1.75 + index * 0.88;
    env.group.position.set(x, 1.14, -149.55 + (index % 2 === 0 ? 0.12 : -0.12));
    env.group.rotation.y = (index % 2 === 0 ? -1 : 1) * 0.12;
    scene.add(env.group);
    selectable(env.body, { type: "letter", index, key: `letter-${index}` });

    const floating = makeEnvelope();
    floating.group.position.set(
      index % 2 === 0 ? -2.2 - (index % 3) * 0.25 : 2.2 + (index % 3) * 0.25,
      2.35 + (index % 3) * 0.36,
      -147.2 - index * 0.85
    );
    floating.group.rotation.set(-0.35, index % 2 === 0 ? 0.5 : -0.5, 0.08);
    floating.group.scale.setScalar(0.9);
    scene.add(floating.group);
    floaters.push({ group: floating.group, baseY: floating.group.position.y, phase: index * 1.7 });
    selectable(floating.body, { type: "letter", index, key: `letter-${index}` });

    addLabelAnchor({
      key: `letter-${index}`,
      room: "letters",
      cluster: "letters",
      kind: "object",
      title: letter.seal || letter.title || `Letter ${index + 1}`,
      kicker: `Letter ${String(index + 1).padStart(2, "0")}`,
      caption: letter.title || "",
      hint: "Open the letter",
      position: new THREE.Vector3(x, 1.7, -149.4),
      payload: { type: "letter", index, key: `letter-${index}` },
      maxDistance: 12,
      priority: 14
    });
  });

  const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 0.06, 20), gold);
  lampBase.position.set(-1.75, 1.13, -150.15);
  scene.add(lampBase);
  const lampStem = addBox(0.035, 0.7, 0.035, gold, -1.75, 1.48, -150.15);
  lampStem.material = gold;
  const lampShade = new THREE.Mesh(
    new THREE.ConeGeometry(0.32, 0.35, 24, 1, true),
    new THREE.MeshStandardMaterial({ color: 0xe8c3a0, roughness: 0.7, side: THREE.DoubleSide, emissive: 0x6a3a10, emissiveIntensity: 0.25 })
  );
  lampShade.position.set(-1.75, 1.85, -150.15);
  lampShade.rotation.x = Math.PI;
  scene.add(lampShade);
  const lampGlow = addGlowSprite(-1.75, 1.72, -150.15, 1.7, 0xffbb78, 0.7);
  lampGlow.userData.pulse = true;
  const lampLight = addPoint(-1.75, 1.72, -150.15, 0xffb768, 36, 8, 1.8);

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
  addGlowSprite(0, 3.1, -220.1, 9, 0xffb98f, 0.45);
  addGlowSprite(0, 3.1, -219.7, 4.2, 0xffd9a0, 0.4);

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

  const surpriseBodyMat = new THREE.MeshStandardMaterial({ color: 0x7a5a9a, roughness: 0.55, metalness: 0.12, emissive: 0x2a1a3a, emissiveIntensity: 0.35 });
  const surpriseBody = addBox(0.7, 1.05, 0.45, surpriseBodyMat, 0, 1.35, 0, surpriseGroup);
  const surpriseBelly = new THREE.Mesh(new THREE.SphereGeometry(0.42, 18, 18), surpriseBodyMat);
  surpriseBelly.position.set(0, 1.35, 0.12);
  surpriseBelly.scale.set(1, 0.9, 0.7);
  surpriseGroup.add(surpriseBelly);

  const surpriseHeadMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, metalness: 0.02, emissive: 0x2a1c13, emissiveIntensity: 0.2 });
  const surpriseHead = new THREE.Mesh(new THREE.SphereGeometry(0.38, 24, 24), surpriseHeadMat);
  surpriseHead.position.set(0, 2.15, 0);
  surpriseGroup.add(surpriseHead);

  // Photo face (replaceable).
  const faceTexture = placeholderPhotoTexture();
  const faceMaterial = new THREE.MeshStandardMaterial({ map: faceTexture, color: 0xffffff, roughness: 0.5, metalness: 0.02 });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.55), faceMaterial);
  face.position.set(0, 2.15, 0.45);
  surpriseGroup.add(face);

  const faceLoader = new THREE.TextureLoader();
  faceLoader.load("assets/images/surprise/surprise-head.jpg", (texture) => {
    texture.colorSpace = THREE.SRGBColorSpace;
    const image = texture.image;
    if (image?.width && image?.height) {
      const aspect = image.width / image.height;
      const target = 1;
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

  function makeLimb(x, y, z, w, h, d) {
    const mesh = addBox(w, h, d, surpriseBodyMat, x, y, z, surpriseGroup);
    return mesh;
  }
  const armL = makeLimb(-0.55, 1.55, 0, 0.16, 0.7, 0.16);
  const armR = makeLimb(0.55, 1.55, 0, 0.16, 0.7, 0.16);
  const legL = makeLimb(-0.22, 0.62, 0, 0.18, 0.75, 0.18);
  const legR = makeLimb(0.22, 0.62, 0, 0.18, 0.75, 0.18);

  const surpriseLight = addVisualSpot(4.6, 6.0, -215, new THREE.Vector3(4.6, 2.0, -219.2), { intensity: 180, distance: 20, angle: 0.45, penumbra: 0.9, color: 0xffd39a });
  addGlowSprite(4.6, 2.15, -219.0, 2.6, 0xffd9a0, 0.35);

  let surpriseMode = false;
  let surpriseDancing = false;
  let surpriseTime = 0;

  function revealSurprise() {
    surpriseGroup.visible = true;
    surpriseMode = true;
    surpriseDancing = true;
    surpriseTime = 0;
  }

  function setSurpriseDancing(value) {
    surpriseDancing = Boolean(value);
  }

  function resetSurprise() {
    surpriseMode = false;
    surpriseDancing = false;
    surpriseGroup.visible = false;
    surpriseGroup.scale.setScalar(0.001);
    surpriseGroup.position.y = 0;
    surpriseGroup.rotation.y = 0;
  }

  // Store on scene for external access.
  scene.userData.surprise = { revealSurprise, resetSurprise, group: surpriseGroup };

  addVisualSpot(0, 6.1, -207, new THREE.Vector3(0, 3.1, -220), { intensity: 220, distance: 28, angle: 0.4, penumbra: 0.9 });
  addGlowSprite(0, 5.2, -222.9, 7, 0xffd9a0, 0.18);

  /* ------------------------------------------------------------
     Floating lantern lights (magical atmosphere)
     ------------------------------------------------------------ */
  function lanternTexture() {
    return canvasTexture(128, 192, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      const cx = w / 2;
      // Soft outer glow
      const glow = ctx.createRadialGradient(cx, h * 0.45, 0, cx, h * 0.45, w * 0.62);
      glow.addColorStop(0, "rgba(255,255,255,0.95)");
      glow.addColorStop(0.35, "rgba(255,255,255,0.55)");
      glow.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);

      // Teardrop / pendant body
      ctx.beginPath();
      ctx.moveTo(cx, h * 0.08);
      ctx.bezierCurveTo(cx + w * 0.22, h * 0.18, cx + w * 0.26, h * 0.55, cx, h * 0.92);
      ctx.bezierCurveTo(cx - w * 0.26, h * 0.55, cx - w * 0.22, h * 0.18, cx, h * 0.08);
      ctx.closePath();
      const body = ctx.createLinearGradient(0, h * 0.08, 0, h * 0.92);
      body.addColorStop(0, "rgba(255,255,255,0.95)");
      body.addColorStop(0.5, "rgba(255,255,255,0.75)");
      body.addColorStop(1, "rgba(255,255,255,0.4)");
      ctx.fillStyle = body;
      ctx.fill();

      // Inner core
      const core = ctx.createRadialGradient(cx, h * 0.42, 0, cx, h * 0.42, w * 0.18);
      core.addColorStop(0, "rgba(255,255,255,1)");
      core.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = core;
      ctx.fillRect(0, 0, w, h);
    });
  }

  const lanternTex = lanternTexture();
  const pendantColors = [0xc9a0ff, 0xffb3d9, 0x9fe8ff, 0xbfe0ff, 0xffd6a8, 0x9cffc8];
  const pendantCount = isMobile ? 22 : 46;
  const pendants = [];
  const pendantSeeds = seeded(9173);
  for (let i = 0; i < pendantCount; i += 1) {
    const hue = 0.52 + pendantSeeds() * 0.32;
    const color = new THREE.Color().setHSL(hue, 0.55, 0.72);
    const material = new THREE.SpriteMaterial({
      map: lanternTex,
      color,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false
    });
    const sprite = new THREE.Sprite(material);
    const x = (pendantSeeds() > 0.5 ? 1 : -1) * (4.8 + pendantSeeds() * 3.6);
    const z = 8 - pendantSeeds() * 232;
    const y = 4.1 + pendantSeeds() * 1.9;
    sprite.position.set(x, y, z);
    const scale = 0.55 + pendantSeeds() * 0.9;
    sprite.scale.set(scale * 0.62, scale * 0.95, 1);
    scene.add(sprite);
    pendants.push({
      sprite,
      baseY: y,
      phase: pendantSeeds() * Math.PI * 2,
      speed: 0.35 + pendantSeeds() * 0.45,
      hue,
      colorPhase: pendantSeeds() * Math.PI * 2
    });
  }

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
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.innerWidth < 380 ? 1.0 : (window.innerWidth < 760 ? 1.2 : 2)));
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
    if (document.hidden) return;
    const unlockScreen = document.getElementById("screen-unlock");
    const unlockVisible = !!unlockScreen && !unlockScreen.hidden;
    if (!active && !unlockVisible) return;
    const time = clock.getElapsedTime();
    const delta = Math.min(0.05, Math.max(0, time - lastTime));
    lastTime = time;

    if (active) readScroll();
    else targetProgress = 0;

    smoothProgress += (targetProgress - smoothProgress) * (reducedMotion ? 1 : 0.115);
    if (Math.abs(targetProgress - smoothProgress) < 0.0002) smoothProgress = targetProgress;

    const sample = keys.length ? sampleCameraPath(keys, smoothProgress) : ENTRANCE;

    if (surpriseMode) {
      desiredPosition.set(4.6, 2.0, -215.5);
      desiredLook.set(4.6, 1.7, -219.2);
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

    pendants.forEach((item) => {
      if (!item.sprite.visible) return;
      item.sprite.position.y = item.baseY + Math.sin(time * item.speed + item.phase) * 0.18;
      item.sprite.material.opacity = 0.42 + Math.sin(time * 0.7 + item.phase) * 0.12;
      const hue = item.hue + Math.sin(time * 0.18 + item.colorPhase) * 0.04;
      item.sprite.material.color.setHSL(hue, 0.55, 0.72);
    });

    if (surpriseGroup.visible) {
      const targetScale = surpriseMode ? 1 : 0.001;
      surpriseGroup.scale.x += (targetScale - surpriseGroup.scale.x) * 0.12;
      surpriseGroup.scale.y += (targetScale - surpriseGroup.scale.y) * 0.12;
      surpriseGroup.scale.z += (targetScale - surpriseGroup.scale.z) * 0.12;
      if (surpriseDancing) {
        surpriseTime += delta;
        surpriseGroup.position.y = Math.sin(surpriseTime * 6) * 0.12;
        surpriseGroup.rotation.y = Math.sin(surpriseTime * 2.2) * 0.35;
        surpriseHead.rotation.z = Math.sin(surpriseTime * 4) * 0.25;
        armL.rotation.z = Math.sin(surpriseTime * 5) * 0.9 - 0.3;
        armR.rotation.z = -Math.sin(surpriseTime * 5) * 0.9 + 0.3;
      } else {
        surpriseGroup.position.y *= 0.9;
        surpriseGroup.rotation.y *= 0.9;
      }
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

    renderer.render(scene, camera);
  }

  function setActive(value) {
    active = Boolean(value);
    if (active) {
      rebuildPath();
      smoothProgress = 0;
      targetProgress = 0;
    } else {
      smoothProgress = 0;
      targetProgress = 0;
      keys = [];
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
    camera,
    renderer,
    scene,
    isActive: () => active
  };
}

