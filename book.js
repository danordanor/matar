import * as THREE from "./lib/three.module.min.js";

const T = window.BOOK;
const RTL = T.dir === "rtl";
const S = RTL ? -1 : 1;                 // side the leaves lie on before turning
const BASE = T.base;
const $ = (id) => document.getElementById(id);

// ---------- look ----------
const CLOTH = "#2c2b28", INKL = "#dcd8cf", FONT = "Swiss";
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

const SHOTS = [6, 18, 58, 86, 114, 146];
async function faces() {
  const imgs = await Promise.all(SHOTS.map((s) => loadImg(`${BASE}f/${s}.jpg`)));
  const M = 92;                                     // page margin
  const sx = (w) => RTL ? w - M : M;                // start x for text
  const front = (g, w, h) => {
    cloth(g, w, h);
    txt(g, T.label, sx(w), M + 30, 30, 400, "rgba(220,216,207,.75)");
    g.font = `500 150px "${FONT}"`; const tw = Math.max(g.measureText(T.name + ",").width, g.measureText(T.sub + ".").width);
    const ts = Math.min(150, 150 * (w - 2 * M) / (tw + 20));
    txt(g, T.name + ",", sx(w), M + 110 + ts, ts, 500, INKL, "start", -ts / 50);
    txt(g, T.sub + ".", sx(w), M + 110 + ts * 2, ts, 500, INKL, "start", -ts / 50);
    // six small frames in a 3 × 2 grid
    const cols = 3, gap = 12, gw = w - 2 * M, cw = (gw - gap * (cols - 1)) / cols, ch = cw * 9 / 16, y0 = h - M - 120 - 2 * ch - gap;
    imgs.forEach((im, i) => {
      if (!im) return; const c = i % cols, r = Math.floor(i / cols);
      const x = RTL ? w - M - (c + 1) * cw - c * gap : M + c * (cw + gap), y = y0 + r * (ch + gap);
      const k = Math.max(cw / im.width, ch / im.height);
      g.save(); g.beginPath(); g.rect(x, y, cw, ch); g.clip(); g.drawImage(im, x + (cw - im.width * k) / 2, y + (ch - im.height * k) / 2, im.width * k, im.height * k); g.restore();
    });
    txt(g, T.credit, sx(w), h - M, 28, 400, "rgba(220,216,207,.75)");
  };
  const back = (g, w, h) => {
    cloth(g, w, h);
    txt(g, T.blurbLabel, sx(w), M + 30, 30, 400, "rgba(220,216,207,.75)");
    wrap(g, T.blurb, sx(w), M + 190, w - 2 * M, 54, 76, 400);
    txt(g, T.again + "  " + (RTL ? "←" : "→"), sx(w), h - M - 90, 36, 500);
    txt(g, T.credit, sx(w), h - M, 28, 400, "rgba(220,216,207,.75)");
  };
  const inner = (g, w, h) => { g.fillStyle = "#232220"; g.fillRect(0, 0, w, h); };
  return [[{ kind: "front", draw: front }, { kind: "inner", draw: inner }], [{ kind: "inner", draw: inner }, { kind: "back", draw: back }]];
}

// ---------- scene ----------
const host = $("book");
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.VSMShadowMap;
host.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(28, 1, .1, 50);
scene.add(new THREE.HemisphereLight(0xffffff, 0xe8e8e8, 1.9));
const sun = new THREE.DirectionalLight(0xffffff, 1.4);
sun.position.set(-1.6, 2.2, 3.2); sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024); sun.shadow.radius = 14; sun.shadow.blurSamples = 20; sun.shadow.bias = -.0005;
Object.assign(sun.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: .5, far: 10 });
scene.add(sun);

const stage = new THREE.Group(); scene.add(stage);
const wall = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.ShadowMaterial({ opacity: .11 }));
wall.position.z = -.16; wall.receiveShadow = true; scene.add(wall);
const book = new THREE.Group(); stage.add(book);

// the two boards of a hardcover
const leaves = [];
function makeLeaf(f, i, n) {
  const geo = new THREE.PlaneGeometry(CW, CH, 1, 1); geo.translate(S * CW / 2, 0, 0);
  const tex = (face, mirror) => { const [c, g] = canvasFor(mirror); face.draw(g, c.width, c.height); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = renderer.capabilities.getMaxAnisotropy(); return t; };
  if (S < 0) { const uv = geo.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setX(k, 1 - uv.getX(k)); }   // keep u=0 at the spine
  const mf = new THREE.MeshStandardMaterial({ map: tex(f[0], S < 0), roughness: .85, side: THREE.FrontSide });
  const mb = new THREE.MeshStandardMaterial({ map: tex(f[1], S > 0), roughness: .85, side: THREE.BackSide });
  const pivot = new THREE.Group(); book.add(pivot);
  const a = new THREE.Mesh(geo, mf), b = new THREE.Mesh(geo, mb);
  a.castShadow = b.castShadow = true;
  a.userData.kind = f[0].kind; b.userData.kind = f[1].kind;
  pivot.add(a, b);
  const L = { i, n, pivot, p: 0, meshes: [a, b] }; place(L, 0); return L;
}
function place(L, p) {
  L.pivot.rotation.y = -S * Math.PI * p;                                   // hinge at the spine
  L.pivot.position.z = (1 - p) * (L.n - L.i) * GAP + p * (L.i + 1) * GAP + Math.sin(Math.PI * p) * .02;
}

// spine + page block, while the book rests closed
const spine = new THREE.Mesh(new THREE.BoxGeometry(.012, CH, GAP + .004), new THREE.MeshStandardMaterial({ color: 0x252422, roughness: .9 }));
spine.position.set(-S * .006, 0, 1.5 * GAP); spine.castShadow = true; book.add(spine);
const pages = new THREE.Mesh(new THREE.BoxGeometry(W - .01, H - .02, GAP * .86), new THREE.MeshStandardMaterial({ color: 0xf2efe8, roughness: 1 }));
pages.position.z = 1.5 * GAP; pages.castShadow = true; book.add(pages);

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
film.position.z = GAP + .002; film.userData.kind = "film"; book.add(film);
video.addEventListener("playing", () => { filmMat.map = vtex; filmMat.needsUpdate = true; }, { once: true });
// the soft fold in the middle of the spread
const gc = document.createElement("canvas"); gc.width = 512; gc.height = 4; { const g = gc.getContext("2d"); const gr = g.createLinearGradient(0, 0, 512, 0);
  gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(.44, "rgba(0,0,0,.05)"); gr.addColorStop(.5, "rgba(0,0,0,.32)"); gr.addColorStop(.56, "rgba(0,0,0,.05)"); gr.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gr; g.fillRect(0, 0, 512, 4); }
const gutterMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(gc), transparent: true, opacity: 0, depthWrite: false });
const gutter = new THREE.Mesh(new THREE.PlaneGeometry(.5, H), gutterMat); gutter.position.z = GAP + .003; book.add(gutter);

// ---------- state ----------
let state = 0;                                   // 0 front · 1 open (film) · 2 back (story)
const body = document.body, hint = $("hint");
const NAMES = ["front", "open", "back"], LABELS = [T.p_front, T.p_open, T.p_back];
function go(s, opts = {}) {
  state = clamp(s, 0, 2);
  body.dataset.state = NAMES[state];
  hint.textContent = hint.dataset[NAMES[state]];
  $("left").disabled = RTL ? state === 2 : state === 0;
  $("right").disabled = RTL ? state === 0 : state === 2;
  if (state === 1) { if (opts.restart || video.ended) video.currentTime = 0; video.play().catch(() => {}); }
  else video.pause();
}
window.bookGo = go;
const next = () => go(state + 1), prev = () => go(state - 1);
$("left").onclick = () => (RTL ? next() : prev());
$("right").onclick = () => (RTL ? prev() : next());
$("openBook").onclick = () => go(1);
$("closeBook").onclick = () => go(0);
$("watch").onclick = () => go(1, { restart: state !== 1 });
$("full").onclick = () => { if (state !== 1) go(1); if (video.requestFullscreen) video.requestFullscreen(); else if (video.webkitEnterFullscreen) video.webkitEnterFullscreen(); };
const wave = $("wave");
$("mute").onclick = () => { video.muted = !video.muted; wave.style.opacity = video.muted ? 0 : 1; };
video.addEventListener("ended", () => setTimeout(() => go(2), 700));

// status bar line: film time when open, place in the book otherwise
const fmt = (s) => { s = Math.max(0, Math.floor(s || 0)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };
const pa = $("pa"), pb = $("pb"), fill = $("fill"), track = $("track");
function bar() {
  if (state === 1) {
    const d = video.duration || 158.6;
    pa.textContent = fmt(video.currentTime); pb.textContent = fmt(d);
    fill.style.width = clamp(video.currentTime / d) * 100 + "%"; fill.classList.add("thick");
  } else { pa.textContent = LABELS[state]; pb.textContent = "3"; fill.style.width = (state === 2 ? 100 : 12) + "%"; fill.classList.remove("thick"); }
}
let scrub = false;
const seekAt = (e) => { const r = track.getBoundingClientRect(); const p = clamp((e.clientX - r.left) / r.width); if (state === 1 && video.duration) video.currentTime = p * video.duration; };
track.addEventListener("pointerdown", (e) => { if (state !== 1) return; scrub = true; track.setPointerCapture(e.pointerId); seekAt(e); });
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
  const k = hit.object.userData.kind;
  if (k === "front") go(1);
  else if (k === "back") go(1, { restart: true });
  else if (k === "film") video.paused ? video.play() : video.pause();
});
addEventListener("keydown", (e) => {
  if (e.key === " ") { e.preventDefault(); state === 1 ? (video.paused ? video.play() : video.pause()) : go(1); }
  else if (e.key === "ArrowLeft") RTL ? next() : prev();
  else if (e.key === "ArrowRight") RTL ? prev() : next();
  else if (e.key === "Escape" && state === 1) go(0);
});

// ---------- frame ----------
function fit() {
  const w = host.clientWidth, h = host.clientHeight, pr = renderer.getPixelRatio();
  if (renderer.domElement.width !== Math.floor(w * pr) || renderer.domElement.height !== Math.floor(h * pr)) renderer.setSize(w, h);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  const open = state === 1, f = Math.tan(camera.fov * Math.PI / 360);
  const needW = open ? 2 * CW * 1.16 : CW * 1.75, needH = CH * (open ? 1.18 : 1.3);
  return Math.max(needH / 2 / f, needW / 2 / (f * camera.aspect));
}
const clock = new THREE.Clock(), goal = new THREE.Vector3();
let offset = -S * CW / 2, yaw = -S * .42;
function frame() {
  const dt = Math.min(.05, clock.getDelta());
  for (const L of leaves) {
    const g = L.i < state ? 1 : 0;
    if (L.p !== g) { L.p = g ? Math.min(1, L.p + dt / 1.15) : Math.max(0, L.p - dt / 1.15); place(L, ease(L.p)); }
  }
  const resting = leaves.every((L) => L.p === 0 || L.p === 1);
  const open = state === 1 && resting;
  pages.visible = spine.visible = !open;
  pages.position.x = (leaves[0].p > .5 && leaves[1].p > .5 ? -S : S) * W / 2;
  filmMat.opacity += ((open ? 1 : 0) - filmMat.opacity) * Math.min(1, dt * (open ? 4 : 10));
  gutterMat.opacity = filmMat.opacity; film.visible = gutter.visible = filmMat.opacity > .01;

  const wantOff = state === 0 ? -S * CW / 2 : state === 2 ? S * CW / 2 : 0;
  offset += (wantOff - offset) * Math.min(1, dt * 3.2); book.position.x = offset;
  const wantYaw = state === 0 ? -S * .42 : state === 2 ? S * .42 : 0;
  const calm = state === 1 ? .3 : 1;
  yaw += (wantYaw - yaw) * Math.min(1, dt * 3); stage.rotation.y = yaw + look.x * .05 * calm;
  stage.rotation.x = look.y * .03 * calm;
  goal.set(0, 0, fit()); camera.position.lerp(goal, Math.min(1, dt * 3)); camera.lookAt(0, 0, 0);
  if (!scrub) bar();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

(async () => {
  await Promise.race([new Promise((r) => setTimeout(r, 2500)), Promise.all([document.fonts.load(`500 100px "${FONT}"`, "מטר Matar"), document.fonts.load(`400 30px "${FONT}"`, "מטר Matar")]).catch(() => {})]);
  (await faces()).forEach((f, i, all) => leaves.push(makeLeaf(f, i, all.length)));
  go(0); camera.position.set(0, 0, fit() * 1.3);
  body.classList.add("ready");
  frame();
})();
