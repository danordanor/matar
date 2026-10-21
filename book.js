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

// ---------- page faces ----------
// each face: draw(g, w, h, mirror) ; kind used for clicks
async function buildFaces() {
  const shots = [6, 18, 44, 58, 72, 86, 100, 114, 128, 146];
  const imgs = await Promise.all(shots.map((s) => loadImg(`${BASE}f/${s}.jpg`)));
  const poster = await loadImg(`${BASE}poster.jpg`);
  const num = (g, w, h, n) => text(g, String(n), w / 2, h - 70, 30, { font: SMALL, color: SOFT, dir: "ltr" });

  const cover = { kind: "cover", hard: true, draw: (g, w, h) => {
    g.fillStyle = COVER; g.fillRect(0, 0, w, h);
    const id = g.getImageData(0, 0, w, h), d = id.data; for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - .5) * 10; d[i] += n; d[i + 1] += n; d[i + 2] += n; } g.putImageData(id, 0, 0);
    g.strokeStyle = GOLD; g.globalAlpha = .55; g.lineWidth = 2; g.strokeRect(56, 56, w - 112, h - 112); g.globalAlpha = 1;
    text(g, T.name, w / 2, h * .42, 300, { color: GOLD });
    g.fillStyle = GOLD; g.fillRect(w / 2 - 40, h * .54, 80, 2);
    text(g, T.sub, w / 2, h * .6, 52, { color: GOLD });
    seal(g, w / 2, h - 190, 46);
  } };
  const endpaper = { kind: "end", draw: (g, w, h) => waves(g, w, h, "rgba(205,176,122,.35)", COVER) };
  const title = { kind: "title", draw: (g, w, h, m) => {
    paper(g, w, h); gutter(g, w, h, m);
    text(g, T.name, w / 2, h * .4, 230);
    g.fillStyle = INK; g.fillRect(w / 2 - 30, h * .5, 60, 2);
    text(g, T.line1, w / 2, h * .57, 50);
    text(g, T.line2, w / 2, h * .57 + 66, 50, { color: SOFT });
  } };
  const photoFace = (i, n) => ({ kind: "photo", draw: (g, w, h, m) => {
    paper(g, w, h); gutter(g, w, h, m);
    photo(g, imgs[i], 110, 160, w - 220, h - 400);
    num(g, w, h, n);
  } });
  const film = { kind: "film", draw: (g, w, h, m) => {
    g.fillStyle = "#121212"; g.fillRect(0, 0, w, h); gutter(g, w, h, m, .5);
    if (poster) { const k = Math.max(w / poster.width, (h * .62) / poster.height); const pw = poster.width * k, ph = poster.height * k; g.save(); g.beginPath(); g.rect(0, h * .14, w, h * .62); g.clip(); g.drawImage(poster, (w - pw) / 2, h * .14 + (h * .62 - ph) / 2, pw, ph); g.fillStyle = "rgba(0,0,0,.25)"; g.fillRect(0, 0, w, h); g.restore(); }
    playRing(g, w / 2, h * .45, 78, "#fff");
    text(g, T.film, w / 2, h * .84, 64, { color: "#f4f1ea" });
    text(g, "2:38", w / 2, h * .84 + 62, 28, { font: SMALL, color: "rgba(244,241,234,.6)", dir: "ltr" });
  } };
  const mazal = { kind: "mazal", draw: (g, w, h, m) => {
    paper(g, w, h); gutter(g, w, h, m);
    text(g, T.mazal1, w / 2, h * .44, 120);
    text(g, T.mazal2, w / 2, h * .44 + 130, 120);
    g.fillStyle = INK; g.fillRect(w / 2 - 30, h * .62, 60, 2);
    text(g, T.love, w / 2, h * .68, 40, { color: SOFT });
  } };
  const back = { kind: "back", hard: true, draw: (g, w, h) => {
    g.fillStyle = COVER; g.fillRect(0, 0, w, h);
    g.strokeStyle = GOLD; g.globalAlpha = .55; g.lineWidth = 2; g.strokeRect(56, 56, w - 112, h - 112); g.globalAlpha = 1;
    text(g, T.blurbLabel, w / 2, 210, 34, { color: GOLD, font: SMALL, spacing: RTL ? 2 : 6 });
    const n = wrap(g, T.blurb, w / 2, 340, w - 260, 54, 82, { color: "#efe8da" });
    playRing(g, w / 2, 340 + n * 82 + 150, 64, GOLD);
    text(g, T.watch, w / 2, 340 + n * 82 + 270, 40, { color: GOLD });
    seal(g, w / 2, h - 170, 34);
  } };

  // leaves: [front, back]
  return [
    [cover, endpaper],
    [title, photoFace(0, 1)],
    [photoFace(1, 2), photoFace(2, 3)],
    [photoFace(3, 4), photoFace(4, 5)],
    [photoFace(5, 6), photoFace(6, 7)],
    [photoFace(7, 8), photoFace(8, 9)],
    [photoFace(9, 10), film],
    [mazal, { kind: "end2", draw: (g, w, h) => waves(g, w, h, "rgba(205,176,122,.35)", COVER) }],
    [endpaper, back],
  ];
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

const COLS = 36;
const GAP = .0045;
const leaves = [];

function makeLeaf(faces, i, n) {
  const hard = faces[0].hard || faces[1].hard;
  const w = hard ? CW : W, h = hard ? CH : H;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array((COLS + 1) * 2 * 3), uv = new Float32Array((COLS + 1) * 2 * 2), idx = [];
  for (let c = 0; c <= COLS; c++) for (let r = 0; r < 2; r++) { const k = c * 2 + r; uv[k * 2] = c / COLS; uv[k * 2 + 1] = r; }
  for (let c = 0; c < COLS; c++) { const a = c * 2, b = a + 1, d = a + 2, e = a + 3; if (S > 0) idx.push(a, d, b, b, d, e); else idx.push(a, b, d, b, e, d); }
  geo.setIndex(idx); geo.setAttribute("position", new THREE.BufferAttribute(pos, 3)); geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));

  const tex = (face, mirror) => {
    const [c, g] = canvasFor(mirror); face.draw(g, c.width, c.height, mirror);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = renderer.capabilities.getMaxAnisotropy(); return t;
  };
  // front is seen from +z before turning; back after. Mirror so text reads correctly.
  const mf = new THREE.MeshStandardMaterial({ map: tex(faces[0], S < 0), side: THREE.FrontSide, roughness: hard ? .55 : .9 });
  const mb = new THREE.MeshStandardMaterial({ map: tex(faces[1], S > 0), side: THREE.BackSide, roughness: hard ? .55 : .9 });
  const front = new THREE.Mesh(geo, mf), backM = new THREE.Mesh(geo, mb);
  front.castShadow = backM.castShadow = true; front.receiveShadow = backM.receiveShadow = true;
  front.userData = { leaf: i, side: 0, kind: faces[0].kind }; backM.userData = { leaf: i, side: 1, kind: faces[1].kind };
  const g = new THREE.Group(); g.add(front, backM); book.add(g);
  const L = { i, n, w, h, hard, geo, group: g, p: 0, shown: 0, meshes: [front, backM] };
  layout(L, 0); return L;
}

function layout(L, p) {
  const { geo, w, h, hard, i, n } = L;
  const pos = geo.attributes.position.array;
  const theta = Math.PI * p;
  const bend = hard ? 0 : -1.15 * Math.sin(Math.PI * p);          // free edge lags behind
  const lift = Math.sin(Math.PI * p) * (hard ? .02 : .05);
  const zRest = (1 - p) * (n - i) * GAP + p * (i + 1) * GAP;
  let x = 0, z = 0; const ds = w / COLS;
  for (let c = 0; c <= COLS; c++) {
    if (c > 0) { const a = theta + bend * ((c - .5) / COLS); x += Math.cos(a) * ds; z += Math.sin(a) * ds; }
    for (let r = 0; r < 2; r++) { const k = (c * 2 + r) * 3; pos[k] = S * x; pos[k + 1] = (r - .5) * h; pos[k + 2] = z + zRest + lift * (c / COLS); }
  }
  geo.attributes.position.needsUpdate = true; geo.computeVertexNormals(); geo.computeBoundingSphere();
}

// ---------- state ----------
let target = 0, offset = 0;
const ui = { count: document.getElementById("count"), hint: document.getElementById("hint") };
function go(t) {
  target = clamp(t, 0, leaves.length);
  ui.count.textContent = `${target} / ${leaves.length}`;
  ui.hint.classList.toggle("off", target !== 0);
  document.body.classList.toggle("closed-back", target === leaves.length);
}
window.bookNext = () => go(target + 1);
window.bookPrev = () => go(target - 1);

// ---------- size / camera fit ----------
function resize() {
  const w = host.clientWidth, h = host.clientHeight;
  if (renderer.domElement.width !== Math.floor(w * renderer.getPixelRatio()) || renderer.domElement.height !== Math.floor(h * renderer.getPixelRatio())) renderer.setSize(w, h);
  camera.aspect = w / h;
  const open = target > 0 && target < leaves.length;
  const needW = (open ? 2 * CW : CW) * 1.3, needH = CH * 1.5;
  const fov = camera.fov * Math.PI / 180;
  const dH = needH / 2 / Math.tan(fov / 2), dW = needW / 2 / (Math.tan(fov / 2) * camera.aspect);
  camera.userData.dist = Math.max(dH, dW);
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);

// ---------- pointer ----------
const ray = new THREE.Raycaster(), m = new THREE.Vector2(), look = { x: 0, y: 0 };
let down = null;
renderer.domElement.addEventListener("pointermove", (e) => {
  const r = renderer.domElement.getBoundingClientRect();
  look.x = (e.clientX - r.left) / r.width * 2 - 1; look.y = (e.clientY - r.top) / r.height * 2 - 1;
  const hit = pick(e); renderer.domElement.style.cursor = hit ? "pointer" : "default";
});
renderer.domElement.addEventListener("pointerdown", (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
renderer.domElement.addEventListener("pointerup", (e) => {
  if (!down) return; const dx = e.clientX - down.x; down = null;
  if (Math.abs(dx) > 40) { (dx * S < 0) ? go(target + 1) : go(target - 1); return; }   // swipe toward spine = next
  const hit = pick(e); if (!hit) return;
  const { kind, leaf, side } = hit.object.userData;
  if (kind === "film" || kind === "back") return window.openFilm && window.openFilm();
  if (side === 0 && leaf === target) go(target + 1);          // unturned page → forward
  else if (side === 1 && leaf === target - 1) go(target - 1); // turned page → back
});
function pick(e) {
  const r = renderer.domElement.getBoundingClientRect();
  m.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(m, camera);
  const hits = ray.intersectObjects(leaves.flatMap((l) => l.meshes), false);
  return hits.find((h) => { const L = leaves[h.object.userData.leaf]; return h.object.userData.side === 0 ? L.p < .5 : L.p >= .5; }) || hits[0];
}
window.addEventListener("keydown", (e) => {
  if (document.body.classList.contains("film-open")) return;
  const fwd = RTL ? "ArrowLeft" : "ArrowRight", bwd = RTL ? "ArrowRight" : "ArrowLeft";
  if (e.key === fwd || e.key === " ") { e.preventDefault(); go(target + 1); }
  else if (e.key === bwd) go(target - 1);
});

// ---------- loop ----------
const clock = new THREE.Clock();
function frame() {
  const dt = Math.min(.05, clock.getDelta()), t = clock.elapsedTime;
  // turn leaves one after another
  for (const L of leaves) {
    const goal = L.i < target ? 1 : 0;
    const speed = L.hard ? 1 / 1.1 : 1 / .95;
    if (L.p !== goal) {
      const ahead = goal ? leaves.slice(0, L.i).every((o) => o.p > .12 || o.i >= target) : leaves.slice(L.i + 1).every((o) => o.p < .88 || o.i < target);
      if (ahead) { L.p = goal ? Math.min(1, L.p + dt * speed) : Math.max(0, L.p - dt * speed); layout(L, ease(L.p)); }
    }
  }
  // keep the composition centred like a postcard
  const want = target === 0 ? -S * CW / 2 : target === leaves.length ? S * CW / 2 : 0;
  offset += (want - offset) * Math.min(1, dt * 3.2); book.position.x = offset;
  resize();
  const dist = camera.userData.dist;
  camera.position.lerp(new THREE.Vector3(look.x * .25, -look.y * .12 + .05, dist), Math.min(1, dt * 2.5));
  camera.lookAt(0, 0, 0);
  book.position.y = Math.sin(t * .8) * .006;
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

// ---------- boot ----------
(async () => {
  await Promise.race([new Promise((r) => setTimeout(r, 2500)), Promise.all([document.fonts.load(`400 100px "${DISPLAY}"`, "מטר Matar"), document.fonts.load(`400 30px "${SMALL}"`), document.fonts.load(`700 40px "Noto Sans JP"`)]).catch(() => {})]);
  const faces = await buildFaces();
  faces.forEach((f, i) => leaves.push(makeLeaf(f, i, faces.length)));
  offset = -S * CW / 2; go(0); resize(); camera.position.set(0, 0, camera.userData.dist * 1.25);
  document.body.classList.add("ready");
  frame();
})();
