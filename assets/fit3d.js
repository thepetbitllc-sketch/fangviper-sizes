/* Drevaunt size chart: 3D models (three.js). Every garment is worn by a realistic man (MakeHuman CC0 body, assets/man.js)
   who is scaled per size so the garment built round him measures exactly the real cm specs of the chosen product and size. */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { loadMan, fitFn, buildMan, makeSlicer, hull2, radial, fixRing, perimeterR, NA, ZC } from "./man.js";

const FV = window.FV;
const box = document.getElementById("viewer");
const tagsEl = document.getElementById("tags");
const hint = document.getElementById("hint");
const V3 = THREE.Vector3;
const UP = new V3(0, 1, 0), FWD = new V3(0, 0, 1);

function fail(msg) {
  const f = document.createElement("div");
  f.className = "fallback";
  f.textContent = msg || "The 3D model needs WebGL, which is turned off in this browser. Every measurement is in the panel and the full chart below.";
  box.appendChild(f);
  hint.style.display = "none";
}

let renderer;
try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); }
catch (e) { fail(); throw e; }
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
box.prepend(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, 1, 1, 3000);
const target = new V3(0, -40, 0);
camera.position.set(Math.sin(0.45) * 265, target.y + 20, Math.cos(0.45) * 265);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(target);
controls.enablePan = false;
controls.enableZoom = false;
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.rotateSpeed = 0.7;
controls.minPolarAngle = 1.05;
controls.maxPolarAngle = 1.95;
controls.autoRotate = !matchMedia("(prefers-reduced-motion: reduce)").matches;
controls.autoRotateSpeed = 1.1;
// Phones: up/down swipes scroll the page and only sideways swipes turn the model.
// OrbitControls sets touch-action "none" (it would swallow every swipe); "pan-y" hands vertical swipes back to the browser.
renderer.domElement.style.touchAction = "pan-y";
if (matchMedia("(pointer: coarse)").matches) hint.textContent = "Swipe sideways to rotate";

/* ---------- lights: a soft studio room for reflections + key/rim lights ---------- */
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.42;
scene.add(new THREE.HemisphereLight(0xffffff, 0x2a2420, 0.55));
const key = new THREE.DirectionalLight(0xfff6ee, 2.1); key.position.set(120, 160, 220); scene.add(key);
const rim = new THREE.DirectionalLight(0xffffff, 2.0); rim.position.set(-180, 90, -220); scene.add(rim);
const rim2 = new THREE.DirectionalLight(0xffffff, 1.1); rim2.position.set(220, 40, -120); scene.add(rim2);
const fill = new THREE.DirectionalLight(0xffffff, 0.5); fill.position.set(-220, -20, 140); scene.add(fill);

/* ---------- materials ---------- */
const fabric = (color, roughness = 0.9, sheen = 0.5) => new THREE.MeshPhysicalMaterial({ color, roughness, sheen, sheenRoughness: 0.8, sheenColor: new THREE.Color(0xffffff).multiplyScalar(0.18), side: THREE.DoubleSide });
const mTee = fabric(0x1b1b1c);
const mRib = fabric(0x262627, 0.85);
const mStand = new THREE.MeshStandardMaterial({ color: 0x2c2c2c, roughness: 0.3, metalness: 0.7 });
const mShirtBody = fabric(0xf0ede7, 0.82, 0.3);
const mChino = fabric(0x2c3342, 0.88);
const mTrouser = fabric(0x303236, 0.8);
const mJacket = fabric(0x24272d, 0.78, 0.35);
const mLapel = new THREE.MeshStandardMaterial({ color: 0x2c2f36, roughness: 0.42, side: THREE.DoubleSide });
const mVest = fabric(0x30343b, 0.72, 0.3);
const mShirt = fabric(0xf1eee8, 0.8, 0.3);
const mTie = new THREE.MeshPhysicalMaterial({ color: 0x5b1f2c, roughness: 0.45, sheen: 0.6, sheenColor: new THREE.Color(0x8a4050), side: THREE.DoubleSide });
const mButton = new THREE.MeshStandardMaterial({ color: 0x0e0e0e, roughness: 0.3, metalness: 0.25 });
const mBelt = new THREE.MeshPhysicalMaterial({ color: 0x16100c, roughness: 0.4, clearcoat: 0.4, side: THREE.DoubleSide });
const mBuckle = new THREE.MeshStandardMaterial({ color: 0xb8b2a6, roughness: 0.25, metalness: 0.95 });
const mMeas = {};
for (const k of ["A", "B", "C", "D"]) mMeas[k] = new THREE.MeshBasicMaterial({ color: 0x9c7a54, transparent: true });

const logoTex = new THREE.TextureLoader().load("assets/logo-white.png");
logoTex.colorSpace = THREE.SRGBColorSpace;
logoTex.anisotropy = 4;

/* soft floor shadow (added per model) */
const shadowTex = (() => {
  const c = document.createElement("canvas"); c.width = c.height = 128;
  const g = c.getContext("2d"), gr = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  gr.addColorStop(0, "rgba(25,17,11,.26)"); gr.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
})();
function addShadow(group, y, size, stretch) {
  const sh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
  sh.rotation.x = -Math.PI / 2; sh.position.y = y; sh.scale.x = stretch;
  group.add(sh);
}

/* ---------- small helpers ---------- */
const sm = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const addR = (r, e) => { const o = new Float32Array(NA); for (let j = 0; j < NA; j++) o[j] = r[j] + e; return o; };
const mulR = (r, k) => { const o = new Float32Array(NA); for (let j = 0; j < NA; j++) o[j] = r[j] * k; return o; };
const maxR = (a, b) => { const o = new Float32Array(NA); for (let j = 0; j < NA; j++) o[j] = Math.max(a[j], b[j]); return o; };
const ang = (j) => (j / NA) * Math.PI * 2;
function tube(points, radius, closed, mat) {
  const curve = new THREE.CatmullRomCurve3(points, closed, "centripetal");
  const g = new THREE.TubeGeometry(curve, Math.max(80, points.length * 3), radius, 8, closed);
  const m = new THREE.Mesh(g, mat);
  m.userData.count = g.index.count;
  g.setDrawRange(0, 0);
  return m;
}
function solid(points, radius, closed, mat, seg = 8) {
  return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, closed, "centripetal"), Math.max(40, points.length * 2), radius, seg, closed), mat);
}
function dot(p, mat) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.95, 16, 12), mat);
  m.position.copy(p); m.scale.setScalar(0.001);
  return m;
}
function geo(pos, idx) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
function solveK(target, fn, lo = 0.55, hi = 2) { /* fn(k) grows with k */
  for (let it = 0; it < 40; it++) { const mid = (lo + hi) / 2; if (fn(mid) > target) hi = mid; else lo = mid; }
  return (lo + hi) / 2;
}

/* ---------- the man ---------- */
let M = null, model = null, meas = {}, builtAt = 0;
function resetModel() {
  if (model) { scene.remove(model); model.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
  model = new THREE.Group();
  meas = { A: { parts: [] }, B: { parts: [] }, C: { parts: [] } };
}
function finish() {
  for (const k in meas) for (const p of meas[k].parts) model.add(p);
  scene.add(model);
  builtAt = performance.now();
}
function positions(f) {
  const pos = new Float32Array(M.base.length);
  for (let i = 0; i < M.n; i++) { const q = f(M.base[i * 3], M.base[i * 3 + 1], M.base[i * 3 + 2], M.arm[i] / 255); pos[i * 3] = q[0]; pos[i * 3 + 1] = q[1]; pos[i * 3 + 2] = q[2]; }
  return pos;
}
/* body context for one size: transformed vertices + slice lookups */
function bodyCtx(f, pos) {
  pos = pos || positions(f);
  const L0 = M.L;
  const X = new Float32Array(M.n), Y = new Float32Array(M.n), Z = new Float32Array(M.n);
  for (let i = 0; i < M.n; i++) { X[i] = pos[i * 3]; Y[i] = pos[i * 3 + 1]; Z[i] = pos[i * 3 + 2]; }
  const cut = makeSlicer(M.idx, M.n, (i) => M.arm[i] < 128, Y, X, Z);
  const ring = (y) => fixRing(radial(hull2(cut(y)), 0, ZC));
  const cutAll = makeSlicer(M.idx, M.n, () => true, Y, X, Z);
  const yCut = (L0.shoulder[1] - 3) * f.kY;
  /* round the shoulders a garment covers the deltoids too: above yCut the slice includes the arms, blended over 3 cm */
  const ringSh = (y) => { if (y < yCut - 2) return ring(y); const a = ring(y), b = fixRing(radial(hull2(cutAll(y)), 0, ZC)), t = sm(yCut - 2, yCut + 1, y), o = new Float32Array(NA); for (let j = 0; j < NA; j++) o[j] = a[j] + (b[j] - a[j]) * t; return o; };
  const L = M.L;
  const P = (p, w = 0, s = 1) => f.pt(p, w, s);
  return { f, pos, X, Y, Z, ring, ringSh, P, crotch: L.crotch * f.kY, ground: L.ground * f.kY, armpit: (L.shoulder[1] - 9.5) * f.kY };
}
/* chest scale k so that ring(k) = k * r0 + ease measures `circ` all the way round */
function kForChest(circ, ease, y, opts = {}) {
  const c1 = bodyCtx(fitFn(M, { ...opts, k: 1, kN: 1 }));
  const r0 = c1.ring(y);
  return solveK(circ, (k) => perimeterR(addR(mulR(r0, k), ease)));
}

/* ---------- a garment shell: rings {y, r[NA]} evenly spaced, centred on (0, ZC) ---------- */
class Shell {
  constructor(y0, y1, step, fn) {
    this.y0 = y0; this.step = step; this.rings = [];
    for (let y = y0; y >= y1 - 1e-6; y -= step) this.rings.push(fn(y));
    this.y1 = y0 - (this.rings.length - 1) * step;
  }
  r(y, j) {
    const t = Math.min(this.rings.length - 1, Math.max(0, (this.y0 - y) / this.step)), a = Math.floor(t), b = Math.min(a + 1, this.rings.length - 1), u = t - a;
    return this.rings[a][j] * (1 - u) + this.rings[b][j] * u;
  }
  ringAt(y) { const o = new Float32Array(NA); for (let j = 0; j < NA; j++) o[j] = this.r(y, j); return o; }
  pt(j, y, off = 0) { const r = this.r(y, j) + off, t = ang(j); return new V3(r * Math.sin(t), y, ZC + r * Math.cos(t)); }
  halfW(y) { return this.r(y, NA / 4); }
  /* z of the front (or back) surface where it crosses x */
  surfZ(x, y, back = false) {
    const ax = Math.abs(x); let pj = back ? NA / 2 : 0, px = 0, pz = this.r(y, pj) * (back ? -1 : 1);
    const dir = back ? -1 : 1;
    for (let s = 1; s <= NA / 4; s++) {
      const j = back ? NA / 2 - s : s, r = this.r(y, j), t = ang(j), cx = r * Math.sin(t), cz = r * Math.cos(t);
      if (cx >= ax) { const u = (ax - px) / ((cx - px) || 1); return ZC + pz + (cz - pz) * u; }
      px = cx; pz = cz;
    }
    return ZC + dir * 0;
  }
  frontZ(x, y) { return this.surfZ(x, y, false); }
  backZ(x, y) { return this.surfZ(x, y, true); }
  /* height of the shoulder line (top of the shell) at half-width x */
  topY(x) {
    let prevY = this.y0, prevW = this.halfW(this.y0);
    if (prevW >= x) return this.y0;
    for (let k = 1; k < this.rings.length; k++) {
      const y = this.y0 - k * this.step, w = this.rings[k][NA / 4];
      if (w >= x) return prevY + (y - prevY) * (x - prevW) / ((w - prevW) || 1);
      prevY = y; prevW = w;
    }
    return this.y1;
  }
  /* mesh: every column runs from top(theta) down to bottom(theta). Seam at the back.
     hole(x, y, z) marks an opening (vest armholes): each column skips one y-interval, found exactly, so the edge is smooth. */
  mesh(mat, { top, bottom, rows = 110, hole = null, off = 0 } = {}) {
    const C = NA, pos = [], idx = [], gaps = [];
    const ra = hole ? Math.round(rows * 0.3) : rows, rb = hole ? rows - ra : 0, per = hole ? ra + rb + 2 : rows + 1;
    if (hole) { /* the open interval of every column; closed columns put a zero-height gap next to their neighbour's */
      for (let c = 0; c <= C; c++) {
        const j = (c + C / 2) % C, t = ang(j), tt = t > Math.PI ? t - Math.PI * 2 : t, yt = top(tt), yb = bottom(tt);
        let hi = null, lo = null;
        for (let y = yt - 0.05; y > yb; y -= 0.2) {
          const r = this.r(y, j);
          if (hole(r * Math.sin(t), y, ZC + r * Math.cos(t))) { if (hi === null) hi = y + 0.1; lo = y - 0.1; }
        }
        gaps.push(hi === null ? null : [Math.min(hi, yt - 0.02), Math.max(lo, yb + 0.02)]);
      }
      for (let c = 0; c <= C; c++) if (!gaps[c]) {
        let best = null, bd = 1e9;
        for (let d = 1; d <= C; d++) for (const e of [c - d, c + d]) { const g = gaps[(e + C + 1) % (C + 1)]; if (g && g.length === 2 && d < bd) { bd = d; best = g; } }
        const yt = top(0), mid = best ? (best[0] + best[1]) / 2 : yt - 10;
        gaps[c] = [mid, mid, true];
      }
    }
    for (let c = 0; c <= C; c++) {
      const j = (c + C / 2) % C, t = ang(j), tt = t > Math.PI ? t - Math.PI * 2 : t;
      const yt = top(tt), yb = bottom(tt), ys = [];
      if (!hole) for (let i = 0; i <= rows; i++) ys.push(yt + (yb - yt) * (i / rows));
      else {
        const [hi, lo] = gaps[c], h2 = Math.min(hi, yt - 0.01), l2 = Math.max(Math.min(lo, h2), yb + 0.01);
        for (let i = 0; i <= ra; i++) ys.push(yt + (h2 - yt) * (i / ra));
        for (let i = 0; i <= rb; i++) ys.push(l2 + (yb - l2) * (i / rb));
      }
      for (const y of ys) { const r = this.r(y, j) + off; pos.push(r * Math.sin(t), y, ZC + r * Math.cos(t)); }
    }
    for (let c = 0; c < C; c++) for (let i = 0; i < per - 1; i++) {
      if (hole && i === ra) continue; /* the opening */
      const a = c * per + i, b = a + per;
      idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
    const rows2 = per - 1;
    const g = geo(pos, idx), n = g.attributes.normal;
    for (let i = 0; i <= rows2; i++) { /* smooth the back seam */
      const a = i, b = C * per + i, v = new V3(n.getX(a) + n.getX(b), n.getY(a) + n.getY(b), n.getZ(a) + n.getZ(b)).normalize();
      n.setXYZ(a, v.x, v.y, v.z); n.setXYZ(b, v.x, v.y, v.z);
    }
    return new THREE.Mesh(g, mat);
  }
}

/* ---------- sleeves and legs: tubes round a moving centre ---------- */
function tubeRings(rings, mat) { /* rings: [{c: V3, u: V3, w: V3, r: Float32Array}] -> closed-ring tube */
  const pos = [], idx = [], n = NA + 1;
  for (const R of rings) for (let c = 0; c <= NA; c++) {
    const j = c % NA, t = ang(j), r = R.r[j];
    const p = R.c.clone().addScaledVector(R.u, r * Math.sin(t)).addScaledVector(R.w, r * Math.cos(t));
    pos.push(p.x, p.y, p.z);
  }
  for (let i = 0; i < rings.length - 1; i++) for (let c = 0; c < NA; c++) { const a = i * n + c, b = a + n; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  return new THREE.Mesh(geo(pos, idx), mat);
}
/* arm frame for side s: axis a (shoulder to elbow), u = outward-up, w = forward */
function armFrame(ctx, s) {
  const S = ctx.P(M.L.shoulder, 0.5, s), E = ctx.P(M.L.elbow, 1, s), W = ctx.P(M.L.wrist, 1, s);
  const a = E.clone().sub(S).normalize();
  const sa = Math.abs(a.x) / Math.hypot(a.x, a.y), ca = Math.abs(a.y) / Math.hypot(a.x, a.y);
  const u = new V3(s * ca, sa, 0); u.sub(a.clone().multiplyScalar(u.dot(a))).normalize();
  const w = new V3().crossVectors(s > 0 ? a : u, s > 0 ? u : a).normalize();
  if (w.z < 0) w.negate();
  return { S, E, W, a, u, w };
}
/* sleeve rings along the arm from s0 to s1 (cm along the axis), from the arm's own convex slices, never narrower going up */
function sleeveRings(ctx, s, s0, s1, ease0, ease1, step = 1) {
  /* two straight segments: upper arm (shoulder to elbow) and forearm (elbow to wrist); every slice is square to its own segment */
  const F = armFrame(ctx, s), list = [];
  const a2 = F.W.clone().sub(F.E).normalize();
  const u2 = F.u.clone().sub(a2.clone().multiplyScalar(F.u.dot(a2))).normalize();
  const w2 = new V3().crossVectors(a2, u2).normalize(); if (w2.dot(F.w) < 0) w2.negate();
  const lenU = F.E.clone().sub(F.S).dot(F.a), lenF = F.W.distanceTo(F.E) - 1.5;
  const seg = [[F.S, F.a, F.u, F.w], [F.E, a2, u2, w2]].map(([O, ax, u, w]) => {
    const SA = new Float32Array(M.n), UA = new Float32Array(M.n), WA = new Float32Array(M.n);
    for (let i = 0; i < M.n; i++) {
      const dx = ctx.X[i] - O.x, dy = ctx.Y[i] - O.y, dz = ctx.Z[i] - O.z;
      SA[i] = dx * ax.x + dy * ax.y + dz * ax.z; UA[i] = dx * u.x + dy * u.y + dz * u.z; WA[i] = dx * w.x + dy * w.y + dz * w.z;
    }
    return { O, ax, u, w, cut: makeSlicer(M.idx, M.n, (i) => M.arm[i] >= 200 && ctx.X[i] * s > 0, SA, UA, WA) };
  });
  const raw = [];
  for (let t = s0; t <= s1 + 1e-6; t += step) {
    const g = t <= lenU ? seg[0] : seg[1], lt = t <= lenU ? THREE.MathUtils.clamp(t, 2, lenU) : Math.min(t - lenU, lenF);
    raw.push({ t, g, lt: t <= lenU ? t : t - lenU, r: fixRing(radial(hull2(g.cut(lt)), 0, 0), 2) });
  }
  for (let k = raw.length - 2; k >= 0; k--) raw[k].r = maxR(raw[k].r, raw[k + 1].r); /* a sleeve hangs, it never narrows toward the shoulder */
  for (const R of raw) {
    const e = lerp(ease0, ease1, (R.t - s0) / ((s1 - s0) || 1));
    let mean = 0; for (let j = 0; j < NA; j++) mean += R.r[j]; mean /= NA;
    for (let j = 0; j < NA; j++) R.r[j] = 0.55 * R.r[j] + 0.45 * mean + e;
    list.push({ t: R.t, c: R.g.O.clone().addScaledVector(R.g.ax, R.lt), u: R.g.u, w: R.g.w, r: R.r });
  }
  return { F, rings: list };
}

/* both trouser legs at height y, as one ring round (0, ZC) */
function legsRing(LW, y) {
  const pts = [];
  for (const leg of LW.legs) {
    const R = leg.rings.reduce((p, q) => (Math.abs(q.c.y - y) < Math.abs(p.c.y - y) ? q : p));
    for (let j = 0; j < NA; j += 2) { const t = ang(j); pts.push([R.c.x + R.r[j] * Math.sin(t), R.c.z + R.r[j] * Math.cos(t)]); }
  }
  return fixRing(radial(hull2(pts), 0, ZC), 0);
}

/* ---------- legwear: seat + two legs, and shoes ---------- */
function legwear(ctx, style, opt = {}) {
  const { f } = ctx, L = M.L;
  const jog = style === "jogger";
  const mat = opt.mat || (jog ? mTee : style === "chino" ? mChino : mTrouser);
  const eSeat = jog ? 2.0 : 1.3, eLeg = jog ? 2.2 : 1.8;
  const yW = (L.pelvis[1] + 13) * f.kY, yC = ctx.crotch;
  const hemY = jog ? (L.ankle[1] + 1.5) * f.kY : (L.ankle[1] - 1.5) * f.kY;
  const seat = new Shell(yW + 0.6, yC + 3.5, 0.6, (y) => {
    let r = addR(ctx.ring(y), eSeat);
    if (opt.inner && y > opt.innerTo) r = maxR(r, addR(opt.inner(y), 0.35));
    return r;
  });
  model.add(seat.mesh(mat, { top: (t) => yW + 0.6 + 0.8 * Math.max(0, -Math.cos(t)), bottom: () => yC + 3.5, rows: 40 }));
  const legs = [];
  for (const s of [1, -1]) {
    const cut = makeSlicer(M.idx, M.n, (i) => M.arm[i] < 128 && ctx.X[i] * s > 0 && ctx.Y[i] < yC + 10, ctx.Y, ctx.X, ctx.Z);
    const hip = ctx.P(L.hip, 0, s), ank = ctx.P(L.ankle, 0, s);
    const cen = (y) => { const t = Math.min(1, Math.max(0, (hip.y - y) / (hip.y - ank.y))); return new V3(lerp(hip.x, ank.x, t), y, lerp(hip.z, ank.z, t)); };
    const rings = []; let prev = null;
    for (let y = yC + 6; y >= hemY - 1e-6; y -= 0.7) {
      const c = cen(y), body = fixRing(radial(hull2(cut(y)), c.x, c.z), 1);
      let r = addR(body, eLeg);
      if (prev && !jog && y < yC - 3) r = maxR(r, mulR(prev, 0.996)); /* trousers fall straight from the thigh */
      if (jog && y < hemY + 5) r = mulR(r, lerp(1, 0.9, sm(hemY + 5, hemY + 3, y))); /* gathered cuff */
      prev = r; rings.push({ c, u: new V3(1, 0, 0), w: new V3(0, 0, 1), r });
    }
    model.add(tubeRings(rings, mat));
    if (jog) { /* rib cuff */
      const cr = rings.filter((R) => R.c.y < hemY + 3.5).map((R) => ({ ...R, r: addR(R.r, 0.15) }));
      model.add(tubeRings(cr, mRib));
    }
    legs.push({ s, rings, cen });
  }
  /* waistband: rib for joggers, a belt for trousers */
  const wbTop = yW + 0.6, wbBot = yW - (jog ? 4 : 3.4);
  const band = new Shell(wbTop + 0.8, wbBot, 0.4, (y) => addR(seat.ringAt(Math.min(y, seat.y0)), 0.35));
  model.add(band.mesh(jog ? mRib : mBelt, { top: (t) => wbTop + 0.8 * Math.max(0, -Math.cos(t)), bottom: () => wbBot, rows: 6 }));
  if (opt.covered) { /* a top hangs over the waistband: no buckle or cords to poke through */ }
  else if (!jog) {
    const bz = band.frontZ(0, wbTop - 1.7);
    const buckle = new THREE.Mesh(new THREE.BoxGeometry(4.2, 3.4, 0.5), mBuckle); buckle.position.set(0, wbTop - 1.6, bz + 0.25); model.add(buckle);
  } else {
    for (const s of [1, -1]) {
      const z = band.frontZ(1.4, wbTop - 2);
      model.add(solid([new V3(s * 1.2, wbTop - 2, z + 0.3), new V3(s * 1.8, wbTop - 7, z + 0.9), new V3(s * 1.4, wbTop - 12, z + 1.1)], 0.28, false, mShirtBody, 6));
    }
  }
  return { seat, band, legs, yW: wbTop, hemY, yC };
}

/* ---------- shoes: oxford (formal) or sneaker, built round a last; heel at z = 0, toe at +z, sole on y = 0.
   side = +1 left (outer side +x), -1 right. fit = optional foot profile so the shoe always covers the foot. ---------- */
const mOx = new THREE.MeshPhysicalMaterial({ color: 0x33190d, roughness: 0.42, clearcoat: 0.5, clearcoatRoughness: 0.3, side: THREE.DoubleSide });
const mOxSole = new THREE.MeshStandardMaterial({ color: 0x1a120c, roughness: 0.65 });
const mOxHeel = new THREE.MeshStandardMaterial({ color: 0x2a1b12, roughness: 0.55 });
const mLace = new THREE.MeshStandardMaterial({ color: 0x1c140f, roughness: 0.6 });
const mLining = new THREE.MeshStandardMaterial({ color: 0x5a3c26, roughness: 0.8, side: THREE.DoubleSide });
const mSnk = new THREE.MeshPhysicalMaterial({ color: 0xf3f1ed, roughness: 0.55, sheen: 0.3, side: THREE.DoubleSide });
const mSnkMid = new THREE.MeshStandardMaterial({ color: 0xfbfbf9, roughness: 0.75 });
const mSnkOut = new THREE.MeshStandardMaterial({ color: 0x2a2623, roughness: 0.9 });
const mSnkLace = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 });
const mSnkLining = new THREE.MeshStandardMaterial({ color: 0xdedad3, roughness: 0.9, side: THREE.DoubleSide });

/* monotone cubic through [x, y] points (Fritsch-Carlson): smooth, never overshoots */
function pchip(P) {
  const n = P.length, d = [], m = new Array(n).fill(0);
  for (let k = 0; k < n - 1; k++) d.push((P[k + 1][1] - P[k][1]) / (P[k + 1][0] - P[k][0]));
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let k = 1; k < n - 1; k++) m[k] = d[k - 1] * d[k] <= 0 ? 0 : (2 * d[k - 1] * d[k]) / (d[k - 1] + d[k]);
  return (x) => {
    if (x <= P[0][0]) return P[0][1];
    for (let k = 0; k < n - 1; k++) if (x <= P[k + 1][0]) {
      const h = P[k + 1][0] - P[k][0], t = (x - P[k][0]) / h, t2 = t * t, t3 = t2 * t;
      return (2 * t3 - 3 * t2 + 1) * P[k][1] + (t3 - 2 * t2 + t) * h * m[k] + (-2 * t3 + 3 * t2) * P[k + 1][1] + (t3 - t2) * h * m[k + 1];
    }
    return P[n - 1][1];
  };
}
function makeShoe(style, Ls, side = 1, fit = null) {
  const ox = style === "oxford", g = new THREE.Group();
  const Ws = Ls * (ox ? 0.365 : 0.395);
  const base = (t, p) => {
    let w;
    if (t < 0.07) w = 0.66 * Math.sqrt(Math.max(0, 1 - Math.pow((0.07 - t) / 0.07, 2)));
    else if (t < 0.68) w = 0.66 + 0.34 * Math.sin(((t - 0.07) / 0.61) * Math.PI / 2);
    else w = Math.pow(Math.max(0, 1 - Math.pow((t - 0.68) / 0.32, p)), 0.5);
    return w;
  };
  const P = ox ? 2.0 : 2.7;
  const outer = (t) => Math.max(0.05, (Ws / 2) * base(t, P) * (1 + 0.05 * Math.sin(Math.PI * t)) * (fit ? Math.max(1, fit.wOut(t) / ((Ws / 2) * base(t, P) * 0.92 || 1)) : 1));
  const inner = (t) => Math.max(0.05, (Ws / 2) * base(t, P) * (1 - 0.07 * Math.sin(Math.PI * Math.min(1, Math.max(0, (t - 0.25) / 0.5)))) * (fit ? Math.max(1, fit.wIn(t) / ((Ws / 2) * base(t, P) * 0.9 || 1)) : 1));
  /* sole lift: oxford sits on a 2.4 cm heel, sneaker on a thick flat midsole; the toe springs up */
  const lift = (t) => (ox ? 2.4 * (1 - sm(0.22, 0.58, t)) : 0) + 0.9 * Math.pow(Math.max(0, (t - 0.78) / 0.22), 2);
  const soleT = ox ? 1.1 : 3.0;
  const N = 90, xAt = (t, sgn) => side * sgn * (sgn > 0 ? outer(t) : inner(t));
  const outline = [];
  for (let k = 0; k <= N; k++) { const t = k / N; outline.push([xAt(t, 1), t * Ls]); }
  for (let k = N; k >= 0; k--) { const t = k / N; outline.push([xAt(t, -1), t * Ls]); }
  /* sole slab, bent to the lift line */
  const slab = (thick, yBase, mat, grow = 0) => {
    const sh = new THREE.Shape();
    outline.forEach((p, k) => { const t = p[1] / Ls, cx = p[0] * (1 + grow / Math.max(1, Math.abs(p[0]))); k ? sh.lineTo(cx, -p[1]) : sh.moveTo(cx, -p[1]); });
    const sg = new THREE.ExtrudeGeometry(sh, { depth: thick, bevelEnabled: true, bevelThickness: Math.min(0.35, thick / 3), bevelSize: 0.3, bevelSegments: 3, curveSegments: 4 });
    sg.rotateX(-Math.PI / 2);
    const pa = sg.attributes.position;
    for (let k = 0; k < pa.count; k++) { const t = Math.min(1, Math.max(0, pa.getZ(k) / Ls)); pa.setY(k, pa.getY(k) + yBase + lift(t)); }
    sg.computeVertexNormals();
    return new THREE.Mesh(sg, mat);
  };
  if (ox) {
    g.add(slab(soleT, 0.05, mOxSole));
    /* stacked heel under the back */
    const hs = new THREE.Shape(); const hk = 30;
    for (let k = 0; k <= hk; k++) { const t = 0.235 * k / hk; const p = [xAt(t, 1) * 0.96, -t * Ls]; k ? hs.lineTo(p[0], p[1]) : hs.moveTo(p[0], p[1]); }
    for (let k = hk; k >= 0; k--) { const t = 0.235 * k / hk; hs.lineTo(xAt(t, -1) * 0.96, -t * Ls); }
    const hg = new THREE.ExtrudeGeometry(hs, { depth: 2.4, bevelEnabled: false }); hg.rotateX(-Math.PI / 2);
    g.add(new THREE.Mesh(hg, mOxHeel));
    const tl = new THREE.ExtrudeGeometry(hs, { depth: 0.35, bevelEnabled: false }); tl.rotateX(-Math.PI / 2);
    g.add(new THREE.Mesh(tl, mOxSole));
  } else {
    g.add(slab(0.55, 0, mSnkOut, 0.1));
    g.add(slab(soleT - 0.55, 0.55, mSnkMid, 0.15));
  }
  const yTopSole = (t) => (ox ? 0.05 + soleT + 0.35 : soleT) + lift(t);
  /* welt stitch line round the top of the sole */
  const welt = outline.filter((_, k) => k % 3 === 0).map((p) => new V3(p[0] * 1.0, yTopSole(p[1] / Ls) + 0.05, p[1]));
  g.add(solid(welt, ox ? 0.17 : 0.12, true, ox ? mOxSole : mSnkMid, 6));

  /* upper height over the last: heel counter, instep, toe box */
  const HT = ox ? [[0, 5.8], [0.05, 6.7], [0.28, 6.9], [0.44, 7.4], [0.6, 6.2], [0.78, 4.3], [0.9, 3.2], [0.965, 2.3], [1, 0.5]]
                : [[0, 6.4], [0.06, 7.2], [0.3, 7.2], [0.42, 8.2], [0.56, 7.4], [0.76, 5.0], [0.9, 3.9], [0.97, 2.8], [1, 0.5]];
  const htab = pchip(HT); /* smooth through the points: no ridges across the vamp */
  const H = (t) => (fit && t > 0.36 ? Math.max(htab(t), fit.top(t) - yTopSole(t) + 0.7) : htab(t));
  const collar = (t) => (ox ? 5.7 : 6.0) + (t < 0.05 ? 1.0 * (1 - t / 0.05) : 0) + 1.4 * sm(0.26, 0.4, t);
  const OPEN = 0.4, rows = 120, M_ = 36;
  const P3 = (t, ph) => { /* point on the upper: ph 0 = inner sole edge, PI = outer sole edge */
    const xi = xAt(t, -1) * 0.985, xo = xAt(t, 1) * 0.985, u = (1 - Math.cos(ph)) / 2, s = Math.sin(ph);
    const bulge = 1 + 0.05 * Math.pow(s, 0.5) * (1 - s);
    return new V3(lerp(xi, xo, u) * bulge, yTopSole(t) + H(t) * Math.pow(s, 0.62), t * Ls);
  };
  const phiAt = (t) => { const c = Math.min(0.999, collar(t) / H(t)); return Math.asin(Math.pow(c, 1 / 0.62)); };
  /* walls round the heel (opening on top), then the closed vamp */
  const grid = (t0, t1, ph0, ph1, mat) => {
    const pos = [], idx = [], R = Math.max(2, Math.round(rows * (t1 - t0)));
    for (let r = 0; r <= R; r++) { const t = t0 + (t1 - t0) * r / R; for (let c = 0; c <= M_; c++) { const p = P3(t, ph0(t) + (ph1(t) - ph0(t)) * c / M_); pos.push(p.x, p.y, p.z); } }
    for (let r = 0; r < R; r++) for (let c = 0; c < M_; c++) { const a = r * (M_ + 1) + c, b = a + M_ + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
    g.add(new THREE.Mesh(geo(pos, idx), mat));
  };
  const upMat = ox ? mOx : mSnk;
  grid(0, OPEN, () => 0, (t) => phiAt(t), upMat);
  grid(0, OPEN, (t) => Math.PI - phiAt(t), () => Math.PI, upMat);
  grid(OPEN, 1, () => 0, () => Math.PI, upMat);
  /* collar edge piping + lining */
  for (const sgn of [1, -1]) {
    const pts = []; for (let k = 0; k <= 24; k++) { const t = OPEN * k / 24; pts.push(P3(t, sgn > 0 ? phiAt(t) : Math.PI - phiAt(t))); }
    g.add(solid(pts, 0.22, false, upMat, 6));
  }
  const back = []; for (let k = 0; k <= 12; k++) back.push(P3(0.004, phiAt(0.004) + (Math.PI - 2 * phiAt(0.004)) * k / 12));
  g.add(solid(back, 0.22, false, upMat, 6));
  const ins = new THREE.Shape(); outline.forEach((p, k) => { if (p[1] / Ls > OPEN + 0.05) return; k ? ins.lineTo(p[0] * 0.9, -p[1]) : ins.moveTo(p[0] * 0.9, -p[1]); });
  const ig = new THREE.ShapeGeometry(ins); ig.rotateX(-Math.PI / 2);
  const insole = new THREE.Mesh(ig, ox ? mLining : mSnkLining); insole.position.y = yTopSole(0.15) + 0.05; g.add(insole);

  /* lacing on the instep: closed bar lacing (oxford) or criss-cross over a tongue (sneaker) */
  const lt0 = OPEN, lt1 = ox ? 0.6 : 0.64, gap = ox ? 0.35 : 1.0, nL = ox ? 5 : 6;
  const onTop = (t, x, off) => { const p = P3(t, Math.PI / 2); return new V3(x, p.y + off, t * Ls); };
  if (!ox) { /* tongue rising out of the opening */
    const tg = []; for (let k = 0; k <= 10; k++) { const t = lerp(0.3, OPEN + 0.02, k / 10); tg.push(onTop(t, 0, 0.4 + 1.6 * (1 - k / 10))); }
    const tw = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(tg), 20, 0.5, 8), mSnk); tw.scale.x = 3.2; g.add(tw);
  }
  for (const sgn of [1, -1]) { /* lace-panel edges */
    const pts = []; for (let k = 0; k <= 12; k++) { const t = lerp(lt0, lt1, k / 12); pts.push(onTop(t, sgn * (gap + 0.2), 0.12)); }
    g.add(solid(pts, ox ? 0.14 : 0.18, false, ox ? mOx : mSnk, 6));
  }
  for (let k = 0; k < nL; k++) {
    const t = lerp(lt0 + 0.02, lt1 - 0.015, k / (nL - 1)), y = onTop(t, 0, 0).y;
    for (const sgn of [1, -1]) { const e = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.07, 6, 12), mBuckle); e.rotation.x = Math.PI / 2; e.position.set(sgn * (gap + 0.45), y + 0.2, t * Ls); g.add(e); }
    if (ox) g.add(solid([new V3(-(gap + 0.45), y + 0.28, t * Ls), new V3(0, y + 0.36, t * Ls), new V3(gap + 0.45, y + 0.28, t * Ls)], 0.1, false, mLace, 5));
    else if (k < nL - 1) {
      const t2 = lerp(lt0 + 0.02, lt1 - 0.015, (k + 1) / (nL - 1)), y2 = onTop(t2, 0, 0).y;
      for (const sgn of [1, -1]) g.add(solid([new V3(sgn * (gap + 0.45), y + 0.3, t * Ls), new V3(0, (y + y2) / 2 + 0.5, (t + t2) / 2 * Ls), new V3(-sgn * (gap + 0.45), y2 + 0.3, t2 * Ls)], 0.13, false, mSnkLace, 5));
    }
  }
  if (!ox) { /* a bow at the top eyelets */
    const t = lt0 + 0.02, y = onTop(t, 0, 0).y + 0.6;
    for (const sgn of [1, -1]) g.add(solid([new V3(0, y, t * Ls), new V3(sgn * 1.4, y + 0.5, t * Ls - 0.9), new V3(sgn * 2.2, y - 0.2, t * Ls - 0.3), new V3(0, y, t * Ls)], 0.12, false, mSnkLace, 5));
  }
  /* toe cap seam (oxford) / toe overlay (sneaker), and a heel tab */
  const capT = ox ? 0.8 : 0.78, cap = [];
  for (let k = 0; k <= 30; k++) { const ph = (k / 30) * Math.PI; const t = capT + (ox ? 0.035 : 0.02) * Math.sin(ph); cap.push(P3(t, ph).add(new V3(0, 0.03, 0))); }
  g.add(solid(cap, ox ? 0.07 : 0.1, false, ox ? mOxSole : mSnkMid, 5));
  const tab = []; for (let k = 0; k <= 10; k++) { const p = P3(0.002, Math.PI / 2 + (k / 10 - 0.5) * 0.5); tab.push(new V3(p.x, collar(0) * 0.5 + yTopSole(0) + (k / 10) * 0 , -0.25)); }
  if (!ox) { const ht = new THREE.Mesh(new THREE.BoxGeometry(2.2, 3.6, 0.6), mSnkOut); ht.position.set(0, yTopSole(0) + collar(0) - 1.2, -0.15); g.add(ht); }
  g.userData = { Ls, ytop: yTopSole, H };
  return g;
}
/* shoes on the man: fitted to each foot */
function shoesOn(ctx, style) {
  const L = M.L, out = [];
  for (const s of [1, -1]) {
    const ank = ctx.P(L.ankle, 0, s), ids = [];
    for (let i = 0; i < M.n; i++) if (M.arm[i] < 128 && ctx.X[i] * s > 0 && ctx.Y[i] < ank.y + 2) ids.push(i);
    let heel = null, toe = null;
    for (const i of ids) { const z = ctx.pos[i * 3 + 2]; if (!heel || z < heel.z) heel = new V3(ctx.pos[i * 3], ctx.pos[i * 3 + 1], z); if (!toe || z > toe.z) toe = new V3(ctx.pos[i * 3], ctx.pos[i * 3 + 1], z); }
    const dir = new V3(toe.x - heel.x, 0, toe.z - heel.z), len = dir.length(); dir.normalize();
    const perp = new V3(dir.z, 0, -dir.x).multiplyScalar(s); /* toward the outer side */
    const NB = 24, wO = new Float32Array(NB), wI = new Float32Array(NB), tp = new Float32Array(NB).fill(-1e9);
    const Ls = len + 2.0, h0 = heel.clone().addScaledVector(dir, -1.0);
    for (const i of ids) {
      const p = new V3(ctx.pos[i * 3], ctx.pos[i * 3 + 1], ctx.pos[i * 3 + 2]).sub(h0);
      const t = Math.min(NB - 1, Math.max(0, Math.floor((p.dot(dir) / Ls) * NB))), lat = p.dot(perp);
      wO[t] = Math.max(wO[t], lat); wI[t] = Math.max(wI[t], -lat); tp[t] = Math.max(tp[t], p.y + ctx.pos[i * 3 + 1] - ctx.pos[i * 3 + 1] + h0.y - ctx.ground);
    }
    const at = (A) => (t) => { const x = Math.min(NB - 1.001, Math.max(0, t * NB - 0.5)), a = Math.floor(x); return lerp(A[a], A[a + 1], x - a); };
    const fit = { wOut: (t) => at(wO)(t) + 0.55, wIn: (t) => at(wI)(t) + 0.55, top: at(tp) };
    const shoe = makeShoe(style, Ls, s, fit);
    shoe.position.set(h0.x, ctx.ground, h0.z);
    shoe.rotation.y = Math.atan2(dir.x, dir.z);
    model.add(shoe); out.push(shoe);
  }
  return out;
}

/* ---------- tops: tee, gym tee, gym vest, dress shirt (on the man, with trousers and shoes) ---------- */
const O = 1.6;
function buildTop(i, opts = {}) {
  resetModel();
  const P = FV.data, shirt = !!opts.shirt, vest = !!P.sleeveless;
  const kY = 1.03, yB0 = M.L.shoulder[1] - 9.5, yB = yB0 * kY;
  let k, kN;
  if (shirt) { /* the collar is the size: neck ring (+ room for a finger) = collar, body grows with the neck */
    const c1 = bodyCtx(fitFn(M, { k: 1, kN: 1, kY }));
    const n0 = perimeterR(c1.ring(3.3));
    kN = THREE.MathUtils.clamp((opts.collarCm - 2.4) / n0, 0.85, 1.35);
    const r0 = c1.ring(yB); k = solveK(2.5 * opts.collarCm, (q) => perimeterR(addR(mulR(r0, q), 1.9))); /* a 41 collar wears about a 105 cm shirt chest */
  } else {
    const Wcm = P.dims.width.cm[i];
    k = kForChest(2 * Wcm, O, yB, { kY }); kN = Math.sqrt(k);
  }
  const f = fitFn(M, { k, kN, kY });
  const man = buildMan(M, f); model.add(man.group);
  const ctx = bodyCtx(f, man.pos);
  addShadow(model, ctx.ground - 0.05, 120, 0.8);
  if (vest) delete meas.C;
  if (shirt) meas = { A: { parts: [] } };

  /* shell: follows the body to the chest, then falls straight (a little taper on fitted cuts) */
  const L = shirt ? 0 : P.dims.length.cm[i], S = P.dims.sleeve ? P.dims.sleeve.cm[i] : 0;
  const yTop = 0.9, ease = shirt ? 1.5 : O;
  const lowWaist = (M.L.pelvis[1] + 13) * kY;
  const hemY = shirt ? lowWaist - 6 : -L + 0.6;
  const taper = FV.product === "gymtee" ? 0.07 : vest ? 0.05 : shirt ? 0.1 : 0.02;
  const rChest = addR(ctx.ring(yB), ease);
  const gym = FV.product === "gymtee" || vest;
  const LW = shirt ? null : legwear(ctx, gym ? "jogger" : "chino", { covered: true });
  const shell = new Shell(yTop + 1.2, hemY, 0.6, (y) => {
    let r = addR(vest ? ctx.ring(y) : ctx.ringSh(y), ease);
    if (y < yB) r = maxR(r, mulR(rChest, 1 - taper * Math.min(1, (yB - y) / 40)));
    if (LW && y < LW.yW + 1.5) r = maxR(r, addR(y > LW.band.y1 ? LW.band.ringAt(y) : y > LW.seat.y1 ? LW.seat.ringAt(y) : legsRing(LW, y), 0.6)); /* hang over the trousers */
    const fl = Math.max(0, 1 - (y - hemY) / 8) * 0.5; /* hem flare */
    return addR(r, fl);
  });
  const neckDrop = vest ? 9 : shirt ? 0 : 3.2, backDrop = vest ? 2.5 : 0;
  const topEdge = (t) => yTop - neckDrop * Math.pow(Math.max(0, Math.cos(t)), 2) - backDrop * Math.pow(Math.max(0, -Math.cos(t)), 2);
  let hole = null;
  const yArm = (yB0 - 3) * kY, yS = -1;
  if (vest) { /* tank armholes: everything outside the 5 cm strap, down to just under the armpit, in a deep U */
    const xs = shell.halfW(yTop) + 5.2;
    hole = (x, y, z) => {
      if (y < yArm) return false;
      const zh = 14 * Math.sqrt(Math.min(1, Math.max(0, (y - yArm) / (yS - yArm))));
      return Math.abs(x) > xs && Math.abs(z - ZC) < zh;
    };
  }
  const body = shell.mesh(shirt ? mShirtBody : mTee, { top: topEdge, bottom: () => hemY, rows: 130, hole });
  model.add(body);

  /* neckline rib (tee / vest) or a standing collar band whose circumference is the shirt size */
  const neckPts = [];
  for (let c = 0; c <= 64; c++) { const j = Math.round((c / 64) * NA) % NA, t = ang(j), tt = t > Math.PI ? t - 2 * Math.PI : t; neckPts.push(shell.pt(j, topEdge(tt), 0.1)); }
  model.add(solid(neckPts, shirt ? 0.5 : 0.7, true, shirt ? mShirtBody : mRib, 8));
  const nW = shell.halfW(yTop), nWb = shell.halfW(yTop);
  if (shirt) {
    const r = opts.collarCm / (2 * Math.PI), yc = yTop + 2.4;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(r, r + 0.45, 4.4, 64, 1, true), mShirtBody);
    band.position.set(0, yc, ZC); model.add(band);
    const top = []; for (let c = 0; c <= 64; c++) { const t = (c / 64) * Math.PI * 2; top.push(new V3(r * Math.sin(t), yc + 2.2, ZC + r * Math.cos(t))); }
    model.add(solid(top, 0.18, true, mShirtBody, 6));
    for (const s of [1, -1]) { /* collar points */
      const pts = [new V3(s * 0.4, yc + 2.1, ZC + r + 0.15), new V3(s * 2.6, yc - 2.2, ZC + r + 0.9), new V3(s * 4.4, yc - 1.4, ZC + r * 0.8)];
      const g = new THREE.BufferGeometry().setFromPoints([pts[0], pts[1], pts[2], new V3(s * 3.8, yc + 2.1, ZC + r * 0.72)]);
      g.setIndex([0, 1, 2, 0, 2, 3]); g.computeVertexNormals(); model.add(new THREE.Mesh(g, mShirtBody));
    }
    const btn = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 8), mButton);
    btn.scale.z = 0.5; btn.position.set(0, yc - 0.6, ZC + r + 0.35); model.add(btn);
    for (let y = -6; y > hemY + 4; y -= 9) {
      const b2 = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 8), mButton);
      b2.scale.z = 0.5; b2.position.set(0, y, shell.frontZ(0, y) + 0.3); model.add(b2);
    }
    const ptsA = [];
    for (let j = 0; j < 120; j++) { const t = (j / 120) * Math.PI * 2; ptsA.push(new V3((r + 0.75) * Math.cos(t), yc + 0.4, ZC + (r + 0.75) * Math.sin(t))); }
    meas.A.parts.push(tube(ptsA, 0.38, true, mMeas.A));
    meas.A.anchor = () => { const th = Math.atan2(camera.position.x, camera.position.z) + 0.7; return new V3((r + 1.2) * Math.sin(th), yc + 0.4, ZC + (r + 1.2) * Math.cos(th)); };
    meas.A.normal = null;
  } else {
    const lz0 = shell.frontZ(0, -8), lz1 = shell.frontZ(0, -10), ly = vest ? -12.5 : -9.5;
    const logo = new THREE.Mesh(new THREE.PlaneGeometry(6.6, 7.9), new THREE.MeshBasicMaterial({ map: logoTex, transparent: true, color: 0xe6e6e6, polygonOffset: true, polygonOffsetFactor: -4, depthWrite: false }));
    logo.position.set(0, ly, shell.frontZ(0, ly) + 0.15); logo.rotation.x = Math.atan((lz0 - lz1) / 2); model.add(logo);
  }

  /* hem rib */
  const hemPts = []; for (let c = 0; c <= 64; c++) hemPts.push(shell.pt(Math.round((c / 64) * NA) % NA, hemY + 0.3, 0.05));
  model.add(solid(hemPts, shirt ? 0.3 : 0.45, true, shirt ? mShirtBody : mTee, 6));

  /* sleeves: the C line is center back of the collar, round the neckline, along the shoulder to the shoulder point, then down the sleeve */
  let ptsC = null;
  if (!vest) {
    const F = armFrame(ctx, 1);
    const shW = P.dims.shoulder ? P.dims.shoulder.cm[i] / 2 : F.S.x + 3.2 * k;
    const spX = Math.min(shW, shell.halfW(F.S.y + 1) - 0.3);
    const SP = new V3(spX, shell.topY(spX) + 0.45, ZC);
    const seam = [];
    for (let c = 0; c <= 6; c++) { const j = NA / 2 - Math.round((c / 6) * (NA / 4)); seam.push(shell.pt(j, topEdge(ang(j) > Math.PI ? ang(j) - 2 * Math.PI : ang(j)) + 0.35, 0.4)); }
    for (let x = nW + 1.6; x < spX - 0.8; x += 1.2) seam.push(new V3(x, shell.topY(x) + 0.45, ZC));
    seam.push(SP);
    let seamLen = 0; for (let c = 1; c < seam.length; c++) seamLen += seam[c].distanceTo(seam[c - 1]);
    const sSP = SP.clone().sub(F.S).dot(F.a);
    const len = shirt ? F.W.clone().sub(F.S).dot(F.a) + 2.5 - sSP : THREE.MathUtils.clamp(S - seamLen, 8, 42);
    const s0 = -2, s1 = sSP + len;
    for (const s of [1, -1]) {
      const R = sleeveRings(ctx, s, s0, s1, shirt ? 0.9 : 1.0, shirt ? 0.8 : 2.1, 0.8);
      model.add(tubeRings(R.rings, shirt ? mShirtBody : mTee));
      const end = R.rings[R.rings.length - 1], cuffPts = [];
      for (let c = 0; c <= 48; c++) { const j = Math.round((c / 48) * NA) % NA, t = ang(j); cuffPts.push(end.c.clone().addScaledVector(end.u, (end.r[j] + 0.05) * Math.sin(t)).addScaledVector(end.w, (end.r[j] + 0.05) * Math.cos(t))); }
      model.add(solid(cuffPts, shirt ? 0.9 : 0.55, true, shirt ? mShirtBody : mRib, 8));
      if (s === 1 && !shirt) {
        ptsC = seam.slice();
        for (let q = 0; q <= 8; q++) { const Rq = R.rings[Math.round((q / 8) * (R.rings.length - 1))]; ptsC.push(Rq.c.clone().addScaledVector(Rq.u, Rq.r[NA / 4] + 0.35)); }
      }
    }
  }

  /* trousers + shoes under every top */
  if (shirt) legwear(ctx, "formal", { inner: (y) => shell.ringAt(y), innerTo: hemY });
  shoesOn(ctx, shirt ? "oxford" : "sneaker");

  if (shirt) { finish(); return; }

  /* ---------- measurement lines ---------- */
  /* A: length, from the shoulder beside the collar straight down the front to the hem */
  const x0 = nW + 1.6, ya = shell.topY(x0), ptsA = [];
  for (let y = ya; y > hemY; y -= 0.8) ptsA.push(new V3(-x0, y + (y === ya ? 0.45 : 0), shell.frontZ(x0, y) + 0.45));
  ptsA.push(new V3(-x0, hemY, shell.frontZ(x0, hemY) + 0.45));
  meas.A.parts.push(tube(ptsA, 0.38, false, mMeas.A), dot(ptsA[0], mMeas.A), dot(ptsA[ptsA.length - 1], mMeas.A));
  const aAnchor = ptsA[Math.floor(ptsA.length * 0.62)];
  meas.A.anchor = () => aAnchor; meas.A.normal = FWD;

  /* B: chest tape, a level ring round the fullest part of the chest */
  const ptsB = []; for (let j = 0; j < NA; j++) ptsB.push(shell.pt(j, yB, 0.6));
  meas.B.parts.push(tube(ptsB, 0.55, true, mMeas.B));
  meas.B.anchor = () => {
    const th0 = Math.atan2(camera.position.x, camera.position.z), th = th0 + (Math.cos(th0) >= 0 ? -0.8 : 0.8);
    const j = ((Math.round((th / (Math.PI * 2)) * NA) % NA) + NA) % NA; return shell.pt(j, yB, 1.2);
  };
  meas.B.normal = null;

  if (ptsC) {
    meas.C.parts.push(tube(ptsC, 0.38, false, mMeas.C), dot(ptsC[0], mMeas.C), dot(ptsC[ptsC.length - 1], mMeas.C));
    const cEnd = ptsC[ptsC.length - 1];
    meas.C.anchor = () => cEnd; meas.C.normal = new V3(1, 0, 0);
  }
  finish();
}
function buildShirt(i) { buildTop(i, { shirt: true, collarCm: FV.data.dims.collar.cm[i] }); }

/* ---------- duffle bag, built from the real cm specs: A width (end to end), B depth, C height ---------- */
const mBag = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.82, side: THREE.DoubleSide });
const mPanel = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.85, side: THREE.DoubleSide });

function buildBag() {
  resetModel();
  const D = FV.data.dims;
  const L = D.width.cm[0], Rz = D.depth.cm[0] / 2, Ry = D.height.cm[0] / 2, hx = L / 2;

  /* barrel body lying along x */
  const bodyGeo = new THREE.CylinderGeometry(1, 1, L, 96, 1, true); bodyGeo.rotateZ(Math.PI / 2);
  const body = new THREE.Mesh(bodyGeo, mBag); body.scale.set(1, Ry, Rz); model.add(body);

  /* round end panels with piping */
  for (const s of [1, -1]) {
    const capGeo = new THREE.CircleGeometry(1, 96); capGeo.rotateY(s * Math.PI / 2);
    const cap = new THREE.Mesh(capGeo, mPanel); cap.scale.set(1, Ry, Rz); cap.position.x = s * hx; model.add(cap);
    const pipeGeo = new THREE.TorusGeometry(1, 0.03, 8, 128); pipeGeo.rotateY(Math.PI / 2);
    const pipe = new THREE.Mesh(pipeGeo, mRib); pipe.scale.set(Ry, Ry, Rz); pipe.position.x = s * hx; model.add(pipe);
  }

  /* zip along the top */
  const zip = new THREE.Mesh(new THREE.BoxGeometry(L - 5, 0.5, 1.4), mRib); zip.position.y = Ry + 0.05; model.add(zip);
  const teeth = new THREE.Mesh(new THREE.BoxGeometry(L - 5, 0.3, 0.35), mStand); teeth.position.y = Ry + 0.35; model.add(teeth);
  const pull = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.35, 3.2), mStand); pull.position.set(hx - 5, Ry + 0.6, 1.4); model.add(pull);

  /* two carry handles that meet in a wrapped grip */
  const ang2 = THREE.MathUtils.degToRad(42), ya = Ry * Math.cos(ang2), za = Rz * Math.sin(ang2);
  for (const s of [1, -1]) {
    const pts = [[-7.5, ya, za], [-6.5, ya + 6, za * 0.55], [-2.5, ya + 10.5, za * 0.1], [2.5, ya + 10.5, za * 0.1], [6.5, ya + 6, za * 0.55], [7.5, ya, za]]
      .map((p) => new V3(p[0], p[1], s * p[2]));
    model.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, "centripetal"), 60, 0.65, 10), mBag));
  }
  const gripGeo = new THREE.CylinderGeometry(1.5, 1.5, 9, 24); gripGeo.rotateZ(Math.PI / 2);
  const grip = new THREE.Mesh(gripGeo, mRib); grip.position.y = ya + 10.6; model.add(grip);

  /* shoulder strap from the end panels, with a pad */
  const strapPts = [[-hx + 1.2, Ry * 0.72], [-hx - 1.6, Ry + 10], [-hx + 4, Ry + 24], [0, Ry + 28], [hx - 4, Ry + 24], [hx + 1.6, Ry + 10], [hx - 1.2, Ry * 0.72]]
    .map((p) => new V3(p[0], p[1], 0));
  const strap = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(strapPts, false, "centripetal"), 120, 0.45, 8), mBag);
  strap.scale.z = 4.5; model.add(strap);
  const pad = new THREE.Mesh(new THREE.BoxGeometry(13, 1.4, 5.2), mRib); pad.position.y = Ry + 28.3; model.add(pad);
  for (const s of [1, -1]) {
    const ringGeo = new THREE.TorusGeometry(1.3, 0.28, 8, 24); ringGeo.rotateY(Math.PI / 2);
    const ring = new THREE.Mesh(ringGeo, mStand); ring.position.set(s * (hx + 0.4), Ry * 0.72, 0); model.add(ring);
  }

  /* logo print, bent to the barrel */
  const logoGeo = new THREE.PlaneGeometry(9, 10.8, 1, 24), lp = logoGeo.attributes.position;
  for (let j = 0; j < lp.count; j++) {
    const y = lp.getY(j); lp.setZ(j, Rz * Math.sqrt(Math.max(0, 1 - (y / Ry) * (y / Ry))) + 0.12);
  }
  model.add(new THREE.Mesh(logoGeo, new THREE.MeshBasicMaterial({ map: logoTex, transparent: true, color: 0xe6e6e6, polygonOffset: true, polygonOffsetFactor: -4, depthWrite: false })));

  addShadow(model, -Ry - 0.05, 60, 1.5);

  /* A: width, end to end along the bottom front */
  const phi = THREE.MathUtils.degToRad(52), ay = -(Ry + 0.7) * Math.sin(phi), az = (Rz + 0.7) * Math.cos(phi), ptsA = [];
  for (let k = 0; k <= 8; k++) ptsA.push(new V3(-hx + (L * k) / 8, ay, az));
  meas.A.parts.push(tube(ptsA, 0.38, false, mMeas.A), dot(ptsA[0], mMeas.A), dot(ptsA[8], mMeas.A));
  const aMid = new V3(-hx * 0.25, ay, az), aN = new V3(0, -Math.sin(phi), Math.cos(phi));
  meas.A.anchor = () => aMid; meas.A.normal = aN;

  /* B: depth, straight across the round end; C: height, bottom to top of the same end */
  const ex = hx + 0.7, ptsB = [], ptsC = [];
  for (let k = 0; k <= 8; k++) ptsB.push(new V3(ex, 0, -Rz + (2 * Rz * k) / 8));
  for (let k = 0; k <= 8; k++) ptsC.push(new V3(ex, -Ry + (2 * Ry * k) / 8, 0));
  meas.B.parts.push(tube(ptsB, 0.38, false, mMeas.B), dot(ptsB[0], mMeas.B), dot(ptsB[8], mMeas.B));
  meas.C.parts.push(tube(ptsC, 0.38, false, mMeas.C), dot(ptsC[0], mMeas.C), dot(ptsC[8], mMeas.C));
  const bAt = new V3(ex, 0, Rz * 0.6), cAt = new V3(ex, Ry * 0.6, 0), xN = new V3(1, 0, 0);
  meas.B.anchor = () => bAt; meas.B.normal = xN;
  meas.C.anchor = () => cAt; meas.C.normal = xN;

  finish();
}

/* ---------- three-piece suit on the man, from the real cm specs of the chosen size:
   A jacket length (center back), B jacket chest (all the way round), C sleeve (shoulder point to cuff), D shoulder (point to point).
   The vest, shirt and tie show in the jacket opening; vest and trouser numbers live in the panel and table. ---------- */
function buildSuit(i) {
  resetModel();
  meas.D = { parts: [] };
  const D = FV.data.dims, C = D.chest.cm[i], L = D.jlength.cm[i], S = D.sleeve.cm[i], SHW = D.shoulder.cm[i];
  const OJ = 2.0, kY = 1.03, yB = (M.L.shoulder[1] - 9.5) * kY;
  const k = kForChest(C, OJ, yB, { kY });
  /* arm length: the jacket sleeve (shoulder point to cuff) ends just past the wrist */
  const f0 = fitFn(M, { k, kY, kA: 1 }), c0 = bodyCtx(f0), F0 = armFrame(c0, 1);
  const armLen = F0.W.clone().sub(F0.S).dot(F0.a) + 4.5;
  const kA = THREE.MathUtils.clamp(1 + (S - 1.5 - armLen) / F0.W.distanceTo(F0.S), 1, 1.3);
  const f = fitFn(M, { k, kY, kA });
  const man = buildMan(M, f); model.add(man.group);
  const ctx = bodyCtx(f, man.pos);
  addShadow(model, ctx.ground - 0.05, 120, 0.8);

  /* jacket shell: follows the body to the chest, then hangs straight; the shoulders are built out to the spec shoulder width */
  const yTop = 1.2, hemY = -L + 0.8;
  const rChest = addR(ctx.ring(yB), OJ);
  const shell = new Shell(yTop + 1.2, hemY, 0.6, (y) => {
    let r = addR(ctx.ringSh(y), OJ);
    if (y < yB) r = maxR(r, rChest);
    const fl = Math.max(0, 1 - (y - hemY) / 14) * 1.2;
    return addR(r, fl);
  });
  const topEdge = () => yTop;
  model.add(shell.mesh(mJacket, { top: topEdge, bottom: () => hemY, rows: 140 }));
  const frontZ = (x, y) => shell.frontZ(x, y), topY = (x) => shell.topY(x);
  /* a patch that follows the jacket front: rows from y0 down to y1, columns from xa(y) to xb(y), lifted by off */
  const band = (y0, y1, xa, xb, off, mat, nx = 10) => {
    const pos = [], idx = [], ny = Math.max(2, Math.ceil((y0 - y1) / 0.8));
    for (let r = 0; r <= ny; r++) {
      const y = y0 + ((y1 - y0) * r) / ny, x0 = xa(y), x1 = xb(y);
      for (let c = 0; c <= nx; c++) { const x = x0 + ((x1 - x0) * c) / nx; pos.push(x, y, frontZ(x, y) + off); }
    }
    for (let r = 0; r < ny; r++) for (let c = 0; c < nx; c++) { const p = r * (nx + 1) + c, q = p + nx + 1; idx.push(p, q, p + 1, p + 1, q, q + 1); }
    model.add(new THREE.Mesh(geo(pos, idx), mat));
  };

  const nW = shell.halfW(yTop);
  const yV0 = yTop - 0.6, yVb = -L * 0.42, yS = -L * 0.24;
  const J = (y) => Math.max(0, (nW + 0.6) * (y - yVb) / (yV0 - yVb));
  const Sx = (y) => Math.max(0, nW * 0.72 * (y - yS) / (yV0 - yS));
  const lap = (y) => { const t = (yV0 - y) / (yV0 - yVb); return 1 + 5.5 * Math.sin(Math.PI * Math.min(1, t * 0.9 + 0.05)); };

  /* vest in the jacket opening, shirt V, tie */
  band(yV0 - 2.5, yVb, (y) => -J(y), (y) => J(y), 0.25, mVest);
  band(yV0, yS, (y) => -Sx(y), (y) => Sx(y), 0.4, mShirt);
  const tieW = (y) => 0.8 + 0.7 * (yV0 - y) / (yV0 - yS);
  band(yV0 - 1.8, yS + 0.4, (y) => -tieW(y), (y) => tieW(y), 0.55, mTie, 4);
  band(yV0 - 0.2, yV0 - 2.1, () => -1.25, () => 1.25, 0.62, mTie, 4);
  for (let y = yS - 2.5; y > yVb + 1.5; y -= 4) {
    const bt = new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 10), mButton);
    bt.scale.z = 0.45; bt.position.set(0, y, frontZ(0, y) + 0.45); model.add(bt);
  }
  /* lapels along both edges of the V */
  band(yV0, yVb, (y) => J(y), (y) => J(y) + lap(y), 0.5, mLapel, 6);
  band(yV0, yVb, (y) => -J(y) - lap(y), (y) => -J(y), 0.5, mLapel, 6);

  /* jacket buttons, front edge, pockets, pocket square */
  for (const y of [yVb - 3, yVb - 12]) {
    const bt = new THREE.Mesh(new THREE.SphereGeometry(0.85, 16, 10), mButton);
    bt.scale.z = 0.4; bt.position.set(0.6, y, frontZ(0.6, y) + 0.45); model.add(bt);
  }
  const edge = [];
  for (let y = yVb; y > hemY + 7; y -= 2) edge.push(new V3(0, y, frontZ(0, y) + 0.3));
  for (let q = 0; q <= 6; q++) { const t = q / 6, y = hemY + 7 - 7 * t, x = 5 * t * t; edge.push(new V3(x, y, frontZ(x, y) + 0.3)); }
  model.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(edge, false, "centripetal"), 80, 0.14, 6), mButton));
  const pY = -L * 0.66, hw = shell.halfW(pY);
  band(pY, pY - 2.4, () => hw * 0.3, () => hw * 0.8, 0.35, mLapel, 8);
  band(pY, pY - 2.4, () => -hw * 0.8, () => -hw * 0.3, 0.35, mLapel, 8);
  band(-14.2, -15.6, () => 8, () => 15.5, 0.35, mLapel, 6);
  band(-12.6, -14.3, (y) => 9.5 + (y + 12.6) * -0.6, () => 13.8, 0.5, mShirt, 4);

  /* collar: jacket collar round the back, shirt collar inside */
  const ringPts = (y, off) => { const p = []; for (let c = 0; c <= 64; c++) p.push(shell.pt(Math.round((c / 64) * NA) % NA, y, off)); return p; };
  model.add(solid(ringPts(yTop - 0.1, 0.2), 1.25, true, mJacket, 10));
  model.add(solid(ringPts(yTop + 1.1, -0.9), 0.8, true, mShirt, 10));

  /* sleeves: the shoulder seam sits at half the spec shoulder width; the sleeve runs the spec length from there to the cuff */
  const FA = armFrame(ctx, 1), spX = Math.min(SHW / 2, shell.halfW(FA.S.y + 1) - 0.3);
  const SP = new V3(spX, topY(spX) + 0.45, ZC), sSP = SP.clone().sub(FA.S).dot(FA.a);
  const sleeveData = [];
  for (const s of [1, -1]) {
    const R = sleeveRings(ctx, s, -2, sSP + S - 2, 1.4, 1.6, 0.8);
    model.add(tubeRings(R.rings, mJacket));
    const end = R.rings[R.rings.length - 1], cuff = [];
    for (let c = 0; c <= 40; c++) { const j = Math.round((c / 40) * NA) % NA, t = ang(j), rr = end.r[j] - 0.9; cuff.push(end.c.clone().addScaledVector(end.u, rr * Math.sin(t)).addScaledVector(end.w, rr * Math.cos(t)).addScaledVector(R.F.a, 0.6)); }
    model.add(solid(cuff, 0.45, true, mShirt, 8));
    sleeveData.push(R);
  }

  /* suit trousers + oxfords */
  legwear(ctx, "suit", { mat: mJacket });
  shoesOn(ctx, "oxford");

  /* ---------- measurement lines ---------- */
  /* A: jacket length, center back from the collar seam to the hem */
  const ptsA = [];
  for (let y = yTop - 0.4; y > hemY; y -= 0.8) ptsA.push(new V3(0, y, shell.backZ(0, y) - 0.5));
  ptsA.push(new V3(0, hemY, shell.backZ(0, hemY) - 0.5));
  meas.A.parts.push(tube(ptsA, 0.38, false, mMeas.A), dot(ptsA[0], mMeas.A), dot(ptsA[ptsA.length - 1], mMeas.A));
  const aAt = ptsA[Math.floor(ptsA.length * 0.6)];
  meas.A.anchor = () => aAt; meas.A.normal = new V3(0, 0, -1);

  /* B: chest, a level ring round the jacket at the armpits */
  const ptsB = []; for (let j = 0; j < NA; j++) ptsB.push(shell.pt(j, yB, 0.9));
  meas.B.parts.push(tube(ptsB, 0.55, true, mMeas.B));
  meas.B.anchor = () => {
    const th0 = Math.atan2(camera.position.x, camera.position.z), th = th0 + (Math.cos(th0) >= 0 ? -0.8 : 0.8);
    const j = ((Math.round((th / (Math.PI * 2)) * NA) % NA) + NA) % NA; return shell.pt(j, yB, 1.5);
  };
  meas.B.normal = null;

  /* C: sleeve, from the shoulder point down the outside of the sleeve to the cuff */
  const RL = sleeveData[0], ptsC = [SP];
  for (let q = 1; q <= 10; q++) { const Rq = RL.rings[Math.round((q / 10) * (RL.rings.length - 1))]; ptsC.push(Rq.c.clone().addScaledVector(Rq.u, Rq.r[NA / 4] + 0.35)); }
  meas.C.parts.push(tube(ptsC, 0.38, false, mMeas.C), dot(ptsC[0], mMeas.C), dot(ptsC[10], mMeas.C));
  const cAt = ptsC[6];
  meas.C.anchor = () => cAt; meas.C.normal = new V3(1, 0, 0);

  /* D: shoulder, across the back from one shoulder point to the other */
  const xe = ptsC[0].x, ptsD = [];
  for (let q = 0; q <= 40; q++) {
    const x = -xe + (2 * xe * q) / 40, ax = Math.abs(x), y = Math.min(topY(ax), yTop) + 0.55;
    ptsD.push(new V3(x, ax > xe - 1 ? ptsC[0].y : y, shell.backZ(x, y - 0.6) - 0.3));
  }
  meas.D.parts.push(tube(ptsD, 0.38, false, mMeas.D), dot(ptsD[0], mMeas.D), dot(ptsD[40], mMeas.D));
  const dAt = ptsD[20].clone().add(new V3(0, 0.1, -0.1));
  meas.D.anchor = () => dAt; meas.D.normal = new V3(0, 0.3, -1).normalize();

  finish();
}

/* ---------- training joggers on the man (shirtless, trainers): A waist (relaxed), B hip, C length (outside leg) ---------- */
function buildPants(i) {
  resetModel();
  const D = FV.data.dims, H = D.hip.cm[i], Lc = D.length.cm[i];
  const Lm = M.L, yHip0 = Lm.pelvis[1] - 3;
  /* height: the jogger runs from the waistband to just above the ankle bone; width: the seat ring measures the spec hip */
  const kY = THREE.MathUtils.clamp((Lc - 1) / ((Lm.pelvis[1] + 13.6) - (Lm.ankle[1] + 1.5)), 0.9, 1.25);
  const k = kForChest(H, 2.0, yHip0 * kY, { kY });
  const f = fitFn(M, { k, kY });
  const man = buildMan(M, f); model.add(man.group);
  const ctx = bodyCtx(f, man.pos);
  addShadow(model, ctx.ground - 0.05, 120, 0.8);
  const W = legwear(ctx, "jogger");
  shoesOn(ctx, "sneaker");

  /* cargo pocket on the outer thigh */
  for (const leg of W.legs) {
    const py = W.yC - 14, R = leg.rings.reduce((a, b) => (Math.abs(b.c.y - py) < Math.abs(a.c.y - py) ? b : a));
    const pocket = new THREE.Mesh(new THREE.BoxGeometry(1.2, 14, 11), mRib);
    pocket.position.set(R.c.x + leg.s * (R.r[leg.s > 0 ? NA / 4 : (3 * NA) / 4] + 0.2), py, R.c.z); model.add(pocket);
  }

  /* A: waist ring on the waistband; B: hip ring on the seat; C: length down the outside of the left leg */
  const ringOf = (y, off, part, key) => {
    const pts = []; for (let j = 0; j < NA; j++) pts.push(W.seat.pt(j, y, off));
    part.parts.push(tube(pts, 0.5, true, mMeas[key]));
    part.anchor = () => {
      const th0 = Math.atan2(camera.position.x, camera.position.z), th = th0 + (Math.cos(th0) >= 0 ? -0.7 : 0.7);
      const j = ((Math.round((th / (Math.PI * 2)) * NA) % NA) + NA) % NA; return W.seat.pt(j, y, off + 0.6);
    };
    part.normal = null;
  };
  ringOf(W.yW - 1.7, 1.2, meas.A, "A");
  ringOf(yHip0 * kY, 0.8, meas.B, "B");
  const leg = W.legs[0], outer = (y) => {
    if (y > W.yC) return W.seat.halfW(y) + 0.7;
    const R = leg.rings.reduce((a, b) => (Math.abs(b.c.y - y) < Math.abs(a.c.y - y) ? b : a)); return R.c.x + R.r[NA / 4] + 0.7;
  };
  const ptsC = [];
  for (let y = W.yW; y > W.hemY; y -= 1.5) ptsC.push(new V3(outer(y), y, ZC));
  ptsC.push(new V3(outer(W.hemY + 0.5), W.hemY, ZC));
  meas.C.parts.push(tube(ptsC, 0.38, false, mMeas.C), dot(ptsC[0], mMeas.C), dot(ptsC[ptsC.length - 1], mMeas.C));
  const cAt = ptsC[Math.floor(ptsC.length * 0.62)];
  meas.C.anchor = () => cAt; meas.C.normal = new V3(1, 0, 0);
  finish();
}

/* ---------- formal shoe on its own, sized from the foot length of the chosen EU size: A foot length ---------- */
function buildShoe(i) {
  resetModel();
  delete meas.B; delete meas.C;
  const foot = FV.data.dims.foot.cm[i], Ls = foot + 2.2;
  const shoe = makeShoe("oxford", Ls, -1);
  shoe.rotation.y = Math.PI / 2; shoe.position.x = -Ls / 2; /* toe to +x, outer side to the camera */
  model.add(shoe);
  addShadow(model, -0.05, 40, 1.4);

  /* A: foot length, heel to toe along the outside of the shoe, just above the sole edge */
  let wmax = 0; for (let t = 0.5; t < 0.8; t += 0.02) wmax = Math.max(wmax, Ls * 0.365 / 2);
  const z = wmax + 1.0, ptsA = [], x0 = -Ls / 2 + (Ls - foot) / 2, y = shoe.userData.ytop(0.7) + 0.55;
  for (let q = 0; q <= 10; q++) ptsA.push(new V3(x0 + (foot * q) / 10, y, z));
  meas.A.parts.push(tube(ptsA, 0.3, false, mMeas.A), dot(ptsA[0], mMeas.A), dot(ptsA[10], mMeas.A));
  const aAt = ptsA[5];
  meas.A.anchor = () => aAt; meas.A.normal = new V3(0, 0, 1);
  finish();
}

function build() {
  const p = FV.product;
  if (p === "bag") buildBag();
  else if (p === "suit") buildSuit(FV.size);
  else if (p === "joggers") buildPants(FV.size);
  else if (p === "shoe") buildShoe(FV.size);
  else if (p === "shirt") buildShirt(FV.size);
  else buildTop(FV.size); /* tee, gymtee, gymvest */
}

/* ---------- labels ---------- */
const tags = {};
for (const k of ["A", "B", "C", "D"]) {
  const el = document.createElement("button");
  el.type = "button"; el.className = "tag hide"; el.dataset.k = k;
  el.innerHTML = "<b>" + k + "</b><span></span>";
  tagsEl.appendChild(el);
  tags[k] = el;
}
function updateLabels() { for (const k in tags) tags[k].querySelector("span").textContent = FV.label(k); }
function applyFocus() {
  const f = FV.focus;
  for (const k in mMeas) {
    mMeas[k].opacity = !f || f === k ? 1 : 0.16;
    tags[k].classList.toggle("dim", !!f && f !== k);
  }
}

/* ---------- camera presets ---------- */
let tween = null;
function stopAuto() {
  controls.autoRotate = false;
  hint.classList.add("gone");
  document.querySelectorAll("[data-cam]").forEach((b) => b.classList.toggle("on", false));
}
controls.addEventListener("start", () => { tween = null; stopAuto(); });
document.querySelectorAll("[data-cam]").forEach((btn) => btn.addEventListener("click", () => {
  stopAuto(); btn.classList.add("on");
  const off = camera.position.clone().sub(controls.target);
  const from = Math.atan2(off.x, off.z), to = parseFloat(btn.dataset.cam);
  const delta = ((to - from + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  tween = { from, delta, t0: performance.now(), rXZ: Math.hypot(off.x, off.z), y: off.y };
}));

/* ---------- framing: each product gets its own camera target and fit box (head to mid-thigh for tops) ---------- */
const FIT = {
  tee: { y: -36, h: 66, w: 46, lift: 0.06 },
  suit: { y: -38, h: 68, w: 48, lift: 0.06 },
  bag: { y: 13, h: 33, w: 31, lift: 0.36 },
  gymtee: { y: -36, h: 66, w: 46, lift: 0.06 },
  gymvest: { y: -36, h: 66, w: 46, lift: 0.06 },
  shirt: { y: -30, h: 60, w: 44, lift: 0.07 },
  joggers: { y: -64, h: 96, w: 44, lift: 0.04 },
  shoe: { y: 4.5, h: 12, w: 20, lift: 0.42 }
};
const TAN = Math.tan(THREE.MathUtils.degToRad(15));
function frame(reset) {
  const f = FIT[FV.product] || FIT.tee;
  const off = camera.position.clone().sub(controls.target);
  const az = reset ? 0.5 : Math.atan2(off.x, off.z);
  const d = Math.max(f.h / TAN, f.w / (TAN * camera.aspect));
  const lift = reset ? f.lift : THREE.MathUtils.clamp(off.y / (off.length() || 1), -0.4, 0.5);
  controls.target.set(0, f.y, 0);
  const flat = Math.sqrt(1 - lift * lift);
  camera.position.set(Math.sin(az) * flat * d, f.y + lift * d, Math.cos(az) * flat * d);
  tween = null;
}

/* ---------- resize / visibility ---------- */
function resize() {
  const w = box.clientWidth, h = box.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  frame(false);
}
new ResizeObserver(resize).observe(box);
let visible = true;
new IntersectionObserver((e) => { visible = e[0].isIntersecting; }).observe(box);

/* ---------- loop ---------- */
const ease = (t) => 1 - Math.pow(1 - t, 3);
const v = new V3(), toCam = new V3();
const DELAY = { B: 0, A: 350, C: 650, D: 900 };

renderer.setAnimationLoop((now) => {
  if (!visible) return;
  if (tween) {
    const t = Math.min(1, (now - tween.t0) / 850), th = tween.from + tween.delta * ease(t);
    camera.position.set(controls.target.x + Math.sin(th) * tween.rXZ, controls.target.y + tween.y, controls.target.z + Math.cos(th) * tween.rXZ);
    if (t === 1) tween = null;
  }
  controls.update();

  /* draw-in of the measurement lines after every rebuild */
  for (const k in meas) {
    const t = Math.min(1, Math.max(0, (now - builtAt - DELAY[k]) / 1100)), e = ease(t);
    for (const p of meas[k].parts) {
      if (p.userData.count) p.geometry.setDrawRange(0, Math.floor((p.userData.count * e) / 3) * 3);
      else p.scale.setScalar(t >= 1 ? 1 : 0.001);
    }
  }

  renderer.render(scene, camera);

  /* place the HTML labels on their lines */
  const w = box.clientWidth, h = box.clientHeight;
  for (const k in tags) if (!meas[k] || !meas[k].anchor) tags[k].classList.add("hide"); /* e.g. D only exists on the suit */
  for (const k in meas) {
    const m = meas[k], el = tags[k];
    if (!m.anchor || (now - builtAt - DELAY[k]) / 1100 < 0.6) { el.classList.add("hide"); continue; }
    el.classList.toggle("hide", false);
    const p = m.anchor();
    v.copy(p).project(camera);
    const x = THREE.MathUtils.clamp(((v.x + 1) / 2) * w, 70, w - 70);
    const y = THREE.MathUtils.clamp(((1 - v.y) / 2) * h, 60, h - 30);
    el.style.transform = "translate(" + x.toFixed(1) + "px," + y.toFixed(1) + "px) translate(-50%,-50%)";
    let behind = false;
    if (m.normal) { toCam.copy(camera.position).sub(p).normalize(); behind = toCam.dot(m.normal) < -0.12; }
    el.classList.toggle("behind", behind);
  }
});


/* ---------- wire to the UI ---------- */
let lastKey = "";
function sync() {
  const key = FV.product + ":" + FV.size;
  if (M && key !== lastKey) {
    const productChanged = lastKey.split(":")[0] !== FV.product;
    lastKey = key;
    build();
    if (productChanged) frame(true);
  }
  updateLabels(); applyFocus();
}
FV.on(sync);
window.FV3D = { camera, controls, frame }; /* for screenshots and debugging */
resize();
loadMan("assets/man.json").then((m) => { M = m; sync(); }).catch((e) => { console.error(e); fail("The 3D model could not load. Every measurement is in the panel and the full chart below."); });
sync();
