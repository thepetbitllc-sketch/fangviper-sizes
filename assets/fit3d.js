/* Fangviper size chart: 3D models (three.js). Each model is built from the real cm specs of the chosen product and size. */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const FV = window.FV;
const box = document.getElementById("viewer");
const tagsEl = document.getElementById("tags");
const hint = document.getElementById("hint");
const V3 = THREE.Vector3;
const UP = new V3(0, 1, 0), FWD = new V3(0, 0, 1);

function fail() {
  const f = document.createElement("div");
  f.className = "fallback";
  f.textContent = "The 3D model needs WebGL, which is turned off in this browser. Every measurement is in the panel and the full chart below.";
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
const target = new V3(0, -57, 0);
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

/* ---------- lights ---------- */
scene.add(new THREE.HemisphereLight(0xffffff, 0x1a1a1a, 1.1));
const key = new THREE.DirectionalLight(0xffffff, 2.4); key.position.set(120, 160, 220); scene.add(key);
const rim = new THREE.DirectionalLight(0xffffff, 2.8); rim.position.set(-180, 90, -220); scene.add(rim);
const rim2 = new THREE.DirectionalLight(0xffffff, 1.6); rim2.position.set(220, 40, -120); scene.add(rim2);
const fill = new THREE.DirectionalLight(0xffffff, 0.7); fill.position.set(-220, -20, 140); scene.add(fill);

/* ---------- materials ---------- */
const mForm = new THREE.MeshStandardMaterial({ color: 0x8e8e8e, roughness: 0.48, metalness: 0.05, side: THREE.DoubleSide });
const mTee = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9, side: THREE.DoubleSide });
const mRib = new THREE.MeshStandardMaterial({ color: 0x262626, roughness: 0.85 });
const mStand = new THREE.MeshStandardMaterial({ color: 0x2c2c2c, roughness: 0.3, metalness: 0.7 });
const mMeas = {};
for (const k of ["A", "B", "C"]) mMeas[k] = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true });

const logoTex = new THREE.TextureLoader().load("assets/logo-white.png");
logoTex.colorSpace = THREE.SRGBColorSpace;
logoTex.anisotropy = 4;

/* soft floor shadow (added per model) */
const shadowTex = (() => {
  const c = document.createElement("canvas"); c.width = c.height = 128;
  const g = c.getContext("2d"), gr = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  gr.addColorStop(0, "rgba(0,0,0,.75)"); gr.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
})();
function addShadow(group, y, size, stretch) {
  const sh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
  sh.rotation.x = -Math.PI / 2; sh.position.y = y; sh.scale.x = stretch;
  group.add(sh);
}


/* ---------- geometry helpers ---------- */
function sePoint(w, d, t, p) {
  const c = Math.cos(t), s = Math.sin(t);
  return [w * Math.sign(c) * Math.pow(Math.abs(c), 2 / p), d * Math.sign(s) * Math.pow(Math.abs(s), 2 / p)];
}
function perimeter(w, d, p) {
  let per = 0, prev = sePoint(w, d, 0, p);
  for (let j = 1; j <= 256; j++) {
    const q = sePoint(w, d, (j / 256) * Math.PI * 2, p);
    per += Math.hypot(q[0] - prev[0], q[1] - prev[1]); prev = q;
  }
  return per;
}
/* loft rings {y, w, d} (top to bottom) into a superellipse tube */
function loft(rings, seg, p, capTop, capBot) {
  const pos = [], idx = [], n = seg + 1;
  for (const r of rings) for (let j = 0; j <= seg; j++) {
    const q = sePoint(r.w, r.d, (j / seg) * Math.PI * 2, p);
    pos.push(q[0], r.y, q[1]);
  }
  for (let i = 0; i < rings.length - 1; i++) for (let j = 0; j < seg; j++) {
    const a = i * n + j, b = a + n;
    idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const cap = (ri) => {
    const c = pos.length / 3; pos.push(0, rings[ri].y, 0);
    for (let j = 0; j < seg; j++) idx.push(c, ri * n + j, ri * n + j + 1);
  };
  if (capTop) cap(0);
  if (capBot) cap(rings.length - 1);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
function interp(rings) {
  return (y, key) => {
    if (y >= rings[0].y) return rings[0][key];
    for (let i = 0; i < rings.length - 1; i++) {
      const a = rings[i], b = rings[i + 1];
      if (y <= a.y && y >= b.y) { const t = (a.y - y) / ((a.y - b.y) || 1); return a[key] + (b[key] - a[key]) * t; }
    }
    return rings[rings.length - 1][key];
  };
}
function tube(points, radius, closed, mat) {
  const curve = new THREE.CatmullRomCurve3(points, closed, "centripetal");
  const g = new THREE.TubeGeometry(curve, Math.max(80, points.length * 3), radius, 8, closed);
  const m = new THREE.Mesh(g, mat);
  m.userData.count = g.index.count;
  g.setDrawRange(0, 0);
  return m;
}
function dot(p, mat) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.95, 16, 12), mat);
  m.position.copy(p); m.scale.setScalar(0.001);
  return m;
}

/* ---------- build the model for one size ---------- */
let model = null, meas = {}, builtAt = 0;
const O = 1.4, PB = 2.2, PT = 2.4, RATIO = 0.68;

function buildTee(i) {
  if (model) {
    scene.remove(model);
    model.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  }
  model = new THREE.Group();
  meas = { A: { parts: [] }, B: { parts: [] }, C: { parts: [] } };

  const P = FV.data, Wcm = P.dims.width.cm[i], L = P.dims.length.cm[i], S = P.dims.sleeve.cm[i];

  /* body chest half-width chosen so the tee around it measures exactly 2 x the flat width */
  let lo = 5, hi = 70;
  for (let k = 0; k < 40; k++) {
    const mid = (lo + hi) / 2;
    if (perimeter(mid + O, mid * RATIO + O, PT) > 2 * Wcm) hi = mid; else lo = mid;
  }
  const a = (lo + hi) / 2, b = a * RATIO, sh = a * 1.1;

  /* dress-form profile: [half-width, y, half-depth]; y = 0 is the top of the shoulder by the neck */
  const ctrl = [
    [5.2, 14, 5.0], [5.6, 9, 5.4], [6.2, 2.2, 6.0], [8, 0.4, 7.2],
    [sh * 0.6, -1.8, b * 0.62], [sh * 0.88, -4.4, b * 0.78], [sh, -7.5, b * 0.86], [sh * 0.97, -12, b * 0.94],
    [a, -18, b], [a * 0.985, -27, b], [a * 0.9, -42, b * 0.93], [a * 0.92, -58, b * 0.92],
    [a * 0.98, -76, b * 0.95], [a * 0.95, -90, b * 0.9], [a * 0.72, -96, b * 0.66]
  ].map((c) => new V3(c[0], c[1], c[2]));
  const bodyRings = new THREE.CatmullRomCurve3(ctrl, false, "centripetal").getSpacedPoints(150).map((v) => ({ w: v.x, y: v.y, d: v.z }));
  const bW = interp(bodyRings);
  model.add(new THREE.Mesh(loft(bodyRings, 72, PB, true, true), mForm));
  const knob = new THREE.Mesh(new THREE.SphereGeometry(5.2, 24, 12), mStand);
  knob.scale.set(1, 0.45, 0.96); knob.position.y = 14; model.add(knob);

  /* stand */
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 34, 20), mStand);
  pole.position.y = -113; model.add(pole);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(15, 17, 2.4, 48), mStand);
  base.position.y = -130; model.add(base);
  addShadow(model, -131.4, 90, 1);

  /* tee shell, hem at exactly the garment length below the shoulder */
  const yTop = 0.9, hemY = -L + 0.6, ys = [];
  for (let y = yTop; y > hemY; y -= 0.7) ys.push(y);
  ys.push(hemY);
  const tee = ys.map((y) => {
    const flare = Math.max(0, 1 - (y - hemY) / 8) * 0.5;
    return { y, w: bW(y, "w") + O + flare, d: bW(y, "d") + O + flare };
  });
  const tW = interp(tee);
  model.add(new THREE.Mesh(loft(tee, 80, PT, false, false), mTee));

  const topY = (x) => {               /* tee surface height on the shoulder line (z = 0) */
    for (let k = 1; k < tee.length; k++) {
      if (tee[k].w >= x) {
        const p0 = tee[k - 1], p1 = tee[k], t = (x - p0.w) / ((p1.w - p0.w) || 1);
        return p0.y + (p1.y - p0.y) * Math.min(1, Math.max(0, t));
      }
    }
    return tee[tee.length - 1].y;
  };
  const frontZ = (x, y) => {
    const w = tW(y, "w"), d = tW(y, "d");
    if (Math.abs(x) >= w) return 0;
    return d * Math.pow(1 - Math.pow(Math.abs(x) / w, PT), 1 / PT);
  };

  /* collar rib */
  const nW = tW(yTop, "w"), nD = tW(yTop, "d");
  const collar = new THREE.Mesh(new THREE.TorusGeometry(nW, 0.75, 10, 64), mRib);
  collar.rotation.x = Math.PI / 2 - 0.16; collar.scale.set(1, nD / nW, 1); collar.position.y = yTop - 0.2;
  model.add(collar);

  /* logo print on the chest */
  const lz0 = frontZ(0, -8), lz1 = frontZ(0, -10);
  const logo = new THREE.Mesh(new THREE.PlaneGeometry(6.6, 7.9), new THREE.MeshBasicMaterial({ map: logoTex, transparent: true, color: 0xe6e6e6, polygonOffset: true, polygonOffsetFactor: -4, depthWrite: false }));
  logo.position.set(0, -9.5, frontZ(0, -9.5) + 0.15);
  logo.rotation.x = Math.atan((lz0 - lz1) / 2);
  model.add(logo);

  /* arms + sleeves */
  const ang = THREE.MathUtils.degToRad(13);
  const armR = 4.4 + (a - 16) * 0.13;
  const rTop = armR + 2.3, rBot = armR + 1.6;
  const dirR = new V3(Math.sin(ang), -Math.cos(ang), 0), perpR = new V3(Math.cos(ang), Math.sin(ang), 0);
  const S0r = new V3(sh - armR * 0.5, -10, 0).addScaledVector(dirR, -1.2);
  const SP = S0r.clone().addScaledVector(perpR, rTop + 0.35);

  /* C: center back of collar, round the neckline, along the shoulder seam to the shoulder point */
  const seam = [];
  for (let k = 0; k <= 6; k++) {
    const t = -Math.PI / 2 + (k / 6) * (Math.PI / 2);
    seam.push(new V3((nW + 0.4) * Math.cos(t), yTop + 0.35, (nD + 0.4) * Math.sin(t)));
  }
  for (let x = nW + 1.6; x < sh + O - 0.4; x += 1.2) seam.push(new V3(x, topY(x) + 0.45, 0));
  seam.push(SP);
  let seamLen = 0;
  for (let k = 1; k < seam.length; k++) seamLen += seam[k].distanceTo(seam[k - 1]);
  /* whatever is left of the spec sleeve length runs down the sleeve */
  const len = THREE.MathUtils.clamp(S - seamLen, 8, 40);

  for (const s of [1, -1]) {
    const dir = new V3(s * Math.sin(ang), -Math.cos(ang), 0);
    const A0 = new V3(s * (sh - armR * 0.5), -10, 0);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(armR, 24, 8, 24), mForm);
    arm.quaternion.setFromUnitVectors(UP, dir);
    arm.position.copy(A0).addScaledVector(dir, 12 + armR * 0.7);
    model.add(arm);

    const S0 = A0.clone().addScaledVector(dir, -1.2);
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, len, 48, 1, true), mTee);
    sleeve.quaternion.setFromUnitVectors(UP, dir.clone().negate());
    sleeve.position.copy(S0).addScaledVector(dir, len / 2);
    model.add(sleeve);
    const shoulderCap = new THREE.Mesh(new THREE.SphereGeometry(rTop + 0.15, 40, 20), mTee);
    shoulderCap.scale.set(1, 0.5, 1); shoulderCap.quaternion.copy(sleeve.quaternion); shoulderCap.position.copy(S0);
    model.add(shoulderCap);

    const cuff = new THREE.Mesh(new THREE.TorusGeometry(rBot, 0.55, 8, 48), mRib);
    cuff.quaternion.setFromUnitVectors(FWD, dir);
    cuff.position.copy(S0).addScaledVector(dir, len - 0.3);
    model.add(cuff);
  }

  /* ---------- measurement lines ---------- */
  /* A: length, from the shoulder beside the collar straight down the front to the hem */
  const x0 = nW + 1.6, ya = topY(x0), ptsA = [];
  for (let y = ya; y > hemY; y -= 0.8) ptsA.push(new V3(-x0, y + (y === ya ? 0.45 : 0), frontZ(x0, y) + 0.45));
  ptsA.push(new V3(-x0, hemY, frontZ(x0, hemY) + 0.45));
  meas.A.parts.push(tube(ptsA, 0.38, false, mMeas.A), dot(ptsA[0], mMeas.A), dot(ptsA[ptsA.length - 1], mMeas.A));
  const aAnchor = ptsA[Math.floor(ptsA.length * 0.62)];
  meas.A.anchor = () => aAnchor;
  meas.A.normal = FWD;

  /* B: chest tape, a level ring around the fullest part of the chest */
  const yB = -19, wB = tW(yB, "w") + 0.6, dB = tW(yB, "d") + 0.6, ptsB = [];
  for (let j = 0; j < 160; j++) { const q = sePoint(wB, dB, (j / 160) * Math.PI * 2, PT); ptsB.push(new V3(q[0], yB, q[1])); }
  meas.B.parts.push(tube(ptsB, 0.55, true, mMeas.B));
  meas.B.anchor = () => {
    /* follow the side of the ring that faces the camera, on the side away from the sleeve tag */
    const th0 = Math.atan2(camera.position.x, camera.position.z), th = th0 + (Math.cos(th0) >= 0 ? -0.8 : 0.8);
    const q = sePoint(wB + 0.6, dB + 0.6, Math.PI / 2 - th, PT);
    return new V3(q[0], yB, q[1]);
  };
  meas.B.normal = null;

  /* C: sleeve, continue from the shoulder point down the outside of the sleeve to the hem */
  const ptsC = seam.slice();
  for (let k = 1; k <= 8; k++) {
    const t = k / 8, r = rTop + (rBot - rTop) * t + 0.35;
    ptsC.push(S0r.clone().addScaledVector(dirR, len * t).addScaledVector(perpR, r));
  }
  meas.C.parts.push(tube(ptsC, 0.38, false, mMeas.C), dot(ptsC[0], mMeas.C), dot(ptsC[ptsC.length - 1], mMeas.C));
  const cEnd = ptsC[ptsC.length - 1];
  meas.C.anchor = () => cEnd;
  meas.C.normal = new V3(1, 0, 0);

  for (const k in meas) for (const p of meas[k].parts) model.add(p);
  scene.add(model);
  builtAt = performance.now();
}

/* ---------- duffle bag, built from the real cm specs: A width (end to end), B depth, C height ---------- */
const mBag = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.82, side: THREE.DoubleSide });
const mPanel = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.85, side: THREE.DoubleSide });

function resetModel() {
  if (model) {
    scene.remove(model);
    model.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  }
  model = new THREE.Group();
  meas = { A: { parts: [] }, B: { parts: [] }, C: { parts: [] } };
}

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
  const ang = THREE.MathUtils.degToRad(42), ya = Ry * Math.cos(ang), za = Rz * Math.sin(ang);
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

  for (const k in meas) for (const p of meas[k].parts) model.add(p);
  scene.add(model);
  builtAt = performance.now();
}

function build() {
  if (FV.product === "bag") buildBag(); else buildTee(FV.size);
}

/* ---------- labels ---------- */
const tags = {};
for (const k of ["A", "B", "C"]) {
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

/* ---------- framing: each product gets its own camera target and fit box ---------- */
const FIT = {
  tee: { y: -57, h: 76, w: 52, lift: 0.075 },
  bag: { y: 13, h: 33, w: 31, lift: 0.36 }
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
const DELAY = { B: 0, A: 350, C: 650 };

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
  for (const k in meas) {
    const m = meas[k], el = tags[k];
    if ((now - builtAt - DELAY[k]) / 1100 < 0.6) { el.classList.add("hide"); continue; }
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
  if (key !== lastKey) {
    const productChanged = lastKey.split(":")[0] !== FV.product;
    lastKey = key;
    build();
    if (productChanged) frame(true);
  }
  updateLabels(); applyFocus();
}
FV.on(sync);
resize();
sync();
