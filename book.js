import * as THREE from "./lib/three.module.min.js";

const T = window.BOOK;
const RTL = T.dir === "rtl";
const S = RTL ? -1 : 1;                 // side the leaves lie on before turning
const BASE = T.base;
const $ = (id) => document.getElementById(id);

// ---------- look ----------
const CLOTH = "#FFCF1A", INKL = "#16140f", SUBL = "rgba(22,20,15,.62)", FONT = "Swiss";
const W = 1, H = 1.38, CW = W + .04, CH = H + .04, GAP = .022;   // the boards overhang the pages by .02 all round
const TEX_W = 1024, TEX_H = Math.round(TEX_W * CH / CW);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ease = (x) => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
// images: never let one stuck file hold up the book
const loadImg = (src, ms = 8000) => new Promise((r) => {
  const i = new Image(); if (/^https?:/.test(src)) i.crossOrigin = "anonymous";
  const t = setTimeout(() => { i.onload = i.onerror = null; r(null); }, ms);
  i.onload = () => { clearTimeout(t); r(i); }; i.onerror = () => { clearTimeout(t); r(null); }; i.src = src;
});
// canvas roundRect is missing on iOS 15 and older browsers
if (!CanvasRenderingContext2D.prototype.roundRect) CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
  r = Math.min(typeof r === "number" ? r : 0, w / 2, h / 2);
  this.moveTo(x + r, y); this.arcTo(x + w, y, x + w, y + h, r); this.arcTo(x + w, y + h, x, y + h, r); this.arcTo(x, y + h, x, y, r); this.arcTo(x, y, x + w, y, r); this.closePath();
};

// guest wishes (added by anyone through /add) live in Supabase
const SB = "https://rjtuakbvpfookqutbych.supabase.co", SB_KEY = "sb_publishable_HhbL6xXv99EtHFn00yRfSA_w9mLKOhr";
async function fetchWishes() {
  try {
    const ctl = new AbortController(); setTimeout(() => ctl.abort(), 6000);
    const r = await fetch(`${SB}/rest/v1/matar_wishes?select=id,name,message,photo_path,video_path,created_at&hidden=eq.false&order=created_at.asc`, { headers: { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY }, signal: ctl.signal });
    if (!r.ok) return null;
    const rows = await r.json();
    // a row sent straight to the API could be missing fields: keep only what we can draw
    return (Array.isArray(rows) ? rows : []).filter((w) => w && (w.message || w.photo_path || w.video_path))
      .map((w) => ({ ...w, name: String(w.name || "").slice(0, 60), message: String(w.message || "").slice(0, 700) }));
  } catch (e) { return null; }
}
const QR_SRC = (window.BOOK.base || "") + "qr.svg";

function canvasFor(mirror) {
  const c = document.createElement("canvas"); c.width = TEX_W; c.height = TEX_H;
  const g = c.getContext("2d"); if (mirror) { g.translate(TEX_W, 0); g.scale(-1, 1); }
  return [c, g];
}
// the cover: a warm gradient that slowly drifts, like light moving over cloth (cheap enough to redraw live)
const clothCache = {};
function cloth(g, w, h, t = 0) {
  if (!t) { const key = w + "x" + h; if (!clothCache[key]) { const c = document.createElement("canvas"); c.width = w; c.height = h; clothDraw(c.getContext("2d"), w, h, 0); clothCache[key] = c; } g.drawImage(clothCache[key], 0, 0); return; }
  clothDraw(g, w, h, t);
}
function clothDraw(g, w, h, t) {
  const a = t * .12, cx = w * (.5 + .45 * Math.cos(a)), cy = h * (.5 + .45 * Math.sin(a * .8));
  const gr = g.createLinearGradient(w * (.5 - .5 * Math.cos(a * .7)), 0, w * (.5 + .5 * Math.cos(a * .7)), h);
  gr.addColorStop(0, "#FFE27A"); gr.addColorStop(.45, "#FFC83A"); gr.addColorStop(1, "#F4A62A");
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  // two soft pools of colour wandering across the board: peach and a touch of rose
  const p1 = g.createRadialGradient(cx, cy, 0, cx, cy, w * .7); p1.addColorStop(0, "rgba(255,150,110,.45)"); p1.addColorStop(1, "rgba(255,150,110,0)");
  g.fillStyle = p1; g.fillRect(0, 0, w, h);
  const qx = w * (.5 - .4 * Math.sin(a * 1.3)), qy = h * (.5 - .4 * Math.cos(a)); const p2 = g.createRadialGradient(qx, qy, 0, qx, qy, w * .6); p2.addColorStop(0, "rgba(255,230,160,.6)"); p2.addColorStop(1, "rgba(255,230,160,0)");
  g.fillStyle = p2; g.fillRect(0, 0, w, h);
  const hi = g.createRadialGradient(w * .3, h * .1, 0, w * .3, h * .1, w * .9);
  hi.addColorStop(0, "rgba(255,255,255,.2)"); hi.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = hi; g.fillRect(0, 0, w, h);
}
function txt(g, s, x, y, size, weight = 400, color = INKL, align = "start", track = 0) {
  g.save(); g.font = `${weight} ${size}px "${FONT}"`; g.fillStyle = color; g.direction = T.dir; g.textAlign = align; g.textBaseline = "alphabetic";
  if (track) g.letterSpacing = track + "px"; g.fillText(s, x, y); g.restore();
}
// handwritten lines: pen-blue ink, each line a touch uneven, like real writing on a page
const HAND = "Hand", PEN = "#1f2d5a";
function handLines(g, s, maxW, size) {
  g.save(); g.font = `400 ${size}px "${HAND}"`; g.direction = T.dir;
  const lines = [];
  for (const para of String(s || "").split(/\n+/)) {
    let line = "";
    for (let w of para.replace(/[ \t]+/g, " ").trim().split(" ")) {
      // a single word wider than the line (a link, a run of emoji) is cut into pieces
      while (g.measureText(w).width > maxW && w.length > 1) { let k = w.length - 1; while (k > 1 && g.measureText(w.slice(0, k)).width > maxW) k--; if (line) { lines.push(line); line = ""; } lines.push(w.slice(0, k)); w = w.slice(k); }
      const t = line ? line + " " + w : w; if (g.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t;
    }
    if (line) lines.push(line);
  }
  g.restore(); return lines.length ? lines : [""];
}
function hand(g, s, x, y, maxW, size, lh, maxLines = 99, color = PEN, align = "start") {
  const lines = handLines(g, s, maxW, size);
  if (lines.length > maxLines) { lines.length = maxLines; lines[maxLines - 1] += "…"; }
  g.save(); g.font = `400 ${size}px "${HAND}"`; g.direction = T.dir;
  g.fillStyle = color; g.textAlign = align; g.textBaseline = "alphabetic";
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
  const wishesP = fetchWishes().then(async (list) => { const w = list || []; return { list: w, ok: !!list, imgs: await Promise.all(w.map((x) => x.photo_path ? loadImg(`${SB}/storage/v1/object/public/matar/${x.photo_path}`) : null)) }; });
  const blessP = Promise.all(T.bless.map((b) => b.photo ? loadImg(BASE + b.photo) : null));
  const [imgs, DUO] = await Promise.all([Promise.all(SHOTS.map((s) => loadImg(`${BASE}f/${s}.jpg`))), Promise.all(Array.from({ length: 18 }, (_, i) => loadImg(`${BASE}d/${String(i + 1).padStart(2, "0")}.jpg`)))]);
  const IMG = Object.fromEntries(SHOTS.map((s, i) => [s, imgs[i]]));
  const M = 92;
  const sx = (w) => RTL ? w - M : M;
  // the cover: six frames that keep swapping, at random, for other moments from the book
  let coverPool = [];
  const slots = [6, 18, 58, 86, 114, 146].map((k) => ({ im: IMG[k], next: null, t0: 0 }));
  let lastSwap = 0;
  const front = (g, w, h, t = 0) => {
    cloth(g, w, h, t);
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
  const blessImgs = await blessP;
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
  const { list: wishes, ok: wishesOk, imgs: wishImgs } = await wishesP;
  loadedWishes = wishesOk ? wishes.length : -1;
  const qr = await loadImg(QR_SRC);
  coverPool = [...Object.values(IMG), ...DUO, ...wishImgs, ...blessImgs].filter(Boolean);
  // a guest's blessing, drawn as a card sized by what is in it: the media's own proportion and the length of the words
  const PAD = 10, NAME = 30;
  const wordSize = (t, media) => media ? 31 : t.length < 40 ? 52 : t.length < 110 ? 44 : 36;
  function measureCard(g, it, cw) {
    const { w: wsh, im } = it, mw = cw - PAD * 2;
    const vidOnly = !im && !!wsh.video_path;
    const ratio = im ? Math.min(1.35, Math.max(.62, im.height / im.width)) : vidOnly ? 1 : 0;
    const mh = ratio ? Math.round(mw * ratio) : 0;
    if (vidOnly) it.vidOnly = true;
    const media = !!ratio, size = wordSize(wsh.message, media), lh = Math.round(size * 1.4);
    const all = handLines(g, wsh.message, cw - 44, size), lines = Math.min(media ? 5 : 10, all.length);
    let w = cw;
    if (!media) {   // words only: the card is as wide as its longest line (and the name)
      g.save(); g.font = `400 ${size}px "${HAND}"`; let lw = Math.max(...all.map((l) => g.measureText(l).width));
      g.font = `400 ${NAME}px "${HAND}"`; lw = Math.max(lw, g.measureText(wsh.name).width); g.restore();
      w = Math.round(Math.min(cw, Math.max(cw * .5, lw + 70)));
    }
    const body = (media ? PAD + mh + 26 : 44) + lines * lh, h = body + 22 + NAME + 22;
    return { mh, size, lh, lines, h, w };
  }
  function wishCard(g, x, y, cw, m, it, rot) {
    const { w: wsh, im } = it, mw = cw - PAD * 2;
    x += (cw - m.w) / 2; cw = m.w;
    g.save(); g.translate(x + cw / 2, y + m.h / 2); g.rotate(rot * Math.PI / 180); g.translate(-cw / 2, -m.h / 2);
    g.fillStyle = "#fff"; g.beginPath(); g.roundRect(0, 0, cw, m.h, 30); g.fill();
    g.strokeStyle = "rgba(22,20,15,.07)"; g.lineWidth = 2; g.stroke();          // a hairline instead of a shadow
    let ty;
    if (m.mh) {
      g.save(); g.beginPath(); g.roundRect(PAD, PAD, mw, m.mh, 24); g.clip();
      if (im) { const k = Math.max(mw / im.width, m.mh / im.height), iw = im.width * k, ih = im.height * k; g.drawImage(im, PAD + (mw - iw) / 2, PAD + (m.mh - ih) / 2, iw, ih); }
      else { g.fillStyle = "#232220"; g.fillRect(PAD, PAD, mw, m.mh); }
      g.restore();
      if (wsh.video_path) {
        const cx = PAD + mw / 2, cy = PAD + m.mh / 2;
        g.fillStyle = "rgba(255,255,255,.92)"; g.beginPath(); g.arc(cx, cy, 34, 0, Math.PI * 2); g.fill();
        g.fillStyle = INK; g.beginPath(); g.moveTo(cx - 10, cy - 16); g.lineTo(cx + 17, cy); g.lineTo(cx - 10, cy + 16); g.closePath(); g.fill();
      }
      ty = PAD + m.mh + 26 + m.size * .8;
      hand(g, wsh.message, RTL ? cw - 22 : 22, ty, cw - 44, m.size, m.lh, m.lines);
      g.font = `400 ${NAME}px "${HAND}"`; const nw = Math.min(cw - 44, g.measureText(wsh.name).width);
      hand(g, wsh.name, RTL ? 22 + nw : cw - 22, m.h - 24, cw - 44, NAME, NAME, 1);
    } else {
      // words only: centred, the card just as tall as they are
      ty = 44 + m.size * .8;
      hand(g, wsh.message, cw / 2, ty, cw - 44, m.size, m.lh, m.lines, PEN, "center");
      hand(g, wsh.name, cw / 2, m.h - 24, cw - 44, NAME, NAME, 1, PEN, "center");
    }
    g.restore();
  }
  // pack the cards into pages: two columns, each card goes under the shorter one
  const GAP = 30, X0 = M - 34, Y0 = M - 26;
  function packWishes(items) {
    const c = document.createElement("canvas").getContext("2d");
    const w = TEX_W * W / CW, h = Math.round(TEX_W * H / W * (W / CW)), pw = TEX_W, ph = Math.round(TEX_W * H / W);
    const cw = (pw - 2 * X0 - GAP) / 2, avail = ph - Y0 - (M - 26);
    const pages = []; let cur = null;
    items.forEach((it, n) => {
      const m = measureCard(c, it, cw); m.h = Math.min(m.h, avail);
      if (!cur) cur = { cols: [0, 0], list: [] };
      let col = cur.cols[0] <= cur.cols[1] ? 0 : 1;
      if (cur.cols[col] + m.h > avail && cur.list.length) { pages.push(cur); cur = { cols: [0, 0], list: [] }; col = 0; }
      cur.list.push({ it, m, col, y: Y0 + cur.cols[col], rot: [-1.3, 1.1, .9, -1.2, 1.4, -.8][n % 6] });
      cur.cols[col] += m.h + GAP;
    });
    if (cur) pages.push(cur);
    return pages.map((pg) => wishPage(pg, cw));
  }
  const wishPage = (pg, cw) => {
    const face = { kind: "wishes", cards: [], draw: (g, w, h) => {
      paper(g, w, h); face.cards = [];
      // centre the columns vertically when the page is not full
      const used = Math.max(...pg.cols) - GAP, off = Math.max(0, (h - Y0 - (M - 26) - used) / 2);
      for (const c of pg.list) {
        const x = RTL ? w - X0 - (c.col + 1) * cw - c.col * GAP : X0 + c.col * (cw + GAP);
        wishCard(g, x, c.y + off, cw, c.m, c.it, c.rot);
        face.cards.push({ x: x + (cw - c.m.w) / 2, y: c.y + off, w: c.m.w, h: c.m.h, wish: c.it.w, ratio: c.it.im ? c.it.im.width / c.it.im.height : 0 });
      }
    } };
    return face;
  };
  const invite = { kind: "invite", draw: (g, w, h) => {
    paper(g, w, h);
    txt(g, T.inviteLabel, sx(w), M + 24, 26, 400, GREY);
    if (qr) { const q = Math.round(w * .2), x = RTL ? w - M - q : M, y = h - M - q - 70; g.fillStyle = "#fff"; g.fillRect(x - 10, y - 10, q + 20, q + 20); g.drawImage(qr, x, y, q, q);
      txt(g, T.invite1 + " " + T.invite2, sx(w), h - M - 30, 26, 500, INK); txt(g, T.inviteUrl, sx(w), h - M, 22, 400, GREY); }
  } };
  const endPage = { kind: "page", draw: (g, w, h) => { paper(g, w, h); txt(g, T.credit, w / 2, h / 2, 30, 400, GREY, "center"); } };
  await fontsReady;                                   // card sizes depend on the handwriting font
  const wpages = packWishes(wishes.map((w, i) => ({ w, im: wishImgs[i] })));
  const after = [...wpages, invite];
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
const COLS = 28, PGAP = .022, PGAP_OPEN = .006;
let gapNow = PGAP;   // leaf spacing: a thick body when closed, a flat spread when open
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
    face.draw(g, c.width, c.height, 0); face.__mirror = mirror; face.__w = c.width; face.__h = c.height;
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    if (face.live) live.push({ face, g, c, t, leaf: i });
    canv.push({ c, mirror });
    return t;
  };
  const mf = new THREE.MeshStandardMaterial({ map: tex(f[0], S < 0), roughness: hard ? .85 : .95, side: THREE.FrontSide });
  const mb = new THREE.MeshStandardMaterial({ map: tex(f[1], S > 0), roughness: hard ? .85 : .95, side: THREE.BackSide });
  const a = new THREE.Mesh(geo, mf), b = new THREE.Mesh(geo, mb);
  a.castShadow = b.castShadow = true; a.receiveShadow = b.receiveShadow = true;
  a.userData = { kind: f[0].kind, leaf: i, side: 0, face: f[0] }; b.userData = { kind: f[1].kind, leaf: i, side: 1, face: f[1] };
  book.add(a, b);
  const L = { i, n, w, h, hard, geo, p: 0, meshes: [a, b], canv }; place(L, 0); return L;
}
const zOf = (L, p) => (1 - p) * (L.n - L.i) * gapNow + p * (L.i + 1) * gapNow;
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
// a thin dark mat on top of each stack, so the open spread has the same dark rim on both sides
const matMat = new THREE.MeshStandardMaterial({ color: 0x232220, roughness: .95 });
const matA = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), matMat), matB = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), matMat);
matA.receiveShadow = matB.receiveShadow = true; book.add(matA, matB);
function layBlocks() {
  const n = leaves.length, k = leaves.filter((L) => L.p >= .5).length;    // k leaves lie on the turned side
  const un = n - k;
  // unturned side: leaves k..n-1 at z (n-k)·g … g ; turned side: leaves 0..k-1 at z g … k·g
  const E = .004;   // keep the block just under the top leaf and just above the bottom one
  const setB = (m, count, side) => { const th = Math.max(0, count - 1) * gapNow - 2 * E; m.visible = th > .001; m.scale.set(CW - .008, CH - .01, Math.max(th, .001)); m.position.set(side * (CW - .008) / 2, 0, (count + 1) / 2 * gapNow); };
  setB(blockA, un, S); setB(blockB, k, -S);
  const setM = (m, count, side) => { m.visible = count > 0; m.scale.set(CW - .006, CH - .006, 1); m.position.set(side * (CW - .006) / 2, 0, count * gapNow - .002); };
  setM(matA, un, S); setM(matB, k, -S);
}
// the spine, seen while the book is closed
const spine = new THREE.Mesh(new THREE.BoxGeometry(.012, CH, 1), new THREE.MeshStandardMaterial({ color: 0xF2B030, roughness: .8 }));
spine.castShadow = true; book.add(spine);

// ---------- the film, printed across the open spread ----------
const video = $("film");
const SRC = `${BASE}v/index.m3u8`;
const APPLE = /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && !/Chrome|Firefox|Edg/.test(navigator.userAgent));
if (APPLE && video.canPlayType("application/vnd.apple.mpegurl")) video.src = SRC;
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
const gutter = new THREE.Mesh(new THREE.PlaneGeometry(.5, H), gutterMat);  book.add(gutter); gutter.visible = false;

// ---------- state ----------
// 0 = front cover · 1..FILM-1 = pages · FILM = the film across the spread · END = back cover (the story)
let state = 0, FILM = 6, END = 7, loadedWishes = -1, tvBegin = null, fontsReady = Promise.resolve();
const body = document.body;
const name = (s) => s === 0 ? "front" : s === END ? "back" : s === FILM ? "open" : "pages";
function go(s, opts = {}) {
  if (state === 0 && s === 1) autoOff = false;   // opening the book starts the automatic turning again
  state = clamp(s, 0, END);
  body.dataset.state = name(state); if (strip.children.length) markStrip();
  $("left").disabled = RTL ? state === END : state === 0;
  $("right").disabled = RTL ? state === 0 : state === END;
  if (state === FILM) { if (opts.restart || video.ended) video.currentTime = 0; playFilm(); }
  else video.pause();
}
window.bookGo = go;
// play the film; when the browser refuses sound without a tap, play it muted instead
function playFilm() {
  filmT0 = performance.now();
  video.play().catch((e) => {
    // only when the browser refuses sound (not when someone paused it a moment later)
    if (e && e.name === "NotAllowedError" && state === FILM) { video.muted = true; video.play().catch(() => {}); }
  });
}
let filmT0 = 0;
// a tap anywhere gives the sound back
addEventListener("pointerdown", () => { if (video.muted && !TV) { video.muted = false; } }, { capture: true });
// ---------- TV mode (?tv): plays the book by itself in a loop, with a QR to add a wish ----------
const TV = new URLSearchParams(location.search).has("tv");
let WISHES = 0;
async function tvLoop() {
  // new wishes arrived? reload the book so they become pages (and carry on playing by itself after the reload)
  const w = await fetchWishes();
  if (w && loadedWishes >= 0 && w.length !== loadedWishes) { try { sessionStorage.setItem("tvOn", "1"); } catch (e) {} return location.reload(); }
  go(0);
}
let tvOn = false;
if (TV) {
  document.body.classList.add("tv");
  const start = $("tvStart");
  const begin = (gesture) => {
    start.remove(); tvOn = true;
    if (gesture) {
      const el = document.documentElement; try { (el.requestFullscreen || el.webkitRequestFullscreen).call(el); } catch (e) {}
      video.muted = false; video.play().then(() => video.pause()).catch(() => {});   // unlock sound for later
    }
    if (body.classList.contains("ready")) go(1); else tvBegin = () => go(1);   // on a tap the book is usually ready already
  };
  start.addEventListener("click", () => begin(true));
  let again = false; try { again = sessionStorage.getItem("tvOn") === "1"; } catch (e) {}
  if (again) begin(false);
}
// turn the pages by themselves once the book is open, until the video; any manual move restarts the wait
const AUTO = 7;
let autoT = 0, autoOff = false;
const userMove = () => { autoT = 0; if (state > 0 && !TV) autoOff = true; };
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
const fsApi = !!(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen);
if (!fsApi) body.classList.add("nofs");          // iPhone: full screen is our own layout, so it gets a close button
$("fullExit").onclick = (e) => { e.stopPropagation(); setFull(false); };
const fsChange = () => { if (!document.fullscreenElement && !document.webkitFullscreenElement && isFull() && !TV) document.body.classList.remove("full"); };
document.addEventListener("fullscreenchange", fsChange); document.addEventListener("webkitfullscreenchange", fsChange);
video.addEventListener("ended", () => setTimeout(() => { if (state === FILM) go(FILM + 1); }, 700));
// if the film can't play at all, the book moves on by itself rather than waiting on the poster forever
video.addEventListener("error", () => { if (state === FILM && (TV || !autoOff)) setTimeout(() => { if (state === FILM && video.paused) go(FILM + 1); }, 4000); });
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
track.addEventListener("pointerup", () => { scrub = false; }); track.addEventListener("pointercancel", () => { scrub = false; });

// ---------- pointer on the book ----------
const ray = new THREE.Raycaster(), m = new THREE.Vector2(), look = { x: 0, y: 0 };
function pick(e) {
  const r = renderer.domElement.getBoundingClientRect();
  m.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(m, camera);
  return ray.intersectObjects([film, ...leaves.flatMap((l) => l.meshes)], false).filter((h) => h.object !== film || filmMat.opacity > .5)[0];
}
let down = null, drag = null, quietT, tapCard = null;
const wake = () => { body.classList.remove("quiet"); clearTimeout(quietT); quietT = setTimeout(() => { if (isFull()) body.classList.add("quiet"); }, 2500); };
["pointermove", "pointerdown", "keydown", "touchstart"].forEach((ev) => addEventListener(ev, wake, { passive: true }));
// which guest card is under the pointer (texture uv -> the page's own drawing coordinates)
function cardAt(hit) {
  const f = hit.object.userData.face; if (!f || !f.cards || !f.cards.length || !hit.uv) return null;
  let px = hit.uv.x * f.__w; const py = (1 - hit.uv.y) * f.__h; if (f.__mirror) px = f.__w - px;
  return f.cards.find((c) => px >= c.x && px <= c.x + c.w && py >= c.y && py <= c.y + c.h) || null;
}
// which leaf would a pointer-down turn, and which way
function grab(e) {
  const hit = pick(e); if (!hit) return null;
  const { kind, leaf, side } = hit.object.userData;
  const card = (leaf === state || leaf === state - 1) ? cardAt(hit) : null;
  if (card) { const r = { L: null, dir: 0, kind, card }; if (side === 0 && leaf === state && state < END) Object.assign(r, { L: leaves[state], dir: 1 }); if (side === 1 && leaf === state - 1) Object.assign(r, { L: leaves[state - 1], dir: -1 }); return r; }
  if (kind === "film") return { L: leaves[state], dir: 1, kind };
  if (side === 0 && leaf === state && state < END) return { L: leaves[state], dir: 1, kind };
  if (side === 1 && leaf === state - 1) return { L: leaves[state - 1], dir: -1, kind };
  return { L: null, dir: 0, kind };
}
renderer.domElement.addEventListener("pointermove", (e) => {
  const r = renderer.domElement.getBoundingClientRect();
  look.x = (e.clientX - r.left) / r.width * 2 - 1; look.y = (e.clientY - r.top) / r.height * 2 - 1;
  if (drag) {
    const dx = sideways() ? e.clientY - drag.y : e.clientX - drag.x, span = (sideways() ? r.height : r.width) * (state === 0 || state === END ? .35 : .42);
    const forward = -S * dx / span;                                                // toward the spine = forward
    if (Math.abs(dx) > 6) drag.moved = true;
    const p = drag.dir > 0 ? clamp(forward) : clamp(1 + forward);
    drag.L.p = p; place(drag.L, ease(p)); autoT = 0;
    return;
  }
  renderer.domElement.style.cursor = pick(e) ? "pointer" : "default";
});
renderer.domElement.addEventListener("pointerdown", (e) => {
  down = { x: e.clientX, y: e.clientY };
  const g = grab(e);
  tapCard = g && g.card && !g.L ? g.card : null;
  if (g && g.L && leaves.every((L) => L.p === 0 || L.p === 1)) {
    drag = { L: g.L, dir: g.dir, x: e.clientX, y: e.clientY, moved: false, kind: g.kind, card: g.card }; g.L.drag = true;
    renderer.domElement.setPointerCapture(e.pointerId); renderer.domElement.style.cursor = "grabbing";
  }
});
function release(e) {
  if (drag) {
    const d = drag; drag = null; if (d.L) d.L.drag = false; renderer.domElement.style.cursor = "default";
    if (d.moved) { if (d.dir > 0 ? d.L.p > .3 : d.L.p < .7) go(state + d.dir); return; }   // past the fold: it turns, else it falls back
    // a plain tap
    if (d.kind === "film") return video.paused ? video.play() : video.pause();
    if (d.card) return openWish(d.card.wish, d.card);
    if (d.kind === "back") return go(FILM, { restart: true });
    return go(state + d.dir);
  }
  if (!down) return; const dx = sideways() ? e.clientY - down.y : e.clientX - down.x; down = null;
  if (Math.abs(dx) > 40) return (dx < 0) === RTL ? prev() : next();   // swipe anywhere
  if (tapCard) { const c = tapCard; tapCard = null; return openWish(c.wish, c); }
  const hit = pick(e); if (!hit) return;
  const { kind } = hit.object.userData;
  if (kind === "back") return go(FILM, { restart: true });
  if (kind === "front") next();
}
// a guest's blessing, enlarged in the middle of the screen; a video plays right away
const wc = $("wc"), wcard = wc.querySelector(".wcard"), wm = wc.querySelector(".wmedia"), wcImg = wc.querySelector("img"), wcVid = wc.querySelector("video");
const media = (p) => p ? `${SB}/storage/v1/object/public/matar/${p}` : "";
let lastTap = { x: innerWidth / 2, y: innerHeight / 2 };
addEventListener("pointerdown", (e) => { lastTap = { x: e.clientX, y: e.clientY }; }, true);
function openWish(w, card) {
  autoOff = true; video.pause();
  wc.querySelector(".wmsg").textContent = w.message; wc.querySelector(".wname").textContent = w.name;
  // a picture that failed to load in the book is treated as no picture
  const hasPic = !!w.photo_path && !(card && !card.ratio), hasMedia = hasPic || !!w.video_path, ratio = card && card.ratio ? card.ratio : w.video_path ? 1 : 4 / 5;
  wc.classList.toggle("textonly", !hasMedia); wm.classList.remove("ready", "failed");
  // the card keeps the media's own proportion, as large as fits the screen
  const maxH = innerHeight * (hasMedia ? .6 : 1), cwid = Math.min(440, innerWidth - 40, hasMedia ? maxH * ratio + 12 : 440);
  wcard.style.width = hasMedia ? cwid + "px" : ""; wm.style.aspectRatio = String(ratio);
  wcImg.src = hasPic ? media(w.photo_path) : ""; wcImg.hidden = !hasPic;      // the photo (or the video's first frame) is already cached: it shows at once
  wcVid.hidden = !w.video_path;
  if (w.video_path) {
    wcVid.src = media(w.video_path); wcVid.currentTime = 0;
    wcVid.play().catch(() => {});
  } else if (hasPic) { if (wcImg.complete) wm.classList.add("ready"); else { wcImg.onload = () => wm.classList.add("ready"); wcImg.onerror = () => wm.classList.add("ready"); } }
  wc.hidden = false;
  const r = wcard.getBoundingClientRect();                          // grow out of the tapped card
  wcard.style.transformOrigin = `${lastTap.x - r.left}px ${lastTap.y - r.top}px`;
  requestAnimationFrame(() => requestAnimationFrame(() => wc.classList.add("in")));
}
wcVid.addEventListener("playing", () => wm.classList.add("ready", "playing"));
wcVid.addEventListener("waiting", () => wm.classList.remove("playing"));
wcVid.addEventListener("error", () => { if (wc.hidden || !wcVid.getAttribute("src")) return; wm.classList.add("ready", "failed"); });
const closeWish = () => { wc.classList.remove("in"); wcVid.pause(); setTimeout(() => { wc.hidden = true; wcVid.removeAttribute("src"); wcVid.load(); wcImg.removeAttribute("src"); wm.classList.remove("ready", "playing", "failed"); }, 300); };
wc.addEventListener("click", (e) => { if (e.target === wc) closeWish(); });
wcVid.addEventListener("click", () => (wcVid.paused ? wcVid.play() : wcVid.pause()));
$("wcClose").onclick = closeWish;
Object.defineProperties(window.__book, Object.getOwnPropertyDescriptors({ openWish, closeWish, get state() { return state; }, get END() { return END; }, get FILM() { return FILM; }, get autoOff() { return autoOff; }, get cards() { return leaves.flatMap((L) => L.meshes.map((m) => m.userData.face)).filter((f) => f && f.cards).flatMap((f) => f.cards); } }));
addEventListener("keydown", (e) => { if (e.key === "Escape" && !wc.hidden) { e.stopImmediatePropagation(); closeWish(); } }, true);
renderer.domElement.addEventListener("pointerup", release);
// the browser took the touch (a scroll, a system gesture): drop it, it is neither a tap nor a swipe
renderer.domElement.addEventListener("pointercancel", () => { if (drag) { drag.L && (drag.L.drag = false); drag = null; } down = null; tapCard = null; });
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
let rotZ = 0;
const sideways = () => isFull() && !TV && host.clientHeight > host.clientWidth;
function fit() {
  const w = host.clientWidth, h = host.clientHeight, pr = renderer.getPixelRatio();
  if (renderer.domElement.width !== Math.floor(w * pr) || renderer.domElement.height !== Math.floor(h * pr)) renderer.setSize(w, h);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  const open = state > 0 && state < END, f = Math.tan(camera.fov * Math.PI / 360);
  const tight = TV || isFull();
  let needW = open ? 2 * CW * (tight ? 1.04 : 1.16) : CW * (tight ? 1.5 : 1.75), needH = CH * (open ? (tight ? 1.05 : 1.18) : (tight ? 1.12 : 1.3));
  if (isFull() && state === FILM) { needW = FILM_W; needH = FILM_H; }   // full screen: the video itself fills the screen, the book's edges may run off
  if (sideways()) return Math.max(needW / 2 / f, needH / 2 / (f * camera.aspect));   // the book lies along the long side of the phone
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
  const gapWant = (state === 0 || state === END) ? PGAP : PGAP_OPEN;
  if (Math.abs(gapWant - gapNow) > 1e-4) { gapNow += (gapWant - gapNow) * Math.min(1, dt * 4); for (const L of leaves) if (!L.drag) place(L, ease(L.p)); }
  layBlocks();
  spine.scale.z = (leaves.length - 1) * gapNow + .004; spine.position.set(-S * .006, 0, (leaves.length + 1) / 2 * gapNow);
  const filmOn = state === FILM && resting;
  film.position.z = gutter.position.z = leaves.length * gapNow + .004;
  filmMat.opacity += ((filmOn ? 1 : 0) - filmMat.opacity) * Math.min(1, dt * (filmOn ? 4 : 10));
  film.visible = filmMat.opacity > .01;

  const wantOff = state === 0 ? -S * CW / 2 : state === END ? S * CW / 2 : 0;
  offset += (wantOff - offset) * Math.min(1, dt * 3.2); book.position.x = offset;
  const wantYaw = state === 0 ? -S * .42 : state === END ? S * .42 : 0;
  const calm = state === FILM ? 0 : 1;
  yaw += (wantYaw - yaw) * Math.min(1, dt * 3); stage.rotation.y = yaw + look.x * .05 * calm;
  stage.rotation.x = look.y * .03 * calm;
  rotZ += (((sideways() ? -Math.PI / 2 : 0)) - rotZ) * Math.min(1, dt * 4); stage.rotation.z = rotZ;
  goal.set(0, 0, fit()); camera.position.lerp(goal, Math.min(1, dt * 3)); camera.lookAt(0, 0, 0);
  // moving photos redraw at ~12 fps, enough for a gentle drift and easy on phones
  if (clock.elapsedTime - liveAt > .08) { liveAt = clock.elapsedTime; for (const L of live) { const lf = leaves[L.leaf]; if (Math.abs(L.leaf - state) <= 1 || (lf.p > 0 && lf.p < 1)) { L.face.draw(L.g, L.c.width, L.c.height, clock.elapsedTime); L.t.needsUpdate = true; } } }
  const still = leaves.every((L) => L.p === 0 || L.p === 1);
  if (!autoOff && still && state > 0 && state !== FILM && state < END) { autoT += dt; if (autoT > AUTO) { autoT = 0; go(state + 1); } }
  else if (still && TV && tvOn && (state === END || state === 0)) { autoT += dt; if (autoT > (state === END ? 12 : 4)) { autoT = 0; if (state === END) tvLoop(); else go(1); } }
  else if (still && TV && tvOn && state === FILM && video.paused && performance.now() - filmT0 > 15000) { go(FILM + 1); }
  else autoT = 0;
  if (!scrub) bar();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

(async () => {
  const fontsP = fontsReady = Promise.race([new Promise((r) => setTimeout(r, 2500)), Promise.all([document.fonts.load(`500 100px "${FONT}"`, "מטר Matar"), document.fonts.load(`400 30px "${FONT}"`, "מטר Matar"), document.fonts.load(`400 40px "${HAND}"`, "מטר, Matar")]).catch(() => {})]);
  const F = await faces(); await fontsP; F.forEach((f, i) => leaves.push(makeLeaf(f, i, F.length))); END = F.length; FILM = F.findIndex((f) => f[0].film); WISHES = F.length;
  buildStrip();
  go(0); camera.position.set(0, 0, fit() * 1.3);
  body.classList.add("ready");
  if (tvBegin) setTimeout(tvBegin, 1500);
  frame();
})();
