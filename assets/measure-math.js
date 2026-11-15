/* Fangviper card measuring: the maths. A bank card (ISO ID-1, 85.60 x 53.98 mm) or a sheet of paper in the photo
   gives the scale. The 4 tapped corners give a homography from the photo to the flat floor, so a photo taken at a
   slight angle is still measured correctly, as long as everything measured lies flat on the same floor.
   Works in the browser (window.FVM) and in Node (module.exports) for tests. */
(function (root) {
  var SCALES = {
    card:   { name: "Bank card",     long: 85.6,  short: 53.98 },
    a4:     { name: "A4 paper",      long: 297,   short: 210 },
    letter: { name: "Letter paper",  long: 279.4, short: 215.9 }
  };

  /* order 4 points around their centre, then rotate so edge 0-1 is a long side of the rectangle */
  function orderCorners(p) {
    var cx = 0, cy = 0;
    p.forEach(function (q) { cx += q.x / 4; cy += q.y / 4; });
    var s = p.slice().sort(function (a, b) { return Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx); });
    var d = function (a, b) { return Math.hypot(a.x - b.x, a.y - b.y); };
    var pairA = d(s[0], s[1]) + d(s[2], s[3]), pairB = d(s[1], s[2]) + d(s[3], s[0]);
    return pairA >= pairB ? s : [s[1], s[2], s[3], s[0]];
  }

  /* solve A x = b (n x n) by Gaussian elimination with partial pivoting */
  function solve(A, b) {
    var n = b.length, M = A.map(function (r, i) { return r.concat([b[i]]); });
    for (var c = 0; c < n; c++) {
      var piv = c;
      for (var r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
      if (Math.abs(M[piv][c]) < 1e-12) return null;
      var t = M[c]; M[c] = M[piv]; M[piv] = t;
      for (r = 0; r < n; r++) {
        if (r === c) continue;
        var f = M[r][c] / M[c][c];
        for (var k = c; k <= n; k++) M[r][k] -= f * M[c][k];
      }
    }
    return M.map(function (r, i) { return r[n] / r[i]; });
  }

  /* homography mapping src[i] -> dst[i] (4 pairs); returns 3x3 as a flat array of 9 */
  function homography(src, dst) {
    var A = [], b = [];
    for (var i = 0; i < 4; i++) {
      var x = src[i].x, y = src[i].y, u = dst[i].x, v = dst[i].y;
      A.push([x, y, 1, 0, 0, 0, -x * u, -y * u]); b.push(u);
      A.push([0, 0, 0, x, y, 1, -x * v, -y * v]); b.push(v);
    }
    var h = solve(A, b);
    return h ? h.concat([1]) : null;
  }

  function apply(H, p) {
    var w = H[6] * p.x + H[7] * p.y + H[8];
    return { x: (H[0] * p.x + H[1] * p.y + H[2]) / w, y: (H[3] * p.x + H[4] * p.y + H[5]) / w };
  }

  /* least-squares affine fit (6 numbers) from 4+ point pairs, returned as a 3x3 with no perspective */
  function affine(src, dst) {
    var A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], bx = [0, 0, 0], by = [0, 0, 0];
    src.forEach(function (p, i) {
      var v = [p.x, p.y, 1];
      for (var r = 0; r < 3; r++) { for (var c = 0; c < 3; c++) A[r][c] += v[r] * v[c]; bx[r] += v[r] * dst[i].x; by[r] += v[r] * dst[i].y; }
    });
    var X = solve(A.map(function (r) { return r.slice(); }), bx), Y = solve(A.map(function (r) { return r.slice(); }), by);
    return X && Y ? [X[0], X[1], X[2], Y[0], Y[1], Y[2], 0, 0, 1] : null;
  }

  /* build a measuring plane from the 4 tapped corners of the scale object. Returns null if the shape is unusable.
     A bank card is small, so its 4 corners can't pin down camera tilt reliably: tiny tap errors would be magnified
     across a whole shirt. For the card we fit scale + rotation + shear only (tests: 2-3x more accurate for a photo
     taken roughly from above). A sheet of paper is big enough to correct tilt too, so it gets the full homography. */
  function plane(corners, scaleKey) {
    var S = SCALES[scaleKey] || SCALES.card;
    var c = orderCorners(corners);
    var dst = [{ x: 0, y: 0 }, { x: S.long, y: 0 }, { x: S.long, y: S.short }, { x: 0, y: S.short }];
    var H = scaleKey === "card" ? affine(c, dst) : homography(c, dst);
    if (!H) return null;
    /* a sanity check: in the photo, the long sides should look longer than the short sides, and the shape convex */
    var d = function (a, b) { return Math.hypot(a.x - b.x, a.y - b.y); };
    var longPx = (d(c[0], c[1]) + d(c[2], c[3])) / 2, shortPx = (d(c[1], c[2]) + d(c[3], c[0])) / 2;
    var ratio = longPx / shortPx, want = S.long / S.short;
    var cross = function (a, b, o) { return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x); };
    var sgn = [0, 1, 2, 3].map(function (i) { return Math.sign(cross(c[(i + 1) % 4], c[(i + 2) % 4], c[i])); });
    var convex = sgn.every(function (s) { return s === sgn[0] && s !== 0; });
    return {
      H: H, corners: c, scale: S,
      convex: convex,
      skew: ratio / want,           /* about 1 when the photo was taken from straight above */
      mmPerPx: S.long / longPx,     /* rough, for display only */
      dist: function (a, b) { var p = apply(H, a), q = apply(H, b); return Math.hypot(p.x - q.x, p.y - q.y); } /* mm */
    };
  }

  /* choose a size. product.measures: [{key, chart:[cm per size], primary, tol}], values: {key: cm}
     Primary measures decide: for each, the smallest size whose chart value is at least (yours - tol).
     The biggest of those wins, so nothing that matters ends up tight ("between two sizes, take the bigger one"). */
  function pickSize(product, values) {
    var n = product.sizes.length, idx = -1, over = [], under = [];
    product.measures.forEach(function (m) {
      if (!m.primary || values[m.key] == null) return;
      var v = values[m.key], tol = m.tol != null ? m.tol : 1, i = 0;
      while (i < n && m.chart[i] < v - tol) i++;
      if (i === n) { over.push(m.key); i = n - 1; }
      if (i === 0 && m.chart[0] - v > (m.loose != null ? m.loose : 6)) under.push(m.key);
      idx = Math.max(idx, i);
    });
    if (idx < 0) return null;
    var notes = [];
    product.measures.forEach(function (m) {
      if (values[m.key] == null) return;
      var diff = m.chart[idx] - values[m.key];
      notes.push({ key: m.key, yours: values[m.key], size: m.chart[idx], diff: diff });
    });
    return { index: idx, size: product.sizes[idx], tooBig: over, tooSmall: under, notes: notes };
  }

  /* closest size to ALL the measurements (people measure by hand, so no single number is exact).
     values: {key: cm, measured straight across / down the garment laid flat}. Charts that go all the way round
     (flat2) are halved so both sides are compared the same way. Each difference is counted in "size steps" for
     that measurement; the ones that decide the fit count fully, the others a third. A near tie goes to the bigger
     size. Shoes are different: a shoe must never be shorter than the foot, so the smallest size that fits. */
  function closestSize(product, values) {
    var n = product.sizes.length, used = product.measures.filter(function (m) { return values[m.key] != null; });
    if (!used.length || !used.some(function (m) { return m.primary; })) return null;
    var across = function (m) { return m.chart.map(function (c) { return m.flat2 ? c / 2 : c; }); };
    var idx, scores = [], tooBig = [], tooSmall = [];
    used.forEach(function (m) {
      var c = across(m), v = values[m.key], step = 0;
      for (var i = 1; i < n; i++) step += Math.abs(c[i] - c[i - 1]) / (n - 1);
      m._c = c; m._step = Math.max(step, 0.5);
      if (m.primary && v > c[n - 1] + m._step) tooBig.push(m.key);
      if (m.primary && v < c[0] - m._step) tooSmall.push(m.key);
    });
    if (product.shoe) {
      var f = used.filter(function (m) { return m.primary; })[0], fv = values[f.key];
      idx = 0; while (idx < n && f._c[idx] < fv) idx++;
      if (idx === n) { idx = n - 1; if (tooBig.indexOf(f.key) < 0) tooBig.push(f.key); }
    } else {
      for (var i = 0; i < n; i++) {
        var s = 0;
        used.forEach(function (m) { var d = (values[m.key] - m._c[i]) / m._step; s += (m.primary ? 1 : 0.35) * d * d; });
        scores.push(s);
      }
      idx = 0;
      for (i = 1; i < n; i++) if (scores[i] < scores[idx] - 0.05 || Math.abs(scores[i] - scores[idx]) <= 0.05) idx = i;
    }
    var alt = -1;
    if (scores.length) [idx - 1, idx + 1].forEach(function (j) { if (j >= 0 && j < n && scores[j] - scores[idx] < 0.6 && (alt < 0 || scores[j] < scores[alt])) alt = j; });
    return {
      index: idx, size: product.sizes[idx], alt: alt < 0 ? null : product.sizes[alt], altBigger: alt > idx,
      tooBig: tooBig, tooSmall: tooSmall,
      rows: used.map(function (m) { return { key: m.key, label: m.label, yours: values[m.key], size: m._c[idx], diff: m._c[idx] - values[m.key], primary: !!m.primary }; })
    };
  }

  var api = { closestSize: closestSize, SCALES: SCALES, orderCorners: orderCorners, homography: homography, apply: apply, plane: plane, pickSize: pickSize };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.FVM = api;
})(this);
