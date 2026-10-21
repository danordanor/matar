import * as THREE from "./lib/three.module.min.js";

const T = window.BOOK;
const RTL = T.dir === "rtl";
const S = RTL ? -1 : 1;                 // side the leaves lie on before turning
const BASE = T.base;
const $ = (id) => document.getElementById(id);

// ---------- look ----------
const CLOTH = "#FFCF1A", INKL = "#16140f", SUBL = "rgba(22,20,15,.62)", FONT = "Swiss";
const W = 1, H = 1.38, CW = 1.035, CH = 1.42, GAP = .022;
const TEX_W = 1024, TEX_H = Math.round(TEX_W * CH / CW);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ease = (x) => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const loadImg = (src) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = src; });

function canvasFor(mirror) {
  const c = document.createElement("canvas"); c.width = TEX_W; c.height = TEX_H;
  const g = c.getContext("2d"); if (mirror) { g.translate(TEX_W, 0); g.scale(-1, 1); }
  return [c, g];
}
function cloth(g, w, h) {
  g.fillStyle = CLOTH; g.fillRect(0, 0, w, h);
  const id = g.getImageData(0, 0, w, h), d = id.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {          // fine linen weave
    const i = (y * w + x) * 4, n = (Math.random() - .5) * 9 + ((x % 3 === 0) ? 2.5 : 0) + ((y % 3 === 0) ? -2.5 : 0);
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  g.putImageData(id, 0, 0);
}
function txt(g, s, x, y, size, weight = 400, color = INKL, align = "start", track = 0) {
  g.save(); g.font = `${weight} ${size}px "${FONT}"`; g.fillStyle = color; g.direction = T.dir; g.textAlign = align; g.textBaseline = "alphabetic";
  if (track) g.letterSpacing = track + "px"; g.fillText(s, x, y); g.restore();
}
function wrap(g, s, x, y, maxW, size, lh, weight = 400, color = INKL) {
  g.save(); g.font = `${weight} ${size}px "${FONT}"`; g.direction = T.dir;
  const words = s.split(" "), lines = []; let line = "";
  for (const w of words) { const t = line ? line + " " + w : w; if (g.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; }
  lines.push(line); g.restore();
  lines.forEach((l, i) => txt(g, l, x, y + i * lh, size, weight, color));
  return lines.length;
}

const SHOTS = [6, 18, 44, 58, 72, 86, 100, 114, 128, 146];
const PAPER = "#f5f3ef", INK = "#141414", GREY = "#8c8a85";
async function faces() {
  const imgs = await Promise.all(SHOTS.map((s) => loadImg(`${BASE}f/${s}.jpg`)));
  const IMG = Object.fromEntries(SHOTS.map((s, i) => [s, imgs[i]]));
  const DUO = await Promise.all(Array.from({ length: 18 }, (_, i) => loadImg(`${BASE}d/${String(i + 1).padStart(2, "0")}.jpg`)));
  const M = 92;
  const sx = (w) => RTL ? w - M : M;
  const front = (g, w, h) => {
    cloth(g, w, h);
    txt(g, T.label, sx(w), M + 30, 30, 400, SUBL);
    g.font = `500 150px "${FONT}"`; const tw = Math.max(g.measureText(T.name + ",").width, g.measureText(T.sub + ".").width);
    const ts = Math.min(150, 150 * (w - 2 * M) / (tw + 20));
    txt(g, T.name + ",", sx(w), M + 110 + ts, ts, 500, INKL, "start", -ts / 50);
    txt(g, T.sub + ".", sx(w), M + 110 + ts * 2, ts, 500, INKL, "start", -ts / 50);
    const cols = 3, gap = 12, gw = w - 2 * M, cw = (gw - gap * (cols - 1)) / cols, ch = cw * 9 / 16, y0 = h - M - 120 - 2 * ch - gap;
    [6, 18, 58, 86, 114, 146].map((k) => IMG[k]).forEach((im, i) => {
      if (!im) return; const c = i % cols, r = Math.floor(i / cols);
      const x = RTL ? w - M - (c + 1) * cw - c * gap : M + c * (cw + gap), y = y0 + r * (ch + gap);
      const k = Math.max(cw / im.width, ch / im.height);
      g.save(); g.beginPath(); g.rect(x, y, cw, ch); g.clip(); g.drawImage(im, x + (cw - im.width * k) / 2, y + (ch - im.height * k) / 2, im.width * k, im.height * k); g.restore();
    });
    txt(g, T.credit, sx(w), h - M, 28, 400, SUBL);
  };
  const back = (g, w, h) => {
    cloth(g, w, h);
    txt(g, T.blurbLabel, sx(w), M + 30, 30, 400, SUBL);
    wrap(g, T.blurb, sx(w), M + 190, w - 2 * M, 54, 76, 400);
    txt(g, T.again + "  " + (RTL ? "←" : "→"), sx(w), h - M - 90, 36, 500);
    txt(g, T.credit, sx(w), h - M, 28, 400, SUBL);
  };
  const dark = (g, w, h) => { g.fillStyle = "#232220"; g.fillRect(0, 0, w, h); };
  const paperCache = {};
  const paper = (g, w, h) => {
    const key = w + "x" + h;
    if (!paperCache[key]) { const c = document.createElement("canvas"); c.width = w; c.height = h; const q = c.getContext("2d"); q.fillStyle = PAPER; q.fillRect(0, 0, w, h); const id = q.getImageData(0, 0, w, h), d = id.data; for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - .5) * 5; d[i] += n; d[i + 1] += n; d[i + 2] += n; } q.putImageData(id, 0, 0); paperCache[key] = c; }
    g.drawImage(paperCache[key], 0, 0);
  };
  const folio = (g, w, h, n) => txt(g, String(n).padStart(2, "0"), sx(w), M + 24, 26, 400, GREY);
  // the inside of a board: paper with a cloth rim where the board is larger than the page
  const boardPaper = (g, w, h) => {
    paper(g, w, h); const rx = Math.round(w * (CW - W) / CW), ry = Math.round(h * (CH - H) / CH / 2);
    g.fillStyle = "#232220"; g.fillRect(RTL ? w - rx : 0, 0, rx, h); g.fillRect(0, 0, w, ry); g.fillRect(0, h - ry, w, ry);
    return { rx, ry };
  };
  // scattered photos, full frame (never cropped), each drifting very slightly
  const LAYOUT = [ // [shot, cx, cy, width, angle]  in page fractions
    [6,   .30, .14, .50, -4], [18, .70, .20, .52, 3], [44, .34, .34, .50, 2.5],
    [72,  .68, .44, .54, -3], [58, .30, .57, .50, -2], [114, .70, .67, .52, 3.5],
    [146, .40, .82, .56, -1.5],
  ];
  const scatter = { kind: "page", live: true, draw: (g, w, h, t = 0) => {
    const { rx, ry } = boardPaper(g, w, h);
    const iw0 = w - rx;                                   // the paper part of the board
    const ox = RTL ? 0 : rx;
    LAYOUT.forEach(([shot, cx, cy, fw, ang], i) => {
      const im = IMG[shot]; if (!im) return;
      const pw = fw * iw0, ph = pw * im.height / im.width;
      const bob = Math.sin(t * .6 + i * 1.7) * 6, tilt = Math.sin(t * .4 + i) * .6;
      g.save(); g.translate(ox + cx * iw0, ry + cy * (h - 2 * ry) + bob); g.rotate((ang + tilt) * Math.PI / 180);
      g.shadowColor = "rgba(0,0,0,.18)"; g.shadowBlur = 18; g.shadowOffsetY = 6;
      g.fillStyle = "#fff"; g.fillRect(-pw / 2 - 12, -ph / 2 - 12, pw + 24, ph + 24);
      g.shadowColor = "transparent"; g.drawImage(im, -pw / 2, -ph / 2, pw, ph); g.restore();
    });
  } };
  // a blessing page: who it is from, the words, the signature
  const blessing = (b, onBoard) => ({ kind: "page", draw: (g, w, h) => {
    if (onBoard) boardPaper(g, w, h); else paper(g, w, h);
    txt(g, b.label, sx(w), M + 24, 26, 400, GREY);
    txt(g, b.title, sx(w), M + 190, 92, 600, INK, "start", -2);
    const n = wrap(g, b.body, sx(w), M + 300, w - 2 * M, 44, 66, 400, "#2c2b28");
    txt(g, b.sign, sx(w), h - M - 10, 40, 500, INK);
  } });
  // Iyar and Matar together: a loose 3 × 3 grid of full photos per page, each gently drifting
  const duoPage = (list, seed) => ({ kind: "page", live: true, draw: (g, w, h, t = 0) => {
    paper(g, w, h);
    const cols = 3, rows = 3, mx = 56, my = 70, cw = (w - 2 * mx) / cols, ch = (h - 2 * my - 40) / rows;
    list.forEach((im, i) => {
      if (!im) return; const c = i % cols, r = Math.floor(i / cols);
      const k = Math.min(cw * .86 / im.width, ch * .86 / im.height), pw = im.width * k, ph = im.height * k;
      const rnd = (n) => Math.sin((i + 1) * 12.9898 + seed * 78.233 + n) * .5;     // stable jitter per photo
      const cx = mx + (RTL ? cols - 1 - c : c) * cw + cw / 2 + rnd(1) * 18, cy = my + r * ch + ch / 2 + rnd(2) * 14;
      const ang = rnd(3) * 7 + Math.sin(t * .5 + i * 1.3) * .5, bob = Math.sin(t * .6 + i * 1.7) * 3;
      g.save(); g.translate(cx, cy + bob); g.rotate(ang * Math.PI / 180);
      g.shadowColor = "rgba(0,0,0,.16)"; g.shadowBlur = 14; g.shadowOffsetY = 5;
      g.fillStyle = "#fff"; g.fillRect(-pw / 2 - 9, -ph / 2 - 9, pw + 18, ph + 18);
      g.shadowColor = "transparent"; g.drawImage(im, -pw / 2, -ph / 2, pw, ph); g.restore();
    });
    txt(g, T.duo, sx(w), h - 40, 24, 400, GREY);
  } });
  const [parents, meidan, iyar] = T.bless;
  // leaf = [front, back]; spread k shows [leaf k-1 back (right), leaf k front (left)]
  return [
    [{ kind: "front", draw: front, hard: true }, scatter],
    [blessing(parents), blessing(meidan)],
    [blessing(iyar), duoPage(DUO.slice(0, 9), 1)],
    [duoPage(DUO.slice(9), 2), { kind: "inner", draw: dark }],
    [{ kind: "inner", draw: dark, hard: true }, { kind: "back", draw: back, hard: true }],
  ];
}

// ---------- scene ----------
const host = $("book");
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
host.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(28, 1, .1, 50);
scene.add(new THREE.HemisphereLight(0xffffff, 0xeeeeee, 2.3));
const sun = new THREE.DirectionalLight(0xffffff, 1.4);
sun.position.set(-1.6, 2.2, 3.2); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -.0005;
Object.assign(sun.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: .5, far: 10 });
scene.add(sun);

const stage = new THREE.Group(); scene.add(stage);
const wall = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.ShadowMaterial({ opacity: .11 }));
wall.position.z = -.16; wall.receiveShadow = true; scene.add(wall);
const book = new THREE.Group(); stage.add(book);

// leaves: two cloth boards and paper pages that bend as they turn
const leaves = [], live = [];
const COLS = 28, PGAP = .005;
function makeLeaf(f, i, n) {
  const hard = !!(f[0].hard || f[1].hard), w = hard ? CW : W, h = hard ? CH : H;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array((COLS + 1) * 6), uv = new Float32Array((COLS + 1) * 4), idx = [];
  for (let c = 0; c <= COLS; c++) for (let r = 0; r < 2; r++) { const k = c * 2 + r; uv[k * 2] = c / COLS; uv[k * 2 + 1] = r; }
  for (let c = 0; c < COLS; c++) { const a = c * 2, b = a + 1, d = a + 2, e = a + 3; if (S > 0) idx.push(a, d, b, b, d, e); else idx.push(a, b, d, b, e, d); }
  geo.setIndex(idx); geo.setAttribute("position", new THREE.BufferAttribute(pos, 3)); geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  const tex = (face, mirror) => {
    const c = document.createElement("canvas"); c.width = TEX_W; c.height = Math.round(c.width * h / w); const g = c.getContext("2d"); if (mirror) { g.translate(c.width, 0); g.scale(-1, 1); }
    face.draw(g, c.width, c.height, 0);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    if (face.live) live.push({ face, g, c, t, leaf: i });
    return t;
  };
  const mf = new THREE.MeshStandardMaterial({ map: tex(f[0], S < 0), roughness: hard ? .85 : .95, side: THREE.FrontSide });
  const mb = new THREE.MeshStandardMaterial({ map: tex(f[1], S > 0), roughness: hard ? .85 : .95, side: THREE.BackSide });
  const a = new THREE.Mesh(geo, mf), b = new THREE.Mesh(geo, mb);
  a.castShadow = b.castShadow = true; a.receiveShadow = b.receiveShadow = true;
  a.userData = { kind: f[0].kind, leaf: i, side: 0 }; b.userData = { kind: f[1].kind, leaf: i, side: 1 };
  book.add(a, b);
  const L = { i, n, w, h, hard, geo, p: 0, meshes: [a, b] }; place(L, 0); return L;
}
const zOf = (L, p) => (1 - p) * (L.n - L.i) * PGAP + p * (L.i + 1) * PGAP;
function place(L, p) {
  const pos = L.geo.attributes.position.array, theta = Math.PI * p;
  const bend = L.hard ? 0 : -1.1 * Math.sin(Math.PI * p), lift = Math.sin(Math.PI * p) * (L.hard ? .02 : .045);
  const z0 = zOf(L, p); let x = 0, z = 0; const ds = L.w / COLS;
  for (let c = 0; c <= COLS; c++) {
    if (c) { const a = theta + bend * ((c - .5) / COLS); x += Math.cos(a) * ds; z += Math.sin(a) * ds; }
    for (let r = 0; r < 2; r++) { const k = (c * 2 + r) * 3; pos[k] = S * x; pos[k + 1] = (r - .5) * L.h; pos[k + 2] = z + z0 + lift * (c / COLS); }
  }
  L.geo.attributes.position.needsUpdate = true; L.geo.computeVertexNormals(); L.geo.computeBoundingSphere();
}

// the spine, seen while the book is closed
const spine = new THREE.Mesh(new THREE.BoxGeometry(.012, CH, 1), new THREE.MeshStandardMaterial({ color: 0xE9B800, roughness: .8 }));
spine.castShadow = true; book.add(spine);

// ---------- the film, printed across the open spread ----------
const video = $("film");
const SRC = `${BASE}v/index.m3u8`;
if (video.canPlayType("application/vnd.apple.mpegurl")) video.src = SRC;
else if (window.Hls && Hls.isSupported()) { const h = new Hls({ maxBufferLength: 30 }); h.loadSource(SRC); h.attachMedia(video); }
else video.src = SRC;
const vtex = new THREE.VideoTexture(video); vtex.colorSpace = THREE.SRGBColorSpace;
const ptex = new THREE.TextureLoader().load(`${BASE}poster.jpg`); ptex.colorSpace = THREE.SRGBColorSpace;
const crop = (t) => { const k = (2 * W / H) / (16 / 9); t.repeat.set(k, 1); t.offset.set((1 - k) / 2, 0); return t; };
crop(vtex); crop(ptex);
const filmMat = new THREE.MeshBasicMaterial({ map: ptex, transparent: true, opacity: 0, toneMapped: false });
const film = new THREE.Mesh(new THREE.PlaneGeometry(2 * W, H), filmMat);
 film.userData.kind = "film"; book.add(film);
video.addEventListener("playing", () => { filmMat.map = vtex; filmMat.needsUpdate = true; }, { once: true });
// the soft fold in the middle of the spread
const gc = document.createElement("canvas"); gc.width = 512; gc.height = 4; { const g = gc.getContext("2d"); const gr = g.createLinearGradient(0, 0, 512, 0);
  gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(.44, "rgba(0,0,0,.05)"); gr.addColorStop(.5, "rgba(0,0,0,.32)"); gr.addColorStop(.56, "rgba(0,0,0,.05)"); gr.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gr; g.fillRect(0, 0, 512, 4); }
const gutterMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(gc), transparent: true, opacity: 0, depthWrite: false });
const gutter = new THREE.Mesh(new THREE.PlaneGeometry(.5, H), gutterMat);  book.add(gutter);

// ---------- state ----------
// 0 = front cover · 1..FILM-1 = pages · FILM = the film across the spread · END = back cover (the story)
let state = 0, FILM = 6, END = 7;
const body = document.body, hint = $("hint");
const name = (s) => s === 0 ? "front" : s === END ? "back" : s === FILM ? "open" : "pages";
function go(s, opts = {}) {
  state = clamp(s, 0, END);
  body.dataset.state = name(state);
  hint.textContent = hint.dataset[name(state)] || hint.dataset.open;
  $("left").disabled = RTL ? state === END : state === 0;
  $("right").disabled = RTL ? state === 0 : state === END;
  if (state === FILM) { if (opts.restart || video.ended) video.currentTime = 0; video.play().catch(() => {}); }
  else video.pause();
}
window.bookGo = go;
// turn the pages by themselves once the book is open, until the video; any manual move restarts the wait
const AUTO = 7;
let autoT = 0;
const userMove = () => { autoT = 0; };
addEventListener("pointerdown", userMove); addEventListener("keydown", userMove);
const next = () => go(state + 1), prev = () => go(state - 1);
$("left").onclick = () => (RTL ? next() : prev());
$("right").onclick = () => (RTL ? prev() : next());
$("openBook").onclick = () => go(1);
$("closeBook").onclick = () => go(0);
$("watch").onclick = () => go(FILM, { restart: state !== FILM });
$("full").onclick = () => { const el = document.documentElement; if (document.fullscreenElement || document.webkitFullscreenElement) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); } else if (el.requestFullscreen) el.requestFullscreen(); else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen(); };
const wave = $("wave");
$("mute").onclick = () => { video.muted = !video.muted; wave.style.opacity = video.muted ? 0 : 1; };
video.addEventListener("ended", () => setTimeout(() => go(END), 700));

// status bar line: film time when open, place in the book otherwise
const fmt = (s) => { s = Math.max(0, Math.floor(s || 0)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };
const pa = $("pa"), pb = $("pb"), fill = $("fill"), track = $("track");
function bar() {
  if (state === FILM) {
    const d = video.duration || 158.6;
    pa.textContent = fmt(video.currentTime); pb.textContent = fmt(d);
    fill.style.width = clamp(video.currentTime / d) * 100 + "%"; fill.classList.add("thick");
  } else { pa.textContent = state === 0 ? T.p_front : state === END ? T.p_back : "עמוד " + state; pb.textContent = ""; fill.style.width = state / END * 100 + "%"; fill.classList.remove("thick"); }
}
let scrub = false;
const seekAt = (e) => { const r = track.getBoundingClientRect(); const p = clamp((e.clientX - r.left) / r.width); if (state === FILM && video.duration) video.currentTime = p * video.duration; };
track.addEventListener("pointerdown", (e) => { if (state !== FILM) return; scrub = true; track.setPointerCapture(e.pointerId); seekAt(e); });
track.addEventListener("pointermove", (e) => { if (scrub) seekAt(e); });
track.addEventListener("pointerup", () => { scrub = false; });

// ---------- pointer on the book ----------
const ray = new THREE.Raycaster(), m = new THREE.Vector2(), look = { x: 0, y: 0 };
function pick(e) {
  const r = renderer.domElement.getBoundingClientRect();
  m.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(m, camera);
  return ray.intersectObjects([film, ...leaves.flatMap((l) => l.meshes)], false).filter((h) => h.object !== film || filmMat.opacity > .5)[0];
}
let down = null;
renderer.domElement.addEventListener("pointermove", (e) => {
  const r = renderer.domElement.getBoundingClientRect();
  look.x = (e.clientX - r.left) / r.width * 2 - 1; look.y = (e.clientY - r.top) / r.height * 2 - 1;
  renderer.domElement.style.cursor = pick(e) ? "pointer" : "default";
});
renderer.domElement.addEventListener("pointerdown", (e) => { down = { x: e.clientX }; });
renderer.domElement.addEventListener("pointerup", (e) => {
  if (!down) return; const dx = e.clientX - down.x; down = null;
  if (Math.abs(dx) > 40) return (dx < 0) === RTL ? prev() : next();   // drag the paper
  const hit = pick(e); if (!hit) return;
  const { kind, leaf, side } = hit.object.userData;
  if (kind === "film") return video.paused ? video.play() : video.pause();
  if (kind === "back") return go(FILM, { restart: true });
  if (side === 0 && leaf === state) next();            // the page waiting to be turned
  else if (side === 1 && leaf === state - 1) prev();    // the page just turned
  else if (kind === "front") next();
});
addEventListener("keydown", (e) => {
  if (e.key === " ") { e.preventDefault(); state === FILM ? (video.paused ? video.play() : video.pause()) : next(); }
  else if (e.key === "ArrowLeft") RTL ? next() : prev();
  else if (e.key === "ArrowRight") RTL ? prev() : next();
  else if (e.key === "Escape") go(0);
});

// ---------- frame ----------
function fit() {
  const w = host.clientWidth, h = host.clientHeight, pr = renderer.getPixelRatio();
  if (renderer.domElement.width !== Math.floor(w * pr) || renderer.domElement.height !== Math.floor(h * pr)) renderer.setSize(w, h);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  const open = state > 0 && state < END, f = Math.tan(camera.fov * Math.PI / 360);
  const needW = open ? 2 * CW * 1.16 : CW * 1.75, needH = CH * (open ? 1.18 : 1.3);
  return Math.max(needH / 2 / f, needW / 2 / (f * camera.aspect));
}
const clock = new THREE.Clock(), goal = new THREE.Vector3();
let offset = -S * CW / 2, yaw = -S * .42;
function frame() {
  const dt = Math.min(.05, clock.getDelta());
  // turn leaves one after another
  for (const L of leaves) {
    const g = L.i < state ? 1 : 0; if (L.p === g) continue;
    const ready = g ? leaves.every((o) => o.i >= L.i || o.i >= state || o.p > .25) : leaves.every((o) => o.i <= L.i || o.i < state || o.p < .75);
    if (!ready) continue;
    const sp = L.hard ? 1 / 1.15 : 1 / .9;
    L.p = g ? Math.min(1, L.p + dt * sp) : Math.max(0, L.p - dt * sp); place(L, ease(L.p));
  }
  const resting = leaves.every((L) => L.p === 0 || L.p === 1);
  const closed = (state === 0 || state === END);
  spine.visible = closed || !resting;
  spine.scale.z = (leaves.length - 1) * PGAP + .004; spine.position.set(-S * .006, 0, (leaves.length + 1) / 2 * PGAP);
  const filmOn = state === FILM && resting;
  film.position.z = gutter.position.z = leaves.length * PGAP + .004;
  filmMat.opacity += ((filmOn ? 1 : 0) - filmMat.opacity) * Math.min(1, dt * (filmOn ? 4 : 10));
  gutterMat.opacity = filmMat.opacity; film.visible = gutter.visible = filmMat.opacity > .01;

  const wantOff = state === 0 ? -S * CW / 2 : state === END ? S * CW / 2 : 0;
  offset += (wantOff - offset) * Math.min(1, dt * 3.2); book.position.x = offset;
  const wantYaw = state === 0 ? -S * .42 : state === END ? S * .42 : 0;
  const calm = state === FILM ? .3 : 1;
  yaw += (wantYaw - yaw) * Math.min(1, dt * 3); stage.rotation.y = yaw + look.x * .05 * calm;
  stage.rotation.x = look.y * .03 * calm;
  goal.set(0, 0, fit()); camera.position.lerp(goal, Math.min(1, dt * 3)); camera.lookAt(0, 0, 0);
  for (const L of live) { const lf = leaves[L.leaf]; if (Math.abs(L.leaf - state) <= 1 || (lf.p > 0 && lf.p < 1)) { L.face.draw(L.g, L.c.width, L.c.height, clock.elapsedTime); L.t.needsUpdate = true; } }
  if (state > 0 && state < FILM && leaves.every((L) => L.p === 0 || L.p === 1)) { autoT += dt; if (autoT > AUTO) { autoT = 0; go(state + 1); } } else autoT = 0;
  if (!scrub) bar();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

(async () => {
  await Promise.race([new Promise((r) => setTimeout(r, 2500)), Promise.all([document.fonts.load(`500 100px "${FONT}"`, "מטר Matar"), document.fonts.load(`400 30px "${FONT}"`, "מטר Matar")]).catch(() => {})]);
  const F = await faces(); F.forEach((f, i) => leaves.push(makeLeaf(f, i, F.length))); END = F.length; FILM = END - 1;
  go(0); camera.position.set(0, 0, fit() * 1.3);
  body.classList.add("ready");
  frame();
})();
