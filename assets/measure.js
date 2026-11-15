/* Fangviper "Find your size": one question per screen. Lay something that fits you well flat, measure what the
   picture shows (with a bank card, cm or inches), type it in, and get the size closest to ALL your measurements.
   (The older photo version is kept in measure-photo.js, not loaded.) */
(function () {
  var D = window.FVM_DATA, MATH = window.FVM, app = document.getElementById("app");
  var q = new URLSearchParams(location.search);
  var CARD = 8.56; /* cm: every bank, debit and ID card */
  var S = { p: null, step: 0, vals: {}, card: {}, unit: "card", screen: null, hist: [] };
  try { var u = localStorage.getItem("fv-measure-unit"); if (u === "cm" || u === "in" || u === "card") S.unit = u; } catch (e) {}

  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var r1 = function (v) { return (Math.round(v * 10) / 10).toFixed(1).replace(/\.0$/, ""); };
  var FR = { 0: "", 0.25: "¼", 0.5: "½", 0.75: "¾" };
  var cardsSay = function (cm) { var v = Math.round(cm / CARD * 4) / 4, w = Math.floor(v); return (w || (v ? "" : "0")) + FR[v - w] + (v === 1 ? " card" : " cards"); };
  var unitOf = function () { return S.p && S.p.shoe && S.unit === "card" ? "cm" : S.unit; };
  var show = function (cm) { /* main number in the chosen unit, the others small */
    var u = unitOf();
    if (u === "card") return cardsSay(cm) + "<small>" + r1(cm) + " cm · " + r1(cm / 2.54) + "″</small>";
    if (u === "in") return r1(cm / 2.54) + "″<small>" + r1(cm) + " cm</small>";
    return r1(cm) + " cm<small>" + r1(cm / 2.54) + "″</small>";
  };
  var byId = function (id) { return document.getElementById(id); };

  /* ---------- pictures (viewBox 400 x 470): the garment, with the line to measure in bright yellow ---------- */
  var SHAPES = {
    shirt: '<path d="M160 40 L122 52 L84 70 L34 340 L78 352 L118 176 L116 440 Q200 452 284 440 L282 176 L322 352 L366 340 L316 70 L278 52 L240 40 Q200 54 160 40 Z" fill="#FAF4EB"/><path d="M160 40 L180 92 L200 64 L220 92 L240 40" fill="#fff"/><line x1="200" y1="64" x2="200" y2="444" stroke-width="1" stroke="#b9b0a5"/>',
    tee: '<path d="M160 40 L122 52 L84 70 L44 168 L98 190 L118 150 L116 440 Q200 452 284 440 L282 150 L302 190 L356 168 L316 70 L278 52 L240 40 Q200 62 160 40 Z" fill="#FAF4EB"/>',
    vest: '<path d="M146 34 L176 34 Q200 96 224 34 L254 34 L258 120 Q268 168 286 196 L284 440 Q200 452 116 440 L114 196 Q132 168 142 120 Z" fill="#FAF4EB"/>',
    pants: '<path d="M110 30 L290 30 L300 150 L310 450 L215 450 L200 170 L185 450 L90 450 L100 150 Z" fill="#FAF4EB"/><line x1="111" y1="56" x2="289" y2="56" stroke-width="1.4"/>',
    foot: '<rect x="20" y="22" width="360" height="12" fill="#19110B" stroke="none"/><text x="200" y="16" font-size="15" text-anchor="middle" stroke="none" fill="#6f665e">WALL</text><rect x="90" y="34" width="220" height="420" fill="#fff"/><path d="M200 44 C160 44 150 90 152 150 C154 220 140 280 146 330 C152 390 176 404 196 404 C228 404 250 386 250 340 C250 290 240 220 244 150 C248 90 238 44 200 44 Z" fill="#FAF4EB" stroke-dasharray="6 5"/><line x1="170" y1="420" x2="230" y2="420" stroke-width="3"/>'
  };
  /* real photo-style pictures (assets/finder), per garment: the intro, and each measurement as -card / -tape.
     Measurements without a photo yet fall back to the drawing below. */
  /* which picture set each product uses (blank, universal garments), and which picture each measurement uses.
     Files: <set>-intro.webp, <set>-<part>-tape.webp and <set>-<part>-card.webp (shoes: foot-tape only). */
  function setOf(p) {
    var id = p.id;
    if (id === "tee" || id === "gymtee") return "tee";
    if (id === "gymvest") return "vest";
    if (id === "joggers") return "joggers";
    if (id === "pants") return "trousers";
    if (id === "waistcoat") return "waistcoat";
    if (id === "suit" || /^jacket-/.test(id)) return "jacket";
    if (/^shirt-/.test(id)) return "shirt";
    if (p.shoe) return "foot";
    return null;
  }
  var PART = { chest: "chest", teewidth: "chest", shoulder: "shoulder", sleeve: "sleeve", length: "length", teelength: "length", vlength: "length",
               waist: "waist", jwaist: "waist", hip: "hip", thigh: "thigh", plength: "length", foot: "foot" };
  var HAVE = { tee: "chest shoulder length", shirt: "chest shoulder sleeve length", jacket: "chest shoulder sleeve length", vest: "chest length",
               waistcoat: "chest length", trousers: "waist hip thigh length", joggers: "waist hip length", foot: "foot" };
  function photo(kind, m) {
    var set = S.p && setOf(S.p); if (!set) return null;
    if (!m) return '<img src="../assets/finder/' + set + '-intro.webp" width="900" height="900" alt="' + esc(p_alt()) + '" decoding="async">';
    var part = PART[m.key]; if (!part || (" " + HAVE[set] + " ").indexOf(" " + part + " ") < 0) return null;
    var file = set === "foot" ? "foot-tape" : set + "-" + part + (unitOf() === "card" ? "-card" : "-tape");
    return '<img src="../assets/finder/' + file + '.webp" width="900" height="900" alt="' + esc(m.ask + ". " + m.say) + '" decoding="async">';
  }
  function p_alt() { return S.p.shoe ? "A sheet of paper on the floor against a wall, with your heel touching the wall." : "Lay your " + S.p.item + " flat. A tape measure or just a bank card is all you need."; }
  function picture(kind, m) {
    var ph = photo(kind, m); if (ph) return ph;
    var line = "";
    if (m) {
      var L = m.line, dx = L[2] - L[0], dy = L[3] - L[1], len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len, px = -uy, py = ux, a = 15, b = 9;
      var head = function (x, y, sx, sy) { return '<path d="M' + x + " " + y + " L" + (x - sx * a + px * b) + " " + (y - sy * a + py * b) + " L" + (x - sx * a - px * b) + " " + (y - sy * a - py * b) + ' Z" fill="#19110B" stroke="none"/>'; };
      line = '<line x1="' + L[0] + '" y1="' + L[1] + '" x2="' + L[2] + '" y2="' + L[3] + '" stroke="#F2B705" stroke-width="12" stroke-linecap="round"/>' +
        '<line x1="' + L[0] + '" y1="' + L[1] + '" x2="' + L[2] + '" y2="' + L[3] + '" stroke="#19110B" stroke-width="2.5"/>' +
        head(L[2], L[3], ux, uy) + head(L[0], L[1], -ux, -uy);
    }
    return '<svg viewBox="0 0 400 470" fill="none" stroke="#19110B" stroke-width="2.2" stroke-linejoin="round" font-family="Jost, sans-serif" aria-hidden="true">' + SHAPES[kind] + line + "</svg>";
  }
  function miniCard(frac) {
    return '<svg width="44" height="28" viewBox="0 0 44 28"><rect x="1" y="1" width="42" height="26" rx="3" fill="#3a332d"/>' +
      (frac ? '<rect x="1" y="1" width="' + (42 * frac) + '" height="26" rx="' + (frac === 1 ? 3 : 0) + '" fill="#F2B705"/>' : "") +
      '<rect x="1" y="1" width="42" height="26" rx="3" fill="none" stroke="#19110B" stroke-width="1.5"/></svg>';
  }

  /* ---------- screens ---------- */
  function go(screen) { if (S.screen) S.hist.push(S.screen + ":" + S.step); S.screen = screen; render(); window.scrollTo(0, 0); }
  function back() { var h = S.hist.pop(); if (!h) return; var p = h.split(":"); S.screen = p[0]; S.step = +p[1]; render(); }
  function top(n, total) {
    var prog = "";
    if (total) { prog = '<div class="m-prog">'; for (var i = 0; i < total; i++) prog += '<i class="' + (i < n ? "on" : "") + '"></i>'; prog += "</div>"; }
    return '<div class="m-top"><button class="m-back" id="bk" type="button">&larr; Back</button>' + prog + '<span class="m-prod">' + esc(S.p ? S.p.name : "") + "</span></div>";
  }
  function render() { var f = SCREENS[S.screen]; app.innerHTML = f.html(); var b = byId("bk"); if (b) b.onclick = back; if (f.wire) f.wire(); }
  var SCREENS = {};

  /* 1. which product */
  SCREENS.pick = {
    html: function () {
      var groups = {}, order = [];
      D.products.forEach(function (p) { if (!groups[p.group]) { groups[p.group] = []; order.push(p.group); } groups[p.group].push(p); });
      return '<h1>Find your size</h1><p class="lead">A few quick questions. Measure something that already fits you well, and we show the size that matches it best.</p>' +
        order.map(function (g) {
          return '<div class="m-group"><h3>' + esc(g) + '</h3><div class="m-list">' +
            groups[g].map(function (p) { return '<button type="button" data-id="' + p.id + '">' + esc(p.name) + "</button>"; }).join("") + "</div></div>";
        }).join("");
    },
    wire: function () { app.querySelectorAll("[data-id]").forEach(function (b) { b.onclick = function () { choose(b.dataset.id); go("intro"); }; }); }
  };
  function choose(id) { S.p = D.products.filter(function (p) { return p.id === id; })[0]; S.vals = {}; S.card = {}; S.step = 0; }
  function total() { return S.p.measures.length + 1; }

  /* 2. get ready */
  SCREENS.intro = {
    html: function () {
      var p = S.p, item = esc(p.item), btn = /shirt|jacket|blazer|waistcoat|suit/.test(p.item), zip = /trousers|joggers/.test(p.item);
      var steps = p.shoe
        ? ["<b>You need</b> a sheet of paper, a pen, and a tape measure or ruler.", "<b>Put the paper on the floor</b>, pushed against a wall.", "<b>Then answer one question</b>: how long your foot is."]
        : ["<b>Take your best-fitting " + item + ".</b> One you like the fit of. We measure it, not you.",
           "<b>Lay it flat</b> on a table or the floor and smooth it out." + (btn ? " Button it." : "") + (zip ? " Do up the zip and button." : ""),
           "<b>Have a tape measure ready</b>, or just a bank card: every card is " + r1(CARD) + " cm (3.4″) long, so you can count cards.",
           "<b>Answer " + p.measures.length + " quick questions</b>, each with a picture."];
      return top(1, total()) + '<h2>' + (p.shoe ? "Get ready" : "Take your best-fitting " + item) + '</h2>' +
        (photo(p.draw, null)
          ? '<div class="m-pic m-pic--big">' + photo(p.draw, null) + '</div><ol class="m-list-steps">' + steps.map(function (s) { return "<li>" + s + "</li>"; }).join("") + "</ol>"
          : '<div class="m-how">' + picture(p.draw, null) + "<ol>" + steps.map(function (s) { return "<li>" + s + "</li>"; }).join("") + "</ol></div>") +
        '<div class="m-btns"><button class="pill" type="button" id="start">Start</button></div>';
    },
    wire: function () { byId("start").onclick = function () { S.step = 0; go("q"); }; }
  };

  /* 3. one question per screen */
  SCREENS.q = {
    html: function () {
      var p = S.p, m = p.measures[S.step], u = unitOf(), last = S.step === p.measures.length - 1;
      var tabs = (p.shoe ? ["cm", "in"] : ["card", "cm", "in"]).map(function (k) {
        return '<button type="button" data-u="' + k + '" aria-pressed="' + (u === k) + '">' + { card: "Bank cards", cm: "cm", in: "inches" }[k] + "</button>";
      }).join("");
      var input;
      if (u === "card") {
        var c = S.card[m.key] || {}, whole = c.w != null ? c.w : Math.floor(mid(m) / CARD);
        input = '<p class="m-cardhint">Lay a card on it and move it end to end. Count the whole cards, then pick what is left over.</p>' +
          '<div class="m-step"><button type="button" id="minus" aria-label="One card less">&minus;</button><div><b id="whole">' + whole + '</b><span>whole cards</span></div><button type="button" id="plus" aria-label="One card more">+</button></div>' +
          '<p class="m-left">and what is left over:</p><div class="m-fr">' + [0, 0.25, 0.5, 0.75].map(function (f) {
            return '<button type="button" data-f="' + f + '" aria-pressed="' + (c.f === f) + '">' + miniCard(f) + "<span>" + (f ? FR[f] + " card" : "nothing") + "</span></button>";
          }).join("") + "</div>";
      } else {
        var cur = S.vals[m.key] != null ? r1(u === "in" ? S.vals[m.key] / 2.54 : S.vals[m.key]) : "";
        input = '<label class="m-num"><input id="num" type="number" inputmode="decimal" step="0.1" min="0" value="' + cur + '" placeholder="0" aria-label="' + esc(m.label) + '"><span>' + (u === "in" ? "inches" : "cm") + "</span></label>";
      }
      return top(2 + S.step, total()) + '<p class="m-qno">Question ' + (S.step + 1) + " of " + p.measures.length + "</p><h2>" + esc(m.ask) + "</h2>" +
        '<div class="m-pic">' + picture(p.draw, m) + "</div>" +
        '<p class="m-say">' + esc(m.say) + "</p>" +
        '<div class="m-units" role="group" aria-label="Measure with">' + tabs + "</div>" + input +
        '<div class="m-read" id="rd">' + readout(m) + "</div>" +
        '<div class="m-btns"><button class="pill" type="button" id="next"' + (S.vals[m.key] != null ? "" : " disabled") + ">" + (last ? "Show my size" : "Next") + "</button></div>" +
        (m.primary ? "" : '<button class="m-link" type="button" id="skip">I can\'t measure this, skip it</button>');
    },
    wire: function () {
      var m = S.p.measures[S.step];
      app.querySelectorAll("[data-u]").forEach(function (b) { b.onclick = function () { S.unit = b.dataset.u; try { localStorage.setItem("fv-measure-unit", S.unit); } catch (e) {} render(); }; });
      var upd = function () { byId("rd").innerHTML = readout(m); byId("next").disabled = S.vals[m.key] == null; };
      if (unitOf() === "card") {
        var c = S.card[m.key] = S.card[m.key] || { w: Math.floor(mid(m) / CARD) };
        var setCm = function () { if (c.f != null) S.vals[m.key] = (c.w + c.f) * CARD; upd(); };
        byId("minus").onclick = function () { c.w = Math.max(0, c.w - 1); byId("whole").textContent = c.w; setCm(); };
        byId("plus").onclick = function () { c.w = c.w + 1; byId("whole").textContent = c.w; setCm(); };
        app.querySelectorAll("[data-f]").forEach(function (b) { b.onclick = function () {
          c.f = +b.dataset.f; app.querySelectorAll("[data-f]").forEach(function (x) { x.setAttribute("aria-pressed", x === b); }); setCm(); }; });
      } else {
        var el = byId("num");
        el.oninput = function () { var v = parseFloat(el.value); if (isFinite(v) && v > 0) S.vals[m.key] = unitOf() === "in" ? v * 2.54 : v; else delete S.vals[m.key]; upd(); };
        el.onkeydown = function (e) { if (e.key === "Enter" && S.vals[m.key] != null) next(); };
      }
      byId("next").onclick = next;
      var sk = byId("skip"); if (sk) sk.onclick = function () { delete S.vals[m.key]; delete S.card[m.key]; next(); };
    }
  };
  function mid(m) { var c = m.chart[Math.floor(m.chart.length / 2)]; return m.flat2 ? c / 2 : c; }
  var RANGE = { chest: [35, 85], teewidth: [35, 90], shoulder: [30, 65], sleeve: [40, 82], length: [50, 100], teelength: [50, 100], vlength: [45, 100],
                waist: [28, 75], jwaist: [25, 65], hip: [35, 80], thigh: [17, 45], plength: [80, 125], foot: [20, 34] };
  function readout(m) {
    var v = S.vals[m.key]; if (v == null) return "";
    var warn = RANGE[m.key] && (v < RANGE[m.key][0] || v > RANGE[m.key][1]) ? '<small class="bad">That looks unusual. Please check it.</small>' : "";
    return '<span class="m-yours">Yours: ' + show(v) + "</span>" + warn;
  }
  function next() { if (S.step < S.p.measures.length - 1) { S.step++; go("q"); } else go("result"); }

  /* 4. the size closest to everything */
  SCREENS.result = {
    html: function () {
      var p = S.p, r = MATH.closestSize(p, S.vals);
      if (!r) return top(0, 0) + '<h2>We need at least the first question answered.</h2><div class="m-btns"><button class="pill" id="again" type="button">Start again</button></div>';
      var word = function (d, m) {
        if (Math.abs(d) < 0.75) return '<span class="ok">same as yours</span>';
        var amt = unitOf() === "in" ? r1(Math.abs(d) / 2.54) + "″" : r1(Math.abs(d)) + " cm";
        return /length|sleeve|foot/i.test(m.key) ? amt + (d > 0 ? " longer" : " shorter") : amt + (d > 0 ? " bigger" : " smaller");
      };
      var rows = r.rows.map(function (x) { return "<tr><td>" + esc(x.label) + "</td><td>" + show(x.yours) + "</td><td>" + show(x.size) + "<small>" + word(x.diff, x) + "</small></td></tr>"; }).join("");
      var notes = [];
      if (r.tooBig.length) notes.push("<b>Yours is bigger than our largest size (" + esc(p.sizes[p.sizes.length - 1]) + ").</b> This one may be too tight. Message us before you order and we'll check with the maker.");
      if (r.tooSmall.length) notes.push("<b>Yours is smaller than our smallest size.</b> Size " + esc(r.size) + " will feel loose.");
      if (r.alt && !r.tooBig.length && !r.tooSmall.length) notes.push("<b>Also close: size " + esc(r.alt) + ".</b> Choose it if you like a " + (r.altBigger ? "looser" : "closer") + " fit.");
      if (p.shoe) notes.push("A shoe must never be shorter than your foot, so this is the smallest size that fits. Measure your other foot too and use the longer one.");
      if (p.tip) notes.push(esc(p.tip));
      var sep = p.back.indexOf("?") > -1 ? "&" : "?";
      return top(0, 0) + '<div class="m-res"><p class="eyebrow">Your size in the ' + esc(p.name) + '</p><div class="big">' + esc(r.size) + "</div>" +
        '<p class="sub">' + (p.shoe ? "From your foot length." : "The size closest to all your measurements. Measuring by hand is never exact, so we compare every number, not just one.") + "</p>" +
        '<table class="m-cmp"><thead><tr><th></th><th>Yours</th><th>Size ' + esc(r.size) + "</th></tr></thead><tbody>" + rows + "</tbody></table>" +
        '<div class="m-notes">' + notes.map(function (n) { return "<p>" + n + "</p>"; }).join("") + "</div>" +
        '<div class="m-btns"><a class="pill" href="' + esc(p.back + sep + "utm_source=fangviper_sizes&utm_medium=referral&utm_campaign=size_finder") + '">Shop size ' + esc(r.size) + "</a>" +
        '<button class="pill pill--ghost" type="button" id="again">Measure again</button></div>' +
        '<button class="m-link" type="button" id="other">Find my size for another product</button>' +
        '<p class="m-src">Sizes from the ' + esc(p.source) + ". Measured by hand, so allow 1–2 cm.</p></div>";
    },
    wire: function () {
      byId("again").onclick = function () { S.vals = {}; S.card = {}; S.step = 0; S.hist = ["pick:0"]; S.screen = "intro"; render(); window.scrollTo(0, 0); };
      var o = byId("other"); if (o) o.onclick = function () { S.hist = []; S.screen = "pick"; render(); };
    }
  };

  /* ---------- start (a product page can link here with ?p=id or ?handle=store-handle) ---------- */
  var start = q.get("p") || D.handles[q.get("handle")];
  if (start && D.products.some(function (p) { return p.id === start; })) { choose(start); S.hist = ["pick:0"]; S.screen = "intro"; }
  else S.screen = "pick";
  render();
  window.__fvm = { S: S, MATH: MATH, render: render, go: go };
})();
