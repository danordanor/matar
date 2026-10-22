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
const loadImg = (src) => new Promise((r) => { const i = new Image(); if (/^https?:/.test(src)) i.crossOrigin = "anonymous"; i.onload = () => r(i); i.onerror = () => r(null); i.src = src; });

// guest wishes (added by anyone through /add) live in Supabase
const SB = "https://rjtuakbvpfookqutbych.supabase.co", SB_KEY = "sb_publishable_HhbL6xXv99EtHFn00yRfSA_w9mLKOhr";
async function fetchWishes() {
  try {
    const ctl = new AbortController(); setTimeout(() => ctl.abort(), 6000);
    const r = await fetch(`${SB}/rest/v1/matar_wishes?select=id,name,message,photo_path,created_at&hidden=eq.false&order=created_at.asc`, { headers: { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY }, signal: ctl.signal });
    return r.ok ? await r.json() : [];
  } catch (e) { return []; }
}
const QR_SRC = (window.BOOK.base || "") + "qr.svg";

function canvasFor(mirror) {
  const c = document.createElement("canvas"); c.width = TEX_W; c.height = TEX_H;
  const g = c.getContext("2d"); if (mirror) { g.translate(TEX_W, 0); g.scale(-1, 1); }
  return [c, g];
}
const clothCache = {};
function cloth(g, w, h) {
  const key = w + "x" + h;
  if (!clothCache[key]) { const c = document.createElement("canvas"); c.width = w; c.height = h; clothDraw(c.getContext("2d"), w, h); clothCache[key] = c; }
  g.drawImage(clothCache[key], 0, 0);
}
function clothDraw(g, w, h) {
  // a soft warm gradient (light yellow → amber), with a faint highlight at the top
  const gr = g.createLinearGradient(0, 0, w, h);
  gr.addColorStop(0, "#FFE27A"); gr.addColorStop(.5, "#FFC83A"); gr.addColorStop(1, "#F4A62A");
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  const hi = g.createRadialGradient(w * .3, h * .1, 0, w * .3, h * .1, w * .9);
  hi.addColorStop(0, "rgba(255,255,255,.22)"); hi.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = hi; g.fillRect(0, 0, w, h);
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
// handwritten lines: pen-blue ink, each line a touch uneven, like real writing on a page
const HAND = "Hand", PEN = "#1f2d5a";
function hand(g, s, x, y, maxW, size, lh, maxLines = 99, color = PEN) {
  g.save(); g.font = `400 ${size}px "${HAND}"`; g.direction = T.dir;
  const words = s.replace(/\s+/g, " ").trim().split(" "), lines = []; let line = "";
  for (const w of words) { const t = line ? line + " " + w : w; if (g.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; }
  lines.push(line); if (lines.length > maxLines) { lines.length = maxLines; lines[maxLines - 1] += "…"; }
  g.fillStyle = color; g.textAlign = "start"; g.textBaseline = "alphabetic";
  lines.forEach((l, i) => {
    const j = Math.sin(i * 2.3 + s.length) , k = Math.cos(i * 1.7 + s.length * .3);
    g.save(); g.translate(x + j * 6, y + i * lh + k * 3); g.rotate((j * .6) * Math.PI / 180); g.fillText(l, 0, 0); g.restore();
  });
  g.restore(); return lines.length;
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
  // the cover: six frames that keep swapping, at random, for other moments from the book
  let coverPool = [];
  const slots = [6, 18, 58, 86, 114, 146].map((k) => ({ im: IMG[k], next: null, t0: 0 }));
  let lastSwap = 0;
  const front = (g, w, h, t = 0) => {
    cloth(g, w, h);
    txt(g, T.label, sx(w), M + 30, 30, 400, SUBL);
    g.font = `500 150px "${FONT}"`; const tw = Math.max(g.measureText(T.name + ",").width, g.measureText(T.sub + ".").width);
    const ts = Math.min(150, 150 * (w - 2 * M) / (tw + 20));
    txt(g, T.name + ",", sx(w), M + 110 + ts, ts, 500, INKL, "start", -ts / 50);
    txt(g, T.sub + ".", sx(w), M + 110 + ts * 2, ts, 500, INKL, "start", -ts / 50);
    // every ~2.5 s one frame fades to another picture
    if (t && coverPool.length > 6 && t - lastSwap > 2.5) {
      lastSwap = t; const sl = slots[Math.floor(Math.random() * slots.length)];
      if (!sl.next) { const shown = new Set(slots.map((x) => x.im)); const pick = coverPool.filter((im) => !shown.has(im)); sl.next = pick[Math.floor(Math.random() * pick.length)]; sl.t0 = t; }
    }
    const cols = 3, gap = 12, gw = w - 2 * M, cw = (gw - gap * (cols - 1)) / cols, ch = cw * 9 / 16, y0 = h - M - 120 - 2 * ch - gap;
    const cover = (im, x, y, alpha) => { if (!im) return; const k = Math.max(cw / im.width, ch / im.height); g.save(); g.globalAlpha = alpha; g.beginPath(); g.rect(x, y, cw, ch); g.clip(); g.drawImage(im, x + (cw - im.width * k) / 2, y + (ch - im.height * k) / 2, im.width * k, im.height * k); g.restore(); };
    slots.forEach((sl, i) => {
      const c = i % cols, r = Math.floor(i / cols);
      const x = RTL ? w - M - (c + 1) * cw - c * gap : M + c * (cw + gap), y = y0 + r * (ch + gap);
      cover(sl.im, x, y, 1);
      if (sl.next) { const f = clamp((t - sl.t0) / .9); cover(sl.next, x, y, f); if (f >= 1) { sl.im = sl.next; sl.next = null; } }
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
  const black = (g, w, h) => { g.fillStyle = "#000"; g.fillRect(0, 0, w, h); };
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
  const blessImgs = await Promise.all(T.bless.map((b) => b.photo ? loadImg(BASE + b.photo) : null));
  const blessing = (b, im) => ({ kind: "page", draw: (g, w, h) => {
    paper(g, w, h);
    txt(g, b.label, sx(w), M + 24, 26, 400, GREY);
    let y = M + 110;
    if (im) {   // a photo of the two of them, pinned at a slight angle
      const bw = w - 2 * M, bh = h * .36, k = Math.min(bw / im.width, bh / im.height), pw = im.width * k, ph = im.height * k;
      g.save(); g.translate(w / 2, y + bh / 2); g.rotate((RTL ? 1.4 : -1.4) * Math.PI / 180);
      g.shadowColor = "rgba(0,0,0,.16)"; g.shadowBlur = 16; g.shadowOffsetY = 6; g.fillStyle = "#fff"; g.fillRect(-pw / 2 - 12, -ph / 2 - 12, pw + 24, ph + 24);
      g.shadowColor = "transparent"; g.drawImage(im, -pw / 2, -ph / 2, pw, ph); g.restore();
      y += bh + 100;
    } else y += 80;
    hand(g, b.title, sx(w), y, w - 2 * M, im ? 66 : 84, 90);
    const lh = im ? 60 : 78, size = im ? 40 : 50, maxLines = Math.floor((h - M - 90 - (y + 90)) / lh);
    hand(g, b.body, sx(w), y + 100, w - 2 * M, size, lh, maxLines);
    hand(g, b.sign, sx(w), h - M - 10, w - 2 * M, 46, 60);
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

  // ---- guest wishes: one page each, then a page inviting more ----
  const wishes = await fetchWishes();
  const wishImgs = await Promise.all(wishes.map((w) => w.photo_path ? loadImg(`${SB}/storage/v1/object/public/matar/${w.photo_path}`) : null));
  const qr = await loadImg(QR_SRC);
  coverPool = [...Object.values(IMG), ...DUO, ...wishImgs, ...blessImgs].filter(Boolean);
  const wishPage = (wsh, im) => ({ kind: "page", draw: (g, w, h) => {
    paper(g, w, h);
    txt(g, T.fromLabel, sx(w), M + 24, 26, 400, GREY);
    hand(g, wsh.name, sx(w), M + 110, w - 2 * M, 64, 70, 1);
    let y = M + 170;
    if (im) {
      const bw = w - 2 * M, bh = h * .42, k = Math.min(bw / im.width, bh / im.height), pw = im.width * k, ph = im.height * k;
      g.save(); g.translate(w / 2, y + bh / 2); g.rotate((RTL ? 1.2 : -1.2) * Math.PI / 180);
      g.shadowColor = "rgba(0,0,0,.16)"; g.shadowBlur = 16; g.shadowOffsetY = 6; g.fillStyle = "#fff"; g.fillRect(-pw / 2 - 12, -ph / 2 - 12, pw + 24, ph + 24);
      g.shadowColor = "transparent"; g.drawImage(im, -pw / 2, -ph / 2, pw, ph); g.restore();
      y += bh + 90;
    } else y += 60;
    const size = im ? 40 : 50, lh = size * 1.5, maxLines = Math.floor((h - M - 40 - y) / lh);
    hand(g, wsh.message, sx(w), y, w - 2 * M, size, lh, maxLines);   // long wishes are kept on the page
  } });
  const invite = { kind: "invite", draw: (g, w, h) => {
    paper(g, w, h);
    txt(g, T.inviteLabel, sx(w), M + 24, 26, 400, GREY);
    if (qr) { const q = Math.round(w * .2), x = RTL ? w - M - q : M, y = h - M - q - 70; g.fillStyle = "#fff"; g.fillRect(x - 10, y - 10, q + 20, q + 20); g.drawImage(qr, x, y, q, q);
      txt(g, T.invite1 + " " + T.invite2, sx(w), h - M - 30, 26, 500, INK); txt(g, T.inviteUrl, sx(w), h - M, 22, 400, GREY); }
  } };
  const endPage = { kind: "page", draw: (g, w, h) => { paper(g, w, h); txt(g, T.credit, w / 2, h / 2, 30, 400, GREY, "center"); } };
  const after = [...wishes.map((wsh, i) => wishPage(wsh, wishImgs[i])), invite];
  const rest = after.slice(1); if (rest.length % 2) rest.push(endPage);
  const pairs = []; for (let i = 0; i < rest.length; i += 2) pairs.push([rest[i], rest[i + 1]]);

  // leaf = [front, back]; spread k shows [leaf k-1 back (right), leaf k front (left)]
  return [
    [{ kind: "front", draw: front, hard: true, live: true }, scatter],
    [blessing(parents, blessImgs[0]), blessing(meidan, blessImgs[1])],
    [blessing(iyar, blessImgs[2]), duoPage(DUO.slice(0, 9), 1)],
    [duoPage(DUO.slice(9), 2), { kind: "inner", draw: black }],
    [{ kind: "inner", draw: black, film: true }, after[0]],     // FILM: the video spans this spread
    ...pairs,
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
const COLS = 28, PGAP = .016;
function makeLeaf(f, i, n) {
  const hard = !!(f[0].hard || f[1].hard), w = hard ? CW : W, h = hard ? CH : H;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array((COLS + 1) * 6), uv = new Float32Array((COLS + 1) * 4), idx = [];
  for (let c = 0; c <= COLS; c++) for (let r = 0; r < 2; r++) { const k = c * 2 + r; uv[k * 2] = c / COLS; uv[k * 2 + 1] = r; }
  for (let c = 0; c < COLS; c++) { const a = c * 2, b = a + 1, d = a + 2, e = a + 3; if (S > 0) idx.push(a, d, b, b, d, e); else idx.push(a, b, d, b, e, d); }
  geo.setIndex(idx); geo.setAttribute("position", new THREE.BufferAttribute(pos, 3)); geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  const canv = [];
  const tex = (face, mirror) => {
    const c = document.createElement("canvas"); c.width = TEX_W; c.height = Math.round(c.width * h / w); const g = c.getContext("2d"); if (mirror) { g.translate(c.width, 0); g.scale(-1, 1); }
    face.draw(g, c.width, c.height, 0);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    if (face.live) live.push({ face, g, c, t, leaf: i });
    canv.push({ c, mirror });
    return t;
  };
  const mf = new THREE.MeshStandardMaterial({ map: tex(f[0], S < 0), roughness: hard ? .85 : .95, side: THREE.FrontSide });
  const mb = new THREE.MeshStandardMaterial({ map: tex(f[1], S > 0), roughness: hard ? .85 : .95, side: THREE.BackSide });
  const a = new THREE.Mesh(geo, mf), b = new THREE.Mesh(geo, mb);
  a.castShadow = b.castShadow = true; a.receiveShadow = b.receiveShadow = true;
  a.userData = { kind: f[0].kind, leaf: i, side: 0 }; b.userData = { kind: f[1].kind, leaf: i, side: 1 };
  book.add(a, b);
  const L = { i, n, w, h, hard, geo, p: 0, meshes: [a, b], canv }; place(L, 0); return L;
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

// the page blocks: the stack under the top page on each side, so the book has a body
const blockMat = new THREE.MeshStandardMaterial({ color: 0xf1ede4, roughness: 1 });
const blockA = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), blockMat), blockB = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), blockMat);
blockA.castShadow = blockB.castShadow = true; book.add(blockA, blockB);
function layBlocks() {
  const n = leaves.length, k = leaves.filter((L) => L.p >= .5).length;    // k leaves lie on the turned side
  const un = n - k;
  // unturned side: leaves k..n-1 at z (n-k)·g … g ; turned side: leaves 0..k-1 at z g … k·g
  const E = .004;   // keep the block just under the top leaf and just above the bottom one
  const setB = (m, count, side) => { const th = Math.max(0, count - 1) * PGAP - 2 * E; m.visible = th > .001; m.scale.set(W - .012, H - .024, Math.max(th, .001)); m.position.set(side * W / 2, 0, (count + 1) / 2 * PGAP); };
  setB(blockA, un, S); setB(blockB, k, -S);
}
// the spine, seen while the book is closed
const spine = new THREE.Mesh(new THREE.BoxGeometry(.012, CH, 1), new THREE.MeshStandardMaterial({ color: 0xF2B030, roughness: .8 }));
spine.castShadow = true; book.add(spine);

// ---------- the film, printed across the open spread ----------
const video = $("film");
const SRC = `${BASE}v/index.m3u8`;
if (video.canPlayType("application/vnd.apple.mpegurl")) video.src = SRC;
else if (window.Hls && Hls.isSupported()) { const h = new Hls({ maxBufferLength: 30 }); h.loadSource(SRC); h.attachMedia(video); }
else video.src = SRC;
const vtex = new THREE.VideoTexture(video); vtex.colorSpace = THREE.SRGBColorSpace;
const ptex = new THREE.TextureLoader().load(`${BASE}poster.jpg`); ptex.colorSpace = THREE.SRGBColorSpace;
const filmMat = new THREE.MeshBasicMaterial({ map: ptex, transparent: true, opacity: 0, toneMapped: false });
const FILM_W = 2 * W - .08, FILM_H = FILM_W * 9 / 16;
const film = new THREE.Mesh(new THREE.PlaneGeometry(FILM_W, FILM_H), filmMat);
film.userData.kind = "film"; book.add(film); window.__book = { film, filmMat, ptex, get leaves() { return leaves; } };
video.addEventListener("playing", () => { filmMat.map = vtex; filmMat.needsUpdate = true; }, { once: true });
// the soft fold in the middle of the spread
const gc = document.createElement("canvas"); gc.width = 512; gc.height = 4; { const g = gc.getContext("2d"); const gr = g.createLinearGradient(0, 0, 512, 0);
  gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(.44, "rgba(0,0,0,.05)"); gr.addColorStop(.5, "rgba(0,0,0,.32)"); gr.addColorStop(.56, "rgba(0,0,0,.05)"); gr.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gr; g.fillRect(0, 0, 512, 4); }
const gutterMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(gc), transparent: true, opacity: 0, depthWrite: false });
const gutter = new THREE.Mesh(new THREE.PlaneGeometry(.5, H), gutterMat);  book.add(gutter);

// ---------- state ----------
// 0 = front cover · 1..FILM-1 = pages · FILM = the film across the spread · END = back cover (the story)
let state = 0, FILM = 6, END = 7;
const body = document.body;
const name = (s) => s === 0 ? "front" : s === END ? "back" : s === FILM ? "open" : "pages";
function go(s, opts = {}) {
  state = clamp(s, 0, END);
  body.dataset.state = name(state); if (strip.children.length) markStrip();
  $("left").disabled = RTL ? state === END : state === 0;
  $("right").disabled = RTL ? state === 0 : state === END;
  if (state === FILM) { if (opts.restart || video.ended) video.currentTime = 0; video.play().catch(() => {}); }
  else video.pause();
}
window.bookGo = go;
// ---------- TV mode (?tv): plays the book by itself in a loop, with a QR to add a wish ----------
const TV = new URLSearchParams(location.search).has("tv");
let WISHES = 0;
async function tvLoop() {
  // new wishes arrived? reload the book so they become pages
  const n = (await fetchWishes()).length;
  if (n + 0 !== countWishes) return location.reload();
  go(0);
}
let countWishes = -1, tvOn = false;
if (TV) {
  document.body.classList.add("tv");
  fetchWishes().then((w) => { countWishes = w.length; });
  const start = $("tvStart");
  start.addEventListener("click", () => {
    start.remove(); tvOn = true;
    const el = document.documentElement; try { (el.requestFullscreen || el.webkitRequestFullscreen).call(el); } catch (e) {}
    video.muted = false; video.play().then(() => video.pause()).catch(() => {});   // unlock sound for later
    go(1);
  });
}
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
$("watch").onclick = () => { if (state === FILM) { video.paused ? video.play() : video.pause(); } else go(FILM, { restart: true }); };
const isFull = () => document.body.classList.contains("full");
function setFull(on) {
  document.body.classList.toggle("full", on);
  const el = document.documentElement;
  try {
    if (on && !document.fullscreenElement && !document.webkitFullscreenElement) (el.requestFullscreen || el.webkitRequestFullscreen || (() => {})).call(el);
    if (!on && (document.fullscreenElement || document.webkitFullscreenElement)) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
  } catch (e) {}
}
$("full").onclick = (e) => { e.stopPropagation(); setFull(!isFull()); };
const fsChange = () => { if (!document.fullscreenElement && !document.webkitFullscreenElement && isFull() && !TV) document.body.classList.remove("full"); };
document.addEventListener("fullscreenchange", fsChange); document.addEventListener("webkitfullscreenchange", fsChange);
video.addEventListener("ended", () => setTimeout(() => { if (state === FILM) go(FILM + 1); }, 700));
const watchTxt = $("watchTxt");
const syncWatch = () => { const on = !video.paused && !video.ended; body.classList.toggle("playing", on); watchTxt.textContent = on ? T.pause : T.play; };
["play", "pause", "ended"].forEach((ev) => video.addEventListener(ev, syncWatch));

// status bar line: film time when open, place in the book otherwise
const fmt = (s) => { s = Math.max(0, Math.floor(s || 0)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };
const pa = $("pa"), pb = $("pb"), fill = $("fill"), track = $("track");
function bar() {
  if (state === FILM) {
    const d = video.duration || 169.9;
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
let down = null, drag = null;
// which leaf would a pointer-down turn, and which way
function grab(e) {
  const hit = pick(e); if (!hit) return null;
  const { kind, leaf, side } = hit.object.userData;
  if (kind === "film") return { L: leaves[state], dir: 1, kind };                 // the film spread: its left leaf is next to turn
  if (side === 0 && leaf === state && state < END) return { L: leaves[state], dir: 1, kind };
  if (side === 1 && leaf === state - 1) return { L: leaves[state - 1], dir: -1, kind };
  return { L: null, dir: 0, kind };
}
renderer.domElement.addEventListener("pointermove", (e) => {
  const r = renderer.domElement.getBoundingClientRect();
  look.x = (e.clientX - r.left) / r.width * 2 - 1; look.y = (e.clientY - r.top) / r.height * 2 - 1;
  if (drag) {
    const dx = e.clientX - drag.x, span = r.width * (state === 0 || state === END ? .35 : .42);
    const forward = -S * dx / span;                                                // toward the spine = forward
    if (Math.abs(dx) > 6) drag.moved = true;
    const p = drag.dir > 0 ? clamp(forward) : clamp(1 + forward);
    drag.L.p = p; place(drag.L, ease(p)); autoT = 0;
    return;
  }
  renderer.domElement.style.cursor = pick(e) ? "pointer" : "default";
});
renderer.domElement.addEventListener("pointerdown", (e) => {
  down = { x: e.clientX };
  const g = grab(e);
  if (g && g.L && leaves.every((L) => L.p === 0 || L.p === 1)) {
    drag = { L: g.L, dir: g.dir, x: e.clientX, moved: false, kind: g.kind }; g.L.drag = true;
    renderer.domElement.setPointerCapture(e.pointerId); renderer.domElement.style.cursor = "grabbing";
  }
});
function release(e) {
  if (drag) {
    const d = drag; drag = null; d.L.drag = false; renderer.domElement.style.cursor = "default";
    if (d.moved) { if (d.dir > 0 ? d.L.p > .3 : d.L.p < .7) go(state + d.dir); return; }   // past the fold: it turns, else it falls back
    // a plain tap
    if (d.kind === "film") return video.paused ? video.play() : video.pause();
    if (d.kind === "back") return go(FILM, { restart: true });
    return go(state + d.dir);
  }
  if (!down) return; const dx = e.clientX - down.x; down = null;
  if (Math.abs(dx) > 40) return (dx < 0) === RTL ? prev() : next();   // swipe anywhere
  const hit = pick(e); if (!hit) return;
  const { kind } = hit.object.userData;
  if (kind === "back") return go(FILM, { restart: true });
  if (kind === "front") next();
}
renderer.domElement.addEventListener("pointerup", release);
renderer.domElement.addEventListener("pointercancel", release);
addEventListener("keydown", (e) => {
  if (e.key === " ") { e.preventDefault(); state === FILM ? (video.paused ? video.play() : video.pause()) : next(); }
  else if (e.key === "ArrowLeft") RTL ? next() : prev();
  else if (e.key === "ArrowRight") RTL ? prev() : next();
  else if (e.key === "Escape") { if (isFull()) setFull(false); else go(0); }
});

// ---------- the page strip in the bottom bar: every spread as a small thumbnail; click or drag along it ----------
const strip = $("strip");
function thumb(entry, hgt) {
  const { c, mirror } = entry, t = document.createElement("canvas"); t.height = hgt; t.width = Math.round(hgt * c.width / c.height);
  const g = t.getContext("2d"); if (mirror) { g.translate(t.width, 0); g.scale(-1, 1); } g.drawImage(c, 0, 0, t.width, t.height); return t;
}
function buildStrip() {
  strip.innerHTML = "";
  const H0 = 26;
  for (let k = 0; k <= END; k++) {
    const el = document.createElement("button"); el.className = "pg"; el.dataset.k = k; el.setAttribute("aria-label", "page " + k);
    // closed: one board. open: the two facing pages, in reading order
    const faces = k === 0 ? [leaves[0].canv[0]] : k === END ? [leaves[END - 1].canv[1]] : (RTL ? [leaves[k].canv[0], leaves[k - 1].canv[1]] : [leaves[k - 1].canv[1], leaves[k].canv[0]]);
    faces.forEach((f) => el.appendChild(thumb(f, H0)));
    el.addEventListener("click", () => go(k));
    strip.appendChild(el);
  }
  let sd = false;
  const at = (e) => { const t = document.elementFromPoint(e.clientX, e.clientY)?.closest(".pg"); if (t && +t.dataset.k !== state) go(+t.dataset.k); };
  strip.addEventListener("pointerdown", (e) => { sd = true; strip.setPointerCapture(e.pointerId); at(e); });
  strip.addEventListener("pointermove", (e) => { if (sd) at(e); });
  strip.addEventListener("pointerup", () => { sd = false; }); strip.addEventListener("pointercancel", () => { sd = false; });
}
function markStrip() { strip.querySelectorAll(".pg").forEach((el) => el.classList.toggle("on", +el.dataset.k === state)); const on = strip.querySelector(".pg.on"); if (on) on.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" }); }

// ---------- frame ----------
function fit() {
  const w = host.clientWidth, h = host.clientHeight, pr = renderer.getPixelRatio();
  if (renderer.domElement.width !== Math.floor(w * pr) || renderer.domElement.height !== Math.floor(h * pr)) renderer.setSize(w, h);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  const open = state > 0 && state < END, f = Math.tan(camera.fov * Math.PI / 360);
  const tight = TV || isFull();
  const needW = open ? 2 * CW * (tight ? 1.04 : 1.16) : CW * (tight ? 1.5 : 1.75), needH = CH * (open ? (tight ? 1.05 : 1.18) : (tight ? 1.12 : 1.3));
  return Math.max(needH / 2 / f, needW / 2 / (f * camera.aspect));
}
const clock = new THREE.Clock(), goal = new THREE.Vector3(); let liveAt = 0;
let offset = -S * CW / 2, yaw = -S * .42;
function frame() {
  const dt = Math.min(.05, clock.getDelta());
  // turn leaves one after another
  for (const L of leaves) {
    if (L.drag) continue;
    const g = L.i < state ? 1 : 0; if (L.p === g) continue;
    const ready = g ? leaves.every((o) => o.i >= L.i || o.i >= state || o.p > .25) : leaves.every((o) => o.i <= L.i || o.i < state || o.p < .75);
    if (!ready) continue;
    const sp = L.hard ? 1 / 1.15 : 1 / .9;
    L.p = g ? Math.min(1, L.p + dt * sp) : Math.max(0, L.p - dt * sp); place(L, ease(L.p));
  }
  const resting = leaves.every((L) => L.p === 0 || L.p === 1);
  const closed = (state === 0 || state === END);
  spine.visible = closed && resting;
  layBlocks();
  spine.scale.z = (leaves.length - 1) * PGAP + .004; spine.position.set(-S * .006, 0, (leaves.length + 1) / 2 * PGAP);
  const filmOn = state === FILM && resting;
  film.position.z = gutter.position.z = leaves.length * PGAP + .004;
  filmMat.opacity += ((filmOn ? 1 : 0) - filmMat.opacity) * Math.min(1, dt * (filmOn ? 4 : 10));
  gutterMat.opacity = filmMat.opacity; film.visible = gutter.visible = filmMat.opacity > .01;

  const wantOff = state === 0 ? -S * CW / 2 : state === END ? S * CW / 2 : 0;
  offset += (wantOff - offset) * Math.min(1, dt * 3.2); book.position.x = offset;
  const wantYaw = state === 0 ? -S * .42 : state === END ? S * .42 : 0;
  const calm = state === FILM ? 0 : 1;
  yaw += (wantYaw - yaw) * Math.min(1, dt * 3); stage.rotation.y = yaw + look.x * .05 * calm;
  stage.rotation.x = look.y * .03 * calm;
  goal.set(0, 0, fit()); camera.position.lerp(goal, Math.min(1, dt * 3)); camera.lookAt(0, 0, 0);
  // moving photos redraw at ~12 fps, enough for a gentle drift and easy on phones
  if (clock.elapsedTime - liveAt > .08) { liveAt = clock.elapsedTime; for (const L of live) { const lf = leaves[L.leaf]; if (Math.abs(L.leaf - state) <= 1 || (lf.p > 0 && lf.p < 1)) { L.face.draw(L.g, L.c.width, L.c.height, clock.elapsedTime); L.t.needsUpdate = true; } } }
  const still = leaves.every((L) => L.p === 0 || L.p === 1);
  if (still && state > 0 && state !== FILM && state < END) { autoT += dt; if (autoT > AUTO) { autoT = 0; go(state + 1); } }
  else if (still && TV && tvOn && (state === END || state === 0)) { autoT += dt; if (autoT > (state === END ? 12 : 4)) { autoT = 0; if (state === END) tvLoop(); else go(1); } }
  else autoT = 0;
  if (!scrub) bar();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

(async () => {
  await Promise.race([new Promise((r) => setTimeout(r, 2500)), Promise.all([document.fonts.load(`500 100px "${FONT}"`, "מטר Matar"), document.fonts.load(`400 30px "${FONT}"`, "מטר Matar"), document.fonts.load(`400 40px "${HAND}"`, "מטר, Matar")]).catch(() => {})]);
  const F = await faces(); F.forEach((f, i) => leaves.push(makeLeaf(f, i, F.length))); END = F.length; FILM = F.findIndex((f) => f[0].film); WISHES = F.length;
  buildStrip();
  go(0); camera.position.set(0, 0, fit() * 1.3);
  body.classList.add("ready");
  frame();
})();
