/* node tools/measure-test.js : checks the card maths against photos with a known answer (simulated perspective + tap error) */
const M = require("../assets/measure-math.js");
const D = require("../assets/measure-data.js").FVM_DATA;
let fails = 0;
const ok = (cond, msg) => { console.log((cond ? "  ok   " : "  FAIL ") + msg); if (!cond) fails++; };
/* a camera: plane (mm) -> image (px). tilt = perspective strength */
function cam(tilt, rot, scale) {
  const c = Math.cos(rot), s = Math.sin(rot);
  return (p) => { const x = p.x * c - p.y * s, y = p.x * s + p.y * c, w = 1 + tilt * x / 1000 + tilt * 0.6 * y / 1000;
    return { x: 2000 + x * scale / w, y: 1500 + y * scale / w }; };
}
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5;
function trial(name, tilt, rot, scale, tapErrPx, cardAt, a, b, scaleKey = "card") {
  const S = M.SCALES[scaleKey], f = cam(tilt, rot, scale), j = (p) => ({ x: p.x + rnd() * 2 * tapErrPx, y: p.y + rnd() * 2 * tapErrPx });
  const cx = cardAt.x, cy = cardAt.y;
  const corners = [{ x: cx, y: cy }, { x: cx + S.long, y: cy }, { x: cx + S.long, y: cy + S.short }, { x: cx, y: cy + S.short }]
    .map(f).map(j).sort(() => rnd());           /* tapped in any order */
  const P = M.plane(corners, scaleKey);
  const truth = Math.hypot(a.x - b.x, a.y - b.y), got = P.dist(j(f(a)), j(f(b)));
  const err = got - truth;
  if (!name.startsWith("run ")) ok(Math.abs(err) <= Math.max(6, truth * 0.015), `${name}: true ${truth.toFixed(1)} mm, measured ${got.toFixed(1)} mm (error ${err.toFixed(1)} mm, skew ${P.skew.toFixed(2)})`);
  return err;
}
console.log("Exact taps (maths only):");
trial("card, straight above, chest 540 mm", 0, 0.4, 3.5, 0, { x: -40, y: -30 }, { x: -270, y: 0 }, { x: 270, y: 0 });
trial("card, phone tilted ~6 degrees", 0.1, 0.3, 3.5, 0, { x: -40, y: -30 }, { x: -270, y: 0 }, { x: 270, y: 0 });
trial("A4, phone tilted ~20 degrees, trouser length 1040 mm", 0.35, -0.4, 2.5, 0, { x: 20, y: 100 }, { x: 150, y: -500 }, { x: 160, y: 540 }, "a4");
console.log("Realistic: 12 MP photo, about 3.5 px per mm, finger error 3 px with the magnifier, phone tilted up to ~6 degrees:");
const errs = []; const quiet = true;
for (let i = 0; i < 200; i++) {
  errs.push(trial("run " + i, rnd() * 0.2, rnd() * 6, 3.5 * (1 + rnd() * 0.3), 3, { x: -40 + rnd() * 60, y: -30 + rnd() * 60 }, { x: -270, y: 10 }, { x: 270, y: 10 }));
}
const ab = errs.map(Math.abs).sort((a, b) => a - b);
console.log(`  chest 540 mm flat, 200 photos: half within ${(ab[100] * 2 / 10).toFixed(1)} cm around, 9 in 10 within ${(ab[180] * 2 / 10).toFixed(1)} cm (a size step is 4 cm)`);
ok(ab[180] * 2 / 10 <= 2, "9 in 10 photos within 2 cm around (half a size step)");
console.log("Foot on paper with card (true 265 mm):");
for (let i = 0; i < 5; i++) trial("foot " + i, rnd() * 0.2, rnd() * 6, 4.5, 3, { x: 60, y: 120 }, { x: 0, y: 0 }, { x: 0, y: 265 });
console.log("A4 paper as scale, chest 540 mm:");
trial("A4", 0.3, 0.2, 3.0, 3, { x: -150, y: -100 }, { x: -270, y: 0 }, { x: 270, y: 0 }, "a4");

console.log("Size picking:");
const P = (id) => D.products.find((p) => p.id === id);
const t = (id, vals, want) => { const r = M.pickSize(P(id), vals); ok(r && r.size === want, `${id} ${JSON.stringify(vals)} -> ${r && r.size} (want ${want})`); };
t("shirt-bamboo", { chest: 108, shoulder: 46.4 }, "40");
t("shirt-bamboo", { chest: 109.5, shoulder: 46.4 }, "41");      /* chest between 108 and 112 -> bigger */
t("shirt-bamboo", { chest: 104, shoulder: 47.5 }, "41");        /* broad shoulders win */
t("shirt-oxford", { chest: 104, shoulder: 45 }, "40");
t("pants", { waist: 84, hip: 103 }, "32");
t("pants", { waist: 98, hip: 112 }, "38");                      /* no 37: 36 is 96.6 -> 38 */
t("suit", { chest: 106, shoulder: 45 }, "2XL");
t("tee", { teewidth: 56 }, "L");
t("shoe-toecap", { foot: 25.6 }, "41");                          /* 40 fits up to 25.5 -> 41 */
t("shoe-business", { foot: 24.2 }, "39");
const big = M.pickSize(P("gymtee"), { chest: 120 }); ok(big.tooBig.length === 1 && big.size === "XXL", "gym tee chest 120 -> XXL flagged too big");
console.log(fails ? `\n${fails} FAILED` : "\nall passed");
process.exit(fails ? 1 : 0);
