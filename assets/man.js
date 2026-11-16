/* Drevaunt fit model: a realistic man (MakeHuman CC0 body, see man.json "about") that every garment is fitted on.
   The body is scaled per size so the garment built round him measures exactly the size-chart numbers. */
import * as THREE from "three";

const dec = (s, T) => { const b = Uint8Array.from(atob(s), (c) => c.charCodeAt(0)); return new T(b.buffer); };
const sm = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
export const ZC = 1.2; /* torso centre line (z) the body scales round */

export async function loadMan(url) {
  const d = await (await fetch(url)).json();
  const p16 = dec(d.pos, Int16Array), base = new Float32Array(p16.length);
  for (let i = 0; i < p16.length; i++) base[i] = p16[i] / d.q;
  const e16 = dec(d.eyes.pos, Int16Array), eyePos = new Float32Array(e16.length);
  for (let i = 0; i < e16.length; i++) eyePos[i] = e16[i] / d.q;
  return { base, n: base.length / 3, idx: dec(d.idx, Uint16Array), arm: dec(d.arm, Uint8Array), hair: dec(d.hair, Uint8Array),
    eyePos, eyeIdx: dec(d.eyes.idx, Uint16Array), eyeC: d.eyes.centers, L: d.L };
}

/* the size transform: k = body width, kN = neck width, kY = height below the collar, kA = arm length (head is never scaled).
   f(x, y, z, w) with w = arm weight 0..1 (arm vertices stretch along the shoulder-to-wrist line). */
export function fitFn(M, { k = 1, kN = 1 + (k - 1) * 0.4, kY = 1, kA = 1.06 }) {
  const h = (y) => (y <= 0 ? k + (kN - k) * sm(-1, 0.5, y) : y < 2 ? kN : kN + (1 - kN) * sm(2, 4.2, y));
  const S = M.L.shoulder, W = M.L.wrist, ax = [W[0] - S[0], W[1] - S[1], W[2] - S[2]], al = Math.hypot(...ax);
  for (let c = 0; c < 3; c++) ax[c] /= al;
  const body = (x, y, z) => { const q = h(y); return [x * q, y < 0 ? y * kY : y, ZC + (z - ZC) * q]; };
  const f = (x, y, z, w = 0) => {
    if (w <= 0) return body(x, y, z);
    /* arms: the arm line moves with the body, but the arm itself thickens less (and the hand hardly at all) */
    const sx = x >= 0 ? 1 : -1, px = x * sx - S[0], py = y - S[1], pz = z - S[2];
    const s = px * ax[0] + py * ax[1] + pz * ax[2], sc = Math.max(0, s);
    const cx = S[0] + ax[0] * sc, cy = S[1] + ax[1] * sc, cz = S[2] + ax[2] * sc; /* nearest point on the shoulder-wrist line */
    const kl = 1 + (k - 1) * (0.7 - 0.5 * sm(al - 4, al + 2, s));
    const st = (kA - 1) * sc; /* longer arm */
    const c2 = body(sx * (cx + ax[0] * st), cy + ax[1] * st, cz + ax[2] * st);
    const a2 = [c2[0] + sx * (x * sx - cx) * kl, c2[1] + (y - cy) * kl, c2[2] + (z - cz) * kl];
    const b = body(x, y, z);
    return [b[0] + (a2[0] - b[0]) * w, b[1] + (a2[1] - b[1]) * w, b[2] + (a2[2] - b[2]) * w];
  };
  f.h = h; f.k = k; f.kY = kY; f.kA = kA;
  f.pt = (p, w = 0, side = 1) => { const q = f(p[0] * side, p[1], p[2], w); return new THREE.Vector3(q[0], q[1], q[2]); };
  return f;
}

const SKIN = new THREE.Color(0x8f6044), HAIR = new THREE.Color(0x17110d);
export const mSkin = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.6, sheen: 0.35, sheenColor: new THREE.Color(0x7a3524), sheenRoughness: 0.55 });
const mEye = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.08 });

/* the man for one size: { group, pos (transformed Float32Array), f } */
export function buildMan(M, f) {
  const pos = new Float32Array(M.base.length);
  for (let i = 0; i < M.n; i++) { const q = f(M.base[i * 3], M.base[i * 3 + 1], M.base[i * 3 + 2], M.arm[i] / 255); pos[i * 3] = q[0]; pos[i * 3 + 1] = q[1]; pos[i * 3 + 2] = q[2]; }
  const col = new Float32Array(M.base.length), c = new THREE.Color();
  for (let i = 0; i < M.n; i++) { c.copy(SKIN).lerp(HAIR, M.hair[i] / 255); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  g.setIndex(new THREE.BufferAttribute(M.idx, 1));
  g.computeVertexNormals();
  const group = new THREE.Group();
  group.add(new THREE.Mesh(g, mSkin));

  /* eyes: sclera, brown iris, pupil, coloured by the angle from each eye's forward axis */
  const ep = M.eyePos, ec = new Float32Array(ep.length), sclera = new THREE.Color(0xe9e3da), iris = new THREE.Color(0x3a2214), irisIn = new THREE.Color(0x5a3a22), pupil = new THREE.Color(0x060504);
  const box = [[1e9, 1e9, 1e9, -1e9, -1e9, -1e9], [1e9, 1e9, 1e9, -1e9, -1e9, -1e9]];
  for (let i = 0; i < ep.length / 3; i++) { const b = box[ep[i * 3] > 0 ? 0 : 1]; for (let a = 0; a < 3; a++) { b[a] = Math.min(b[a], ep[i * 3 + a]); b[a + 3] = Math.max(b[a + 3], ep[i * 3 + a]); } }
  /* eyeball centre: middle of the box sideways and vertically, one radius behind the front */
  const cen = box.map((b) => { const r = (b[3] - b[0] + b[4] - b[1]) / 4; return [(b[0] + b[3]) / 2, (b[1] + b[4]) / 2, b[5] - r]; });
  for (let i = 0; i < ep.length / 3; i++) {
    const C = ep[i * 3] > 0 ? cen[0] : cen[1];
    const dx = ep[i * 3] - C[0], dy = ep[i * 3 + 1] - C[1], dz = ep[i * 3 + 2] - C[2], l = Math.hypot(dx, dy, dz) || 1;
    const a = Math.acos(Math.min(1, dz / l)) * 180 / Math.PI;
    if (a < 13) c.copy(pupil);
    else if (a < 31) c.copy(irisIn).lerp(iris, sm(14, 30, a));
    else c.copy(iris).lerp(sclera, sm(31, 34, a));
    ec[i * 3] = c.r; ec[i * 3 + 1] = c.g; ec[i * 3 + 2] = c.b;
  }
  const eg = new THREE.BufferGeometry();
  eg.setAttribute("position", new THREE.BufferAttribute(ep, 3));
  eg.setAttribute("color", new THREE.BufferAttribute(ec, 3));
  eg.setIndex(new THREE.BufferAttribute(M.eyeIdx, 1));
  eg.computeVertexNormals();
  group.add(new THREE.Mesh(eg, mEye));
  return { group, pos, f };
}

/* ---------- body slices: convex rings round the torso / a leg / an arm ---------- */
export const NA = 96; /* samples round every ring; angle 0 = front (+z), PI/2 = left side (+x) */
export function hull2(pts) {
  if (pts.length < 3) return pts.slice();
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  up.pop(); lo.pop();
  return lo.concat(up);
}
/* radius of a convex polygon seen from (cx, cz) at NA angles */
export function radial(hull, cx, cz) {
  const r = new Float32Array(NA);
  if (hull.length < 3) return r;
  for (let j = 0; j < NA; j++) {
    const t = (j / NA) * Math.PI * 2, dx = Math.sin(t), dz = Math.cos(t);
    let best = 0;
    for (let e = 0; e < hull.length; e++) {
      const a = hull[e], b = hull[(e + 1) % hull.length];
      const ex = b[0] - a[0], ez = b[1] - a[1], den = dx * ez - dz * ex;
      if (Math.abs(den) < 1e-9) continue;
      const ax = a[0] - cx, az = a[1] - cz;
      const s = (ax * ez - az * ex) / den, u = (ax * dz - az * dx) / den;
      if (s > 0 && u >= -1e-6 && u <= 1 + 1e-6) best = Math.max(best, s);
    }
    r[j] = best;
  }
  return r;
}
/* exact cross-sections: cut the mesh edges (both ends selected) with the plane scalar = s0.
   S = per-vertex scalar along the cut direction, A/B = the two in-plane coordinates. Returns slice(s0) -> [[a, b], ...]. */
export function makeSlicer(idx, n, sel, S, A, B) {
  const seen = new Set(), ea = [], eb = [], buck = new Map();
  for (let t = 0; t < idx.length; t += 3) for (let q = 0; q < 3; q++) {
    let a = idx[t + q], b = idx[t + (q + 1) % 3]; if (a > b) { const c = a; a = b; b = c; }
    const key = a * 65536 + b; if (seen.has(key)) continue; seen.add(key);
    if (!sel(a) || !sel(b)) continue;
    const e = ea.length; ea.push(a); eb.push(b);
    const lo = Math.floor(Math.min(S[a], S[b])), hi = Math.floor(Math.max(S[a], S[b]));
    for (let k = lo; k <= hi; k++) { if (!buck.has(k)) buck.set(k, []); buck.get(k).push(e); }
  }
  return (s0) => {
    const l = buck.get(Math.floor(s0)), pts = [];
    if (!l) return pts;
    for (const e of l) {
      const a = ea[e], b = eb[e], sa = S[a], sb = S[b];
      if ((sa - s0) * (sb - s0) > 0 || sa === sb) continue;
      const u = (s0 - sa) / (sb - sa);
      pts.push([A[a] + (A[b] - A[a]) * u, B[a] + (B[b] - B[a]) * u]);
    }
    return pts;
  };
}
/* vertex index lists by 1 cm height bucket, for a selection */
export function buckets(pos, n, sel) {
  const B = new Map();
  for (let i = 0; i < n; i++) {
    if (!sel(i)) continue;
    const b = Math.floor(pos[i * 3 + 1]);
    if (!B.has(b)) B.set(b, []);
    B.get(b).push(i);
  }
  return B;
}
export function slice(pos, B, y, band = 0.8) {
  const pts = [];
  for (let b = Math.floor(y - band); b <= Math.floor(y + band); b++) {
    const l = B.get(b); if (!l) continue;
    for (const i of l) if (Math.abs(pos[i * 3 + 1] - y) <= band) pts.push([pos[i * 3], pos[i * 3 + 2]]);
  }
  return pts;
}
export function perimeterR(r, cx = 0) {
  let p = 0;
  for (let j = 0; j < NA; j++) {
    const t0 = (j / NA) * Math.PI * 2, t1 = ((j + 1) / NA) * Math.PI * 2, r0 = r[j], r1 = r[(j + 1) % NA];
    p += Math.hypot(r1 * Math.sin(t1) - r0 * Math.sin(t0), r1 * Math.cos(t1) - r0 * Math.cos(t0));
  }
  return p;
}
/* fill angles a slice did not reach (r = 0) from their neighbours, then soften */
export function fixRing(r, soft = 1) {
  const o = Float32Array.from(r);
  for (let j = 0; j < NA; j++) if (!(o[j] > 0)) {
    let a = 1, b = 1; while (a < NA && !(r[(j - a + NA) % NA] > 0)) a++; while (b < NA && !(r[(j + b) % NA] > 0)) b++;
    const ra = r[(j - a + NA) % NA] || 0, rb = r[(j + b) % NA] || 0; o[j] = (ra * b + rb * a) / (a + b);
  }
  for (let it = 0; it < soft; it++) { const c = Float32Array.from(o); for (let j = 0; j < NA; j++) o[j] = (c[(j + NA - 1) % NA] + 2 * c[j] + c[(j + 1) % NA]) / 4; }
  return o;
}
