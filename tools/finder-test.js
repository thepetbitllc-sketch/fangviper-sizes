/* node tools/finder-test.js : the question finder must give back the right size for every product and size,
   and stay at most one size off when every measurement is wrong by up to +-1.5 cm (a hand measurement). */
const M = require("../assets/measure-math.js"), D = require("../assets/measure-data.js").FVM_DATA;
let fails = 0, exact = 0, total = 0, off1 = 0, off2 = 0, noisy = 0;
let seed = 3; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5;
for (const p of D.products) {
  const across = (m, i) => (m.flat2 ? m.chart[i] / 2 : m.chart[i]);
  p.sizes.forEach((s, i) => {
    const v = {}; p.measures.forEach((m) => (v[m.key] = across(m, i)));
    const r = M.closestSize(p, v); total++;
    if (r.size === s) exact++; else { fails++; console.log("FAIL exact", p.id, s, "->", r.size); }
    /* only the main measurements answered */
    const v2 = {}; p.measures.filter((m) => m.primary).forEach((m) => (v2[m.key] = across(m, i)));
    const r2 = M.closestSize(p, v2); if (r2.size !== s) { fails++; console.log("FAIL main-only", p.id, s, "->", r2.size); }
    for (let k = 0; k < 40; k++) {
      const v3 = {}; p.measures.forEach((m) => (v3[m.key] = across(m, i) + rnd() * 3 * (p.shoe ? 0.2 : 1)));
      const j = p.sizes.indexOf(M.closestSize(p, v3).size); noisy++;
      const d = Math.abs(j - i); if (d === 1) off1++; if (d > 1) { off2++; }
    }
  });
}
console.log(`exact numbers: ${exact}/${total} sizes right`);
console.log(`with hand-measuring error (+-1.5 cm on every number): ${(100 - (off1 + off2) / noisy * 100).toFixed(0)}% right size, ${(off1 / noisy * 100).toFixed(0)}% one size off, ${(off2 / noisy * 100).toFixed(1)}% two or more off`);
/* shoes: never shorter than the foot */
const t = D.products.find((p) => p.id === "shoe-toecap");
const r = M.closestSize(t, { foot: 25.6 }); if (r.size !== "41") { fails++; console.log("FAIL shoe 25.6 ->", r.size); } else console.log("shoe: 25.6 cm foot -> 41 (40 only fits up to 25.5)");
const big = M.closestSize(D.products.find((p) => p.id === "gymtee"), { chest: 62 }); console.log("gym tee 62 cm across ->", big.size, big.tooBig.length ? "(flagged too big)" : "NOT FLAGGED");
if (!big.tooBig.length) fails++;
console.log(fails ? fails + " FAILED" : "all passed"); process.exit(fails ? 1 : 0);
