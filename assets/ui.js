/* FANG VIPER size guide: sizes, units, specs, table, fit finder. Exposes window.FV for the 3D viewer. */
(function () {
  /* ---------- data: add new products here ---------- */
  var PRODUCTS = {
    tee: {
      name: "T-Shirt",
      sizes: ["S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL"],
      length: { in: [28, 29, 30, 31, 32, 33, 34, 35],                  cm: [71, 73.7, 76.2, 78.7, 81.3, 83.8, 86.4, 89] },
      width:  { in: [18, 20, 22, 24, 26, 28, 30, 32],                  cm: [45.7, 50.8, 56, 61, 66, 71, 76.2, 81.3] },
      sleeve: { in: [15.625, 17, 18.5, 20, 21.5, 22.75, 24.25, 25.25], cm: [39.7, 43.2, 47, 50.8, 54.6, 58, 61.5, 64.3] },
      chest:  [[34, 37], [38, 41], [42, 45], [46, 49], [50, 53], [54, 57], [58, 61], [62, 65]] /* body, inches */
    }
  };

  var state = { product: "tee", unit: "in", size: 1, focus: null };
  var P = PRODUCTS[state.product];
  var subs = [];
  var $ = function (id) { return document.getElementById(id); };

  /* ---------- URL + saved unit ---------- */
  var q = new URLSearchParams(location.search);
  try { var saved = localStorage.getItem("fv-unit"); if (saved === "cm" || saved === "in") state.unit = saved; } catch (e) {}
  if (q.get("product") && PRODUCTS[q.get("product")]) { state.product = q.get("product"); P = PRODUCTS[state.product]; }
  if (q.get("unit") === "cm" || q.get("unit") === "in") state.unit = q.get("unit");
  if (q.get("size")) { var si = P.sizes.indexOf(q.get("size").toUpperCase()); if (si > -1) state.size = si; }

  /* ---------- formatting ---------- */
  var FR = ["", "\u215B", "\u00BC", "\u215C", "\u00BD", "\u215D", "\u00BE", "\u215E"];
  function fmtIn(v) {
    var w = Math.floor(v), n = Math.round((v - w) * 8);
    if (n === 8) { w++; n = 0; }
    return w + FR[n];
  }
  function fmtCm(v) { return (Math.round(v * 10) / 10).toString(); }
  function val(key, i) { return state.unit === "in" ? fmtIn(P[key].in[i]) : fmtCm(P[key].cm[i]); }
  function chestRange(i) {
    var r = P.chest[i];
    return state.unit === "in" ? r[0] + "\u2013" + r[1] : Math.round(r[0] * 2.54) + "\u2013" + Math.round(r[1] * 2.54);
  }
  function emit() { subs.forEach(function (fn) { fn(); }); }

  /* ---------- render ---------- */
  function renderSizes() {
    $("sizes").innerHTML = P.sizes.map(function (s, i) {
      return '<button type="button" data-size="' + i + '" aria-pressed="' + (i === state.size) + '">' + s + "</button>";
    }).join("");
  }
  function renderSpecs() {
    var u = state.unit, i = state.size;
    var rows = [
      ["A", "Length", "Shoulder by the collar to hem", val("length", i)],
      ["B", "Fits chest", "Your body, around \u00B7 tee is " + val("width", i) + " " + u + " wide laid flat", chestRange(i)],
      ["C", "Sleeve length", "Back of collar to sleeve end", val("sleeve", i)]
    ];
    $("specs").innerHTML = rows.map(function (r) {
      return '<button type="button" class="spec' + (state.focus === r[0] ? " on" : "") + '" data-k="' + r[0] + '">' +
        '<span class="spec__k">' + r[0] + "</span>" +
        '<span class="spec__name">' + r[1] + '<span class="spec__hint">' + r[2] + "</span></span>" +
        '<span class="spec__v">' + r[3] + "<small>" + u + "</small></span></button>";
    }).join("");
    $("specsLabel").textContent = "Size " + P.sizes[i] + " \u00B7 measurements";
    $("stageSize").textContent = "Size " + P.sizes[i] + " \u00B7 3D";
  }
  function renderTable() {
    $("tbody").innerHTML = P.sizes.map(function (s, i) {
      return '<tr data-size="' + i + '"' + (i === state.size ? ' class="on"' : "") + ">" +
        "<td>" + s + "</td><td>" + val("length", i) + "</td><td>" + val("width", i) + "</td><td>" + val("sleeve", i) +
        "</td><td>" + chestRange(i) + "</td></tr>";
    }).join("");
    $("tblNote").textContent = "All values in " + (state.unit === "in" ? "inches" : "centimeters") +
      ". Garment specs come from our print partner and may vary by up to 2 in (5 cm).";
  }
  function renderUnit() {
    document.querySelectorAll("[data-unit]").forEach(function (b) { b.setAttribute("aria-pressed", b.dataset.unit === state.unit); });
    $("chestUnit").textContent = state.unit;
  }
  function renderFocus() {
    document.querySelectorAll(".spec").forEach(function (s) { s.classList.toggle("on", s.dataset.k === state.focus); });
  }
  function setSize(i) { state.size = i; renderSizes(); renderSpecs(); renderTable(); emit(); }

  /* ---------- fit finder ---------- */
  function findSize() {
    var raw = parseFloat($("chest").value);
    if (!raw || raw <= 0) { $("chest").focus(); return; }
    var inches = state.unit === "cm" ? raw / 2.54 : raw;
    var C = P.chest, last = C.length - 1, idx = -1, note = "";
    if (inches < 20 || inches > 90) {
      showResult("?", "That number looks off. Measure around your <b>chest</b>, not across it, and check the unit (" + state.unit + ").");
      return;
    }
    for (var i = 0; i <= last; i++) { if (inches <= C[i][1] + 0.5) { idx = i; break; } }
    if (idx === -1) { idx = last; note = " You're above our largest chest range, so " + P.sizes[last] + " is the roomiest we make."; }
    else if (idx === 0 && inches < C[0][0]) { note = " You're below our smallest range, so " + P.sizes[0] + " will fit loose."; }
    else if (idx > 0 && inches < C[idx][0]) { note = " You're between sizes, so we rounded up to keep it from feeling tight."; }
    var relaxed = $("relaxed").checked && idx < last;
    if (relaxed) idx++;
    setSize(idx);
    showResult(P.sizes[idx],
      "Your chest: <b>" + raw + " " + state.unit + "</b>. Size <b>" + P.sizes[idx] + "</b> fits " + chestRange(idx) + " " + state.unit +
      (relaxed ? ", sized up for a relaxed fit." : ".") + note);
  }
  function showResult(size, html) {
    var r = $("result");
    $("resultSize").textContent = size;
    $("resultTxt").innerHTML = html;
    r.classList.remove("show"); void r.offsetWidth; r.classList.add("show");
  }

  /* ---------- events ---------- */
  document.addEventListener("click", function (e) {
    var t;
    if ((t = e.target.closest("[data-size]"))) {
      setSize(+t.dataset.size);
    } else if ((t = e.target.closest("[data-unit]"))) {
      if (t.dataset.unit === state.unit) return;
      var c = $("chest"), v = parseFloat(c.value);
      if (v) c.value = Math.round((t.dataset.unit === "cm" ? v * 2.54 : v / 2.54) * 10) / 10;
      state.unit = t.dataset.unit;
      try { localStorage.setItem("fv-unit", state.unit); } catch (err) {}
      renderUnit(); renderSpecs(); renderTable(); emit();
      if ($("result").classList.contains("show") && c.value) findSize();
    } else if ((t = e.target.closest("[data-k]"))) {
      window.FV.setFocus(t.dataset.k);
    }
  });
  $("finder").addEventListener("submit", function (e) { e.preventDefault(); findSize(); });
  $("relaxed").addEventListener("change", function () { if ($("chest").value) findSize(); });

  /* ---------- bridge for the 3D viewer ---------- */
  window.FV = {
    data: P,
    get size() { return state.size; },
    get focus() { return state.focus; },
    label: function (k) {
      var i = state.size, u = " " + state.unit;
      if (k === "A") return val("length", i) + u;
      if (k === "B") return chestRange(i) + u;
      return val("sleeve", i) + u;
    },
    setFocus: function (k) { state.focus = state.focus === k ? null : k; renderFocus(); emit(); },
    on: function (fn) { subs.push(fn); }
  };

  $("productName").textContent = P.name;
  renderSizes(); renderSpecs(); renderTable(); renderUnit(); renderFocus();
})();