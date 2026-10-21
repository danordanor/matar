import * as THREE from "./lib/three.module.min.js";

const T = window.BOOK;            // strings + settings from the page
const RTL = T.dir === "rtl";
const S = RTL ? -1 : 1;           // which way the pages lie before turning
const BASE = T.base;              // path prefix to assets

// ---------- palette ----------
const PAPER = "#f6f2ea", INK = "#1b1a17", SOFT = "#8a8378";
const COVER = "#1e2740", GOLD = "#cdb07a", RED = "#c2272d";
const DISPLAY = "Bellefair", SMALL = "Inter";

// ---------- page geometry ----------
const W = 1, H = 1.38, CW = 1.04, CH = 1.43;      // page / hardcover size
const TEX_W = 1024, TEX_H = Math.round(TEX_W * H / W);

// ---------- helpers ----------
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ease = (x) => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const loadImg = (src) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });

function canvasFor(mirror, w = TEX_W, h = TEX_H) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const g = c.getContext("2d");
  if (mirror) { g.translate(w, 0); g.scale(-1, 1); }
  return [c, g];
}
function paper(g, w, h, col = PAPER) {
  g.fillStyle = col; g.fillRect(0, 0, w, h);
  // faint grain
  const id = g.getImageData(0, 0, w, h), d = id.data;
  for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - .5) * 7; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  g.putImageData(id, 0, 0);
}
function gutter(g, w, h, mirror, strength = .16) {
  const x0 = mirror ? w : 0, dir = mirror ? -1 : 1;
  const gr = g.createLinearGradient(x0, 0, x0 + dir * 140, 0);
  gr.addColorStop(0, `rgba(60,45,25,${strength})`); gr.addColorStop(1, "rgba(60,45,25,0)");
  g.fillStyle = gr; g.fillRect(Math.min(x0, x0 + dir * 140), 0, 140, h);
}
function text(g, str, x, y, size, opts = {}) {
  g.save();
  g.font = `${opts.weight || 400} ${size}px "${opts.font || DISPLAY}"`;
  g.fillStyle = opts.color || INK; g.textAlign = opts.align || "center"; g.textBaseline = "middle";
  g.direction = opts.dir || T.dir;
  if (opts.spacing) g.letterSpacing = opts.spacing + "px";
  g.fillText(str, x, y); g.restore();
}
function wrap(g, str, x, y, maxW, size, lh, opts = {}) {
  g.save(); g.font = `${opts.weight || 400} ${size}px "${opts.font || DISPLAY}"`; g.direction = T.dir;
  const words = str.split(" "); const lines = []; let line = "";
  for (const w of words) { const t = line ? line + " " + w : w; if (g.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; }
  lines.push(line); g.restore();
  lines.forEach((l, i) => text(g, l, x, y + i * lh, size, opts));
  return lines.length;
}
function playRing(g, cx, cy, r, col) {
  g.save(); g.strokeStyle = col; g.lineWidth = 3; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
  g.fillStyle = col; g.beginPath(); const a = r * .36; g.moveTo(cx - a * .7, cy - a); g.lineTo(cx + a * 1.05, cy); g.lineTo(cx - a * .7, cy + a); g.closePath(); g.fill(); g.restore();
}
function seal(g, cx, cy, r) {           // small red hanko with katakana
  g.save(); g.fillStyle = RED; g.beginPath(); g.roundRect(cx - r, cy - r, r * 2, r * 2, r * .18); g.fill();
  g.fillStyle = "#f7efe6"; g.font = `700 ${r * .62}px "Noto Sans JP", sans-serif`; g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText("マタ", cx, cy - r * .34); g.fillText("ル", cx, cy + r * .38); g.restore();
}
function photo(g, img, x, y, w, h) {   // fit (never crop), thin white mat
  if (!img) return;
  const k = Math.min(w / img.width, h / img.height), iw = img.width * k, ih = img.height * k;
  const ix = x + (w - iw) / 2, iy = y + (h - ih) / 2;
  g.save(); g.shadowColor = "rgba(40,30,15,.18)"; g.shadowBlur = 24; g.shadowOffsetY = 8;
  g.fillStyle = "#fff"; g.fillRect(ix - 14, iy - 14, iw + 28, ih + 28); g.restore();
  g.drawImage(img, ix, iy, iw, ih);
  return [ix, iy, iw, ih];
}
function waves(g, w, h, col, bg) {      // seigaiha endpaper
  g.fillStyle = bg; g.fillRect(0, 0, w, h); g.strokeStyle = col; g.lineWidth = 2;
  const r = 46;
  for (let row = -1; row * r * .5 < h + r; row++) for (let i = -1; i * r * 2 < w + r * 2; i++) {
    const cx = i * r * 2 + (row % 2 ? r : 0), cy = row * r * .5;
    for (let k = 4; k >= 1; k--) { g.beginPath(); g.arc(cx, cy, r * k / 4, Math.PI, 0); g.stroke(); }
  }
}

// ---------- covers ----------
const SHOTS = [6, 18, 58, 86, 114, 146];
async function buildFaces() {
  const imgs = await Promise.all(SHOTS.map((s) => loadImg(`${BASE}f/${s}.jpg`)));
  const cloth = (g, w, h) => {
    g.fillStyle = COVER; g.fillRect(0, 0, w, h);
    const id = g.getImageData(0, 0, w, h), d = id.data; for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - .5) * 10; d[i] += n; d[i + 1] += n; d[i + 2] += n; } g.putImageData(id, 0, 0);
    g.strokeStyle = GOLD; g.globalAlpha = .5; g.lineWidth = 2; g.strokeRect(48, 48, w - 96, h - 96); g.globalAlpha = 1;
  };
  const cover = { kind: "cover", draw: (g, w, h) => {
    cloth(g, w, h);
    const cols = 2, rows = 3, gap = 18, x0 = 116, y0 = 116, cw = (w - 2 * x0 - gap) / cols, ch = cw * 9 / 16;
    imgs.forEach((im, i) => {
      if (!im) return; const c = i % cols, r = Math.floor(i / cols);
      const x = RTL ? w - x0 - (c + 1) * cw - c * gap : x0 + c * (cw + gap), y = y0 + r * (ch + gap);
      const k = Math.max(cw / im.width, ch / im.height), iw = im.width * k, ih = im.height * k;
      g.save(); g.beginPath(); g.rect(x, y, cw, ch); g.clip(); g.drawImage(im, x + (cw - iw) / 2, y + (ch - ih) / 2, iw, ih); g.restore();
    });
    const ty = y0 + rows * (ch + gap) + 150;
    text(g, T.name, w / 2, ty, 190, { color: GOLD });
    g.fillStyle = GOLD; g.fillRect(w / 2 - 34, ty + 105, 68, 2);
    text(g, T.sub, w / 2, ty + 165, 46, { color: GOLD });
    seal(g, w / 2, h - 132, 34);
  } };
  const back = { kind: "back", draw: (g, w, h) => {
    cloth(g, w, h);
    text(g, T.blurbLabel, w / 2, 230, 34, { color: GOLD, font: SMALL, spacing: RTL ? 2 : 6 });
    g.fillStyle = GOLD; g.fillRect(w / 2 - 34, 290, 68, 2);
    const n = wrap(g, T.blurb, w / 2, 420, w - 250, 56, 86, { color: "#efe8da" });
    const y = 420 + n * 86 + 110;
    text(g, T.love, w / 2, y, 40, { color: GOLD });
    playRing(g, w / 2, h - 300, 52, GOLD);
    text(g, T.again, w / 2, h - 212, 34, { color: GOLD });
    seal(g, w / 2, h - 110, 28);
  } };
  const inside = { kind: "video", video: true, draw: (g, w, h) => { g.fillStyle = "#0d0d0d"; g.fillRect(0, 0, w, h); } };
  return [[cover, inside], [inside, back]];
}

// ---------- three.js scene ----------
const host = document.getElementById("book");
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
host.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, 1, .1, 50);
scene.add(new THREE.HemisphereLight(0xfffaf0, 0xd9cfbf, 1.35));
const sun = new THREE.DirectionalLight(0xfff3e0, 1.6);
sun.position.set(-1.8, 2.6, 4.2); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); sun.shadow.radius = 6; sun.shadow.bias = -.0004;
Object.assign(sun.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: .5, far: 12 });
scene.add(sun);

const table = new THREE.Group(); scene.add(table);       // tilted "desk" plane
table.rotation.x = -.5;
const ground = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.ShadowMaterial({ opacity: .16 }));
ground.position.z = -.012; ground.receiveShadow = true; table.add(ground);
const book = new THREE.Group(); table.add(book);

const COLS = 24;
const GAP = .006;
const leaves = [];

// ---------- the film, living inside the book ----------
const video = document.getElementById("film");
const SRC = `${BASE}v/index.m3u8`;
if (video.canPlayType("application/vnd.apple.mpegurl")) video.src = SRC;
else if (window.Hls && Hls.isSupported()) { const h = new Hls({ maxBufferLength: 30 }); h.loadSource(SRC); h.attachMedia(video); }
else video.src = SRC;
const vtex = new THREE.VideoTexture(video); vtex.colorSpace = THREE.SRGBColorSpace;
const posterTex = new THREE.TextureLoader().load(`${BASE}poster.jpg`); posterTex.colorSpace = THREE.SRGBColorSpace;
// the 16:9 film fills the open spread (2 × CW by CH), cropped at the sides
const SPAN = (2 * CW / CH) / (16 / 9) / 2;           // half of the visible width, in video u
function halfMap(base, neg) {                          // u=0 at the spine → video centre
  const t = base.clone(); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.repeat.set(neg ? -SPAN : SPAN, 1); t.offset.set(.5, 0); t.needsUpdate = true; return t;
}
const videoMats = [];

function makeLeaf(faces, i, n) {
  const w = CW, h = CH;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array((COLS + 1) * 2 * 3), uv = new Float32Array((COLS + 1) * 2 * 2), idx = [];
  for (let c = 0; c <= COLS; c++) for (let r = 0; r < 2; r++) { const k = c * 2 + r; uv[k * 2] = c / COLS; uv[k * 2 + 1] = r; }
  for (let c = 0; c < COLS; c++) { const a = c * 2, b = a + 1, d = a + 2, e = a + 3; if (S > 0) idx.push(a, d, b, b, d, e); else idx.push(a, b, d, b, e, d); }
  geo.setIndex(idx); geo.setAttribute("position", new THREE.BufferAttribute(pos, 3)); geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));

  const mat = (face, side, mirror) => {
    if (face.video) {
      // which half of the frame this page shows depends on where it lies when open
      const neg = (side === 1) === (S > 0);
      const m = new THREE.MeshBasicMaterial({ map: halfMap(posterTex, neg), side: side ? THREE.BackSide : THREE.FrontSide, toneMapped: false });
      m.userData = { neg }; videoMats.push(m); return m;
    }
    const [c, g] = canvasFor(mirror); face.draw(g, c.width, c.height, mirror);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return new THREE.MeshStandardMaterial({ map: t, side: side ? THREE.BackSide : THREE.FrontSide, roughness: .6 });
  };
  const front = new THREE.Mesh(geo, mat(faces[0], 0, S < 0)), backM = new THREE.Mesh(geo, mat(faces[1], 1, S > 0));
  front.castShadow = backM.castShadow = true; front.receiveShadow = true;
  front.userData = { leaf: i, side: 0, kind: faces[0].kind }; backM.userData = { leaf: i, side: 1, kind: faces[1].kind };
  const g = new THREE.Group(); g.add(front, backM); book.add(g);
  const L = { i, n, w, h, geo, group: g, p: 0, meshes: [front, backM] };
  layout(L, 0); return L;
}

function layout(L, p) {
  const { geo, w, h, i, n } = L;
  const pos = geo.attributes.position.array;
  const theta = Math.PI * p, lift = Math.sin(Math.PI * p) * .03;
  const zRest = (1 - p) * (n - i) * GAP + p * (i + 1) * GAP;
  for (let c = 0; c <= COLS; c++) {
    const d = w * c / COLS, x = Math.cos(theta) * d, z = Math.sin(theta) * d;
    for (let r = 0; r < 2; r++) { const k = (c * 2 + r) * 3; pos[k] = S * x; pos[k + 1] = (r - .5) * h; pos[k + 2] = z + zRest + lift * (c / COLS); }
  }
  geo.attributes.position.needsUpdate = true; geo.computeVertexNormals(); geo.computeBoundingSphere();
}

// a thin block of pages between the covers, so it reads as a book
const block = new THREE.Mesh(new THREE.BoxGeometry(W, H, GAP * .8), new THREE.MeshStandardMaterial({ color: 0xf3eee4, roughness: 1 }));
block.castShadow = true; block.receiveShadow = true; block.position.set(S * W / 2, 0, GAP * 1.4);

// ---------- state: 0 closed (front) · 1 open (film) · 2 closed (back, the story) ----------
let target = 0, offset = 0;
const body = document.body;
function go(t) {
  target = clamp(t, 0, 2);
  body.dataset.state = ["front", "open", "back"][target];
  if (target === 1) { video.play().catch(() => {}); } else video.pause();
}
window.bookGo = go;
video.addEventListener("playing", () => { for (const m of videoMats) { m.map = halfMap(vtex, m.userData.neg); m.needsUpdate = true; } }, { once: true });
video.addEventListener("ended", () => setTimeout(() => go(2), 900));

// ---------- size / camera fit ----------
function fit() {
  const w = host.clientWidth, h = host.clientHeight, pr = renderer.getPixelRatio();
  if (renderer.domElement.width !== Math.floor(w * pr) || renderer.domElement.height !== Math.floor(h * pr)) renderer.setSize(w, h);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  const open = target === 1;
  const needW = (open ? 2 * CW : CW) * (open ? 1.12 : 1.3), needH = CH * (open ? 1.5 : 1.55);
  const fov = camera.fov * Math.PI / 180;
  return Math.max(needH / 2 / Math.tan(fov / 2), needW / 2 / (Math.tan(fov / 2) * camera.aspect));
}

// ---------- pointer ----------
const ray = new THREE.Raycaster(), m = new THREE.Vector2(), look = { x: 0, y: 0 };
let down = null;
renderer.domElement.addEventListener("pointermove", (e) => {
  const r = renderer.domElement.getBoundingClientRect();
  look.x = (e.clientX - r.left) / r.width * 2 - 1; look.y = (e.clientY - r.top) / r.height * 2 - 1;
  renderer.domElement.style.cursor = pick(e) ? "pointer" : "default";
});
renderer.domElement.addEventListener("pointerdown", (e) => { down = { x: e.clientX }; });
renderer.domElement.addEventListener("pointerup", (e) => {
  if (!down) return; const dx = e.clientX - down.x; down = null;
  if (Math.abs(dx) > 40) return go(target + (dx * S < 0 ? 1 : -1));
  const hit = pick(e); if (!hit) return;
  const kind = hit.object.userData.kind;
  if (kind === "cover") go(1);
  else if (kind === "back") go(1), video.currentTime = 0;
  else if (kind === "video") video.paused ? video.play() : video.pause();
});
function pick(e) {
  const r = renderer.domElement.getBoundingClientRect();
  m.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(m, camera);
  return ray.intersectObjects(leaves.flatMap((l) => l.meshes), false)[0];
}
window.addEventListener("keydown", (e) => {
  const fwd = RTL ? "ArrowLeft" : "ArrowRight", bwd = RTL ? "ArrowRight" : "ArrowLeft";
  if (e.key === " ") { e.preventDefault(); if (target === 1) video.paused ? video.play() : video.pause(); else go(1); }
  else if (e.key === fwd) go(target + 1);
  else if (e.key === bwd) go(target - 1);
});

// ---------- loop ----------
const clock = new THREE.Clock(); const camGoal = new THREE.Vector3();
function frame() {
  const dt = Math.min(.05, clock.getDelta()), t = clock.elapsedTime;
  for (const L of leaves) {
    const goal = L.i < target ? 1 : 0;
    if (L.p !== goal) { L.p = goal ? Math.min(1, L.p + dt / 1.2) : Math.max(0, L.p - dt / 1.2); layout(L, ease(L.p)); }
  }
  // the page block flips with whichever side is down
  const resting = leaves.every((L) => L.p === 0 || L.p === 1);
  block.visible = resting && target !== 1;
  block.position.x = (target === 2 ? -S : S) * W / 2;
  // centre the composition like a postcard; look straight at the film when open
  const want = target === 0 ? -S * CW / 2 : target === 2 ? S * CW / 2 : 0;
  offset += (want - offset) * Math.min(1, dt * 3); book.position.x = offset;
  const tilt = target === 1 ? -.12 : -.5; table.rotation.x += (tilt - table.rotation.x) * Math.min(1, dt * 2.2);
  const dist = fit(), still = target === 1 ? .25 : 1;
  camGoal.set(look.x * .25 * still, -look.y * .12 * still + .04, dist);
  camera.position.lerp(camGoal, Math.min(1, dt * 2.5)); camera.lookAt(0, 0, 0);
  book.position.y = Math.sin(t * .8) * .006 * still;
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

// ---------- boot ----------
(async () => {
  await Promise.race([new Promise((r) => setTimeout(r, 2500)), Promise.all([document.fonts.load(`400 100px "${DISPLAY}"`, "מטר Matar"), document.fonts.load(`400 30px "${SMALL}"`), document.fonts.load(`700 40px "Noto Sans JP"`)]).catch(() => {})]);
  const faces = await buildFaces();
  faces.forEach((f, i) => leaves.push(makeLeaf(f, i, faces.length)));
  book.add(block);
  offset = -S * CW / 2; go(0); camera.position.set(0, 0, fit() * 1.25);
  body.classList.add("ready");
  frame();
})();
