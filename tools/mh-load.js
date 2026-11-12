// mh-load.js - load the MakeHuman CC0 base mesh (hm08) and apply the male macro targets. Units in, cm out (MakeHuman uses dm).
const fs = require("fs");
const path = require("path");
const SRC = path.join(__dirname, "..", "_src", "makehuman");

function loadObj(file) {
  const v = [], groups = {};
  let g = "default"; groups[g] = [];
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    if (line.startsWith("v ")) { const p = line.split(/\s+/); v.push(+p[1], +p[2], +p[3]); }
    else if (line.startsWith("g ")) { g = line.slice(2).trim(); groups[g] = groups[g] || []; }
    else if (line.startsWith("f ") && g) groups[g].push(line.slice(2).trim().split(/\s+/).map((t) => parseInt(t, 10) - 1));
  }
  return { v, groups };
}
function applyTarget(v, name, w) {
  if (!w) return;
  for (const line of fs.readFileSync(path.join(SRC, name), "utf8").split(/\r?\n/)) {
    if (!line || line[0] === "#") continue;
    const p = line.trim().split(/\s+/); if (p.length < 4) continue;
    const i = +p[0] * 3; v[i] += w * +p[1]; v[i + 1] += w * +p[2]; v[i + 2] += w * +p[3];
  }
}
// muscle: 0.5 = average, 1 = max. Race: an even mix, as MakeHuman's default.
function maleMesh(muscle = 0.75) {
  const o = loadObj(path.join(SRC, "base.obj"));
  const m = (muscle - 0.5) / 0.5;
  applyTarget(o.v, "universal-male-young-averagemuscle-averageweight.target", 1 - m);
  applyTarget(o.v, "universal-male-young-maxmuscle-averageweight.target", m);
  for (const r of ["african", "asian", "caucasian"]) applyTarget(o.v, r + "-male-young.target", 1 / 3);
  for (let i = 0; i < o.v.length; i++) o.v[i] *= 10; // dm -> cm
  return o;
}
module.exports = { loadObj, applyTarget, maleMesh, SRC };
