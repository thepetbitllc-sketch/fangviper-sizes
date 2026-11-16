// build-man.js - bake the realistic male figure for the 3D size guide into assets/man.json.
// Source: MakeHuman CC0 base mesh (hm08) + male / young / athletic macro targets + CC0 high-poly eyes (see _src/makehuman, not committed).
// Steps: apply targets (cm), lower the A-pose arms to a relaxed stance with simple bone skinning, move the collar point to y = 0,
// fit the eyes (mhclo), and pack positions/indices as base64 Int16/Uint16 with the landmarks the garment builders need.
const fs = require("fs");
const path = require("path");
const { maleMesh, loadObj, SRC } = require("./mh-load.js");

const o = maleMesh(0.75);
const v = o.v;
const NV = 13380; // the body group uses vertices 0..13379
const P = (i) => [v[i * 3], v[i * 3 + 1], v[i * 3 + 2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => mul(a, 1 / len(a));
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

function centroid(g) {
  const s = new Set(); for (const f of o.groups[g]) for (const i of f) s.add(i);
  const c = [0, 0, 0]; for (const i of s) { c[0] += v[i * 3]; c[1] += v[i * 3 + 1]; c[2] += v[i * 3 + 2]; }
  return mul(c, 1 / s.size);
}
const J = {};
for (const n of ["neck", "head", "pelvis", "l-shoulder", "l-elbow", "l-hand", "l-upper-leg", "l-knee", "l-ankle", "l-eye", "r-eye"]) J[n] = centroid("joint-" + n);

/* ---------- triangles of the body ---------- */
const tris = [];
for (const f of o.groups.body) { tris.push(f[0], f[1], f[2]); if (f.length === 4) tris.push(f[0], f[2], f[3]); }
const nbr = Array.from({ length: NV }, () => new Set());
for (let t = 0; t < tris.length; t += 3) for (let k = 0; k < 3; k++) { const a = tris[t + k], b = tris[t + (k + 1) % 3]; nbr[a].add(b); nbr[b].add(a); }

/* ---------- distance from a point to a segment ---------- */
function segDist(p, a, b) {
  const ab = sub(b, a), t = Math.min(1, Math.max(0, dot(sub(p, a), ab) / dot(ab, ab)));
  return { d: len(sub(p, add(a, mul(ab, t)))), t };
}

/* ---------- arm skinning weights: torso (identity) / upper arm / forearm+hand ---------- */
// rotation of a vector by axis/angle (Rodrigues)
function rotFromTo(a, b) { // shortest arc as a function
  const u = norm(a), w = norm(b), axis = cross(u, w), s = len(axis), c = dot(u, w);
  if (s < 1e-8) return (x) => x.slice();
  const k = mul(axis, 1 / s), ang = Math.atan2(s, c);
  return (x) => add(add(mul(x, Math.cos(ang)), mul(cross(k, x), Math.sin(ang))), mul(k, dot(k, x) * (1 - Math.cos(ang))));
}
const deg = Math.PI / 180;
const S = J["l-shoulder"], E = J["l-elbow"], H = J["l-hand"];
const fDir = norm(sub(H, E));
const tip = add(H, mul(fDir, 20)); // fingertips, roughly
const UPPER_ANGLE = 15 * deg, FORE_ANGLE = 9 * deg;
const dirU = norm([Math.sin(UPPER_ANGLE), -Math.cos(UPPER_ANGLE), -0.02]);
const dirF = norm([Math.sin(FORE_ANGLE), -Math.cos(FORE_ANGLE), 0.16]);
const rU = rotFromTo(sub(E, S), dirU);
const E2 = add(S, rU(sub(E, S)));
const rF0 = rotFromTo(rU(sub(H, E)), dirF); // after the upper-arm turn, line the forearm up with dirF
const TU = (p) => add(S, rU(sub(p, S)));
const TF = (p) => add(E2, rF0(rU(sub(p, E))));

// torso as an elliptic cylinder around the spine for the "distance to torso surface" (half-width / half-depth by height)
const torsoW = (y) => (y > 62 ? 7 : y > 50 ? 15 : 16.5), torsoD = 11, torsoZ = 1;
const wU = new Float32Array(NV), wF = new Float32Array(NV);
for (let i = 0; i < NV; i++) {
  const p = P(i); const s = Math.sign(p[0]) || 1; const q = [Math.abs(p[0]), p[1], p[2]];
  if (q[0] < 6 || q[1] < -2) continue; // midline and legs never follow the arm
  const dT = Math.max(0.3, (Math.hypot(q[0] / torsoW(q[1]), (q[2] - torsoZ) / torsoD) - 1) * 12);
  const u = segDist(q, S, E), f = segDist(q, E, tip);
  const dU = Math.max(0.3, u.d - 5.2), dF = Math.max(0.3, f.d - 4.2);
  let eT = 1 / dT ** 4, eU = 1 / dU ** 4, eF = 1 / dF ** 4;
  // above / inside the shoulder joint the torso wins
  const s0 = dot(sub(q, S), norm(sub(E, S)));
  eU *= smooth(-5, 1, s0); eF *= smooth(-5, 1, s0);
  const sum = eT + eU + eF;
  wU[i] = eU / sum; wF[i] = eF / sum;
}
// smooth the weights over the mesh so the shoulder and elbow bend softly
for (let it = 0; it < 12; it++) {
  const a = Float32Array.from(wU), b = Float32Array.from(wF);
  for (let i = 0; i < NV; i++) {
    if (!nbr[i].size) continue;
    let su = a[i], sf = b[i]; for (const j of nbr[i]) { su += a[j]; sf += b[j]; }
    wU[i] = su / (nbr[i].size + 1); wF[i] = sf / (nbr[i].size + 1);
  }
}
const arm = new Uint8Array(NV); // arm weight 0..255 (side = sign of x); > 127 counts as arm for the garment builders
for (let i = 0; i < NV; i++) {
  const p = P(i); const s = p[0] >= 0 ? 1 : -1; const q = [Math.abs(p[0]), p[1], p[2]];
  const w = wU[i] + wF[i];
  arm[i] = Math.round(Math.min(1, w) * 255);
  if (w < 1e-4) continue;
  const a = TU(q), b = TF(q), wt = 1 - w;
  const r = [q[0] * wt + a[0] * wU[i] + b[0] * wF[i], q[1] * wt + a[1] * wU[i] + b[1] * wF[i], q[2] * wt + a[2] * wU[i] + b[2] * wF[i]];
  v[i * 3] = s * r[0]; v[i * 3 + 1] = r[1]; v[i * 3 + 2] = r[2];
}
const H2 = TF(H), TIP2 = TF(tip);

/* ---------- collar point (side of the neck base) -> y = 0; ground ---------- */
let yTop = -1e9;
for (let i = 0; i < NV; i++) { const p = P(i); if (Math.abs(Math.abs(p[0]) - 8) < 0.6 && p[1] > 50 && p[1] < 68 && Math.abs(p[2] - 1) < 4) yTop = Math.max(yTop, p[1]); }
let yMin = 1e9; for (let i = 0; i < NV; i++) yMin = Math.min(yMin, v[i * 3 + 1]);
const dy = -yTop;

/* ---------- eyes, fitted with the mhclo ---------- */
function fitProxy(objFile, clo) {
  const eo = loadObj(path.join(SRC, objFile));
  const lines = fs.readFileSync(path.join(SRC, clo), "utf8").split(/\r?\n/);
  const scl = {}; let inV = false; const refs = [];
  for (const l of lines) {
    const t = l.trim().split(/\s+/);
    if (/^[xyz]_scale$/.test(t[0])) scl[t[0][0]] = { a: +t[1], b: +t[2], r: +t[3] };
    if (t[0] === "verts") { inV = true; continue; }
    if (inV && t.length === 9) refs.push(t.map(Number));
    else if (inV && t.length === 1 && t[0] !== "" && !isNaN(+t[0])) refs.push([+t[0], 0, 0, 1, 0, 0, 0, 0, 0]);
  }
  const k = {};
  for (const ax of ["x", "y", "z"]) { const c = "xyz".indexOf(ax), s = scl[ax]; k[ax] = Math.abs(v[s.a * 3 + c] - v[s.b * 3 + c]) / 10 / s.r; }
  const pos = [];
  for (const r of refs) {
    const [a, b, c, wa, wb, wc, ox, oy, oz] = r;
    for (let ax = 0; ax < 3; ax++) pos.push(wa * v[a * 3 + ax] + wb * v[b * 3 + ax] + wc * v[c * 3 + ax] + [ox * k.x, oy * k.y, oz * k.z][ax] * 10);
  }
  const idx = [];
  for (const g of Object.values(eo.groups)) for (const f of g) { idx.push(f[0], f[1], f[2]); if (f.length === 4) idx.push(f[0], f[2], f[3]); }
  return { pos, idx, n: refs.length };
}
const eyes = fitProxy("high-poly.obj", "high-poly.mhclo");
if (eyes.n !== eyes.pos.length / 3) throw new Error("eye fit mismatch");

/* ---------- landmarks (after the shift) ---------- */
const sh = (p) => [p[0], p[1] + dy, p[2]];
// crotch: lowest torso point on the midline
let cy = 1e9; for (let i = 0; i < NV; i++) { const p = P(i); if (Math.abs(p[0]) < 1 && p[1] > -10 && p[1] < 25) cy = Math.min(cy, p[1]); }
// foot: vertices below the ankle on the left side
let fx0 = 1e9, fx1 = -1e9, fz0 = 1e9, fz1 = -1e9;
for (let i = 0; i < NV; i++) { const p = P(i); if (p[0] > 0 && p[1] < J["l-ankle"][1] + 2) { fz0 = Math.min(fz0, p[2]); fz1 = Math.max(fz1, p[2]); fx0 = Math.min(fx0, p[0]); fx1 = Math.max(fx1, p[0]); } }
const L = {
  ground: yMin + dy, crotch: cy + dy,
  neck: sh(J.neck), head: sh(J.head), pelvis: sh(J.pelvis),
  shoulder: sh(S), elbow: sh(E2), wrist: sh(H2), tip: sh(TIP2),
  hip: sh(J["l-upper-leg"]), knee: sh(J["l-knee"]), ankle: sh(J["l-ankle"]),
  foot: { heelZ: fz0, toeZ: fz1, x0: fx0, x1: fx1 }
};

/* ---------- buzz cut + eyebrows, painted as a 0..255 mask on the skin ---------- */
const lerpTable = (tb, x) => { for (let k = 1; k < tb.length; k++) if (x <= tb[k][0]) { const [x0, y0] = tb[k - 1], [x1, y1] = tb[k]; return y0 + (y1 - y0) * (x - x0) / (x1 - x0); } return tb[tb.length - 1][1]; };
const HAIRLINE = [[0, 20.4], [30, 20.1], [50, 18.6], [64, 15.8], [74, 12], [82, 12], [88, 17.4], [100, 17.4], [108, 11.5], [140, 6.4], [180, 5]];
const hair = new Uint8Array(NV);
const eyeY = J["l-eye"][1] + dy, eyeX = J["l-eye"][0];
for (let i = 0; i < NV; i++) {
  const x = v[i * 3], y = v[i * 3 + 1] + dy, z = v[i * 3 + 2];
  if (y < 2) continue;
  const phi = Math.abs(Math.atan2(x, z - 5)) * 180 / Math.PI;
  let m = smooth(0, 1.1, y - lerpTable(HAIRLINE, phi));
  if (Math.abs(x) > 6.9 && y > 7.5 && y < 17.8 && z > 1.2 && z < 7.6) m = 0; // ears stay skin
  const ax = Math.abs(x);
  if (z > 10.5 && ax > 0.8 && ax < 5.9) { // eyebrow: arched band above each eye
    const u = (ax - 0.8) / 5.1, yc = eyeY + 2.15 + 0.55 * Math.sin(Math.PI * Math.min(1, u * 1.25)) - 0.5 * u * u, th = 0.55 - 0.25 * u;
    m = Math.max(m, 0.8 * smooth(th + 0.6, th - 0.15, Math.abs(y - yc)) * smooth(0.8, 1.3, ax) * (1 - smooth(5.2, 5.9, ax)));
  }
  hair[i] = Math.round(m * 255);
}
/* soften the painted edges over the mesh (sparse vertices make them blocky) */
for (let it = 0; it < 2; it++) {
  const c = Float32Array.from(hair);
  for (let i = 0; i < NV; i++) { if (!nbr[i].size) continue; let sum = c[i] * 2; for (const j of nbr[i]) sum += c[j]; hair[i] = Math.round(sum / (nbr[i].size + 2)); }
}

/* ---------- pack ---------- */
const Q = 50; // 0.02 cm steps
const pos16 = new Int16Array(NV * 3);
for (let i = 0; i < NV; i++) { pos16[i * 3] = Math.round(v[i * 3] * Q); pos16[i * 3 + 1] = Math.round((v[i * 3 + 1] + dy) * Q); pos16[i * 3 + 2] = Math.round(v[i * 3 + 2] * Q); }
const eye16 = new Int16Array(eyes.pos.length);
for (let i = 0; i < eyes.pos.length; i++) eye16[i] = Math.round((eyes.pos[i] + (i % 3 === 1 ? dy : 0)) * Q);
const b64 = (ta) => Buffer.from(ta.buffer, ta.byteOffset, ta.byteLength).toString("base64");
const out = {
  about: "Drevaunt fit model. Body: MakeHuman base mesh hm08 with male macro targets, CC0 1.0 (makehumancommunity.org). Arms re-posed for the size guide.",
  q: Q,
  pos: b64(pos16), idx: b64(new Uint16Array(tris)), arm: b64(arm), hair: b64(hair),
  eyes: { pos: b64(eye16), idx: b64(new Uint16Array(eyes.idx)), centers: [sh(J["l-eye"]), sh(J["r-eye"])] },
  L
};
const file = path.join(__dirname, "..", "assets", "man.json");
fs.writeFileSync(file, JSON.stringify(out));
console.log("wrote", file, (fs.statSync(file).size / 1024).toFixed(0) + " KB", "yTop", yTop.toFixed(1), "height", (-(yMin) + yTop + 0).toFixed(1));
console.log(JSON.stringify(L, (k, x) => (typeof x === "number" ? +x.toFixed(1) : x)));
