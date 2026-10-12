/* Fangviper size chart: products, sizes, units, specs, table, steps, fit finder. Exposes window.FV for the 3D viewer. */
(function () {
  /* ---------- data: add new products here (values from the supplier size guides) ---------- */
  var PRODUCTS = {
    tee: {
      name: "T-Shirt",
      sizes: ["S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL"],
      defaultSize: 1,
      finder: true,
      dims: {
        length: { in: [28, 29, 30, 31, 32, 33, 34, 35],                  cm: [71, 73.7, 76.2, 78.7, 81.3, 83.8, 86.4, 89] },
        width:  { in: [18, 20, 22, 24, 26, 28, 30, 32],                  cm: [45.7, 50.8, 56, 61, 66, 71, 76.2, 81.3] },
        sleeve: { in: [15.625, 17, 18.5, 20, 21.5, 22.75, 24.25, 25.25], cm: [39.7, 43.2, 47, 50.8, 54.6, 58, 61.5, 64.3] }
      },
      chest: [[34, 37], [38, 41], [42, 45], [46, 49], [50, 53], [54, 57], [58, 61], [62, 65]], /* body, inches */
      specs: [
        { k: "A", name: "Length", hint: "Shoulder by the collar to hem", dim: "length" },
        { k: "B", name: "Fits chest", hint: "Your body, measured around", chest: true },
        { k: "C", name: "Sleeve length", hint: "Back of collar to sleeve end", dim: "sleeve" }
      ],
      columns: [["Length", "length"], ["Width (flat)", "width"], ["Sleeve", "sleeve"], ["Fits chest", "chest"]],
      tableTitle: "All sizes",
      tolerance: "Garment specs come from our print partner and may vary by up to 2 in (5 cm).",
      steps: [
        ["A", "Length", "From the highest point of the shoulder, right beside the collar, straight down to the bottom hem."],
        ["B", "Chest", "Around the fullest part of your chest with the tape level. On a tee laid flat, measure straight across from armpit to armpit."],
        ["C", "Sleeve", "From the center back of the collar, along the shoulder seam, then down to the end of the sleeve."]
      ],
      tip: "Between sizes? Go up for a relaxed fit, or down for a closer fit."
    },
    bag: {
      name: "Duffle Bag",
      sizes: ["One size"],
      defaultSize: 0,
      finder: false,
      dims: {
        width:  { in: [17.375], cm: [44.2] },
        depth:  { in: [11.75],  cm: [29.8] },
        height: { in: [11.75],  cm: [29.8] }
      },
      specs: [
        { k: "A", name: "Width", hint: "End to end, along the bottom", dim: "width" },
        { k: "B", name: "Depth", hint: "Straight across the round end", dim: "depth" },
        { k: "C", name: "Height", hint: "Bottom to top of the round end", dim: "height" }
      ],
      columns: [["A · Width", "width"], ["B · Depth", "depth"], ["C · Height", "height"]],
      tableTitle: "Dimensions",
      tolerance: "Measured with the bag laid flat. Each bag is made by hand, so it may vary by up to 1 in (2.5 cm).",
      steps: [
        ["A", "Width", "Lay the bag flat and measure along the bottom, from one round end to the other."],
        ["B", "Depth", "Measure straight across one of the round end panels, through the middle."],
        ["C", "Height", "Stand the tape at the bottom of a round end and measure straight up to the top seam."]
      ],
      tip: "Measured empty. A fully packed bag rounds out slightly, so leave a little room."
    }
  };

  var state = { product: "tee", unit: "in", size: 1, focus: null };
  var subs = [];
  var P = PRODUCTS.tee;
  var byId = function (id) { return document.getElementById(id); };

  /* ---------- URL + saved unit ---------- */
  var q = new URLSearchParams(location.search);
  try { var saved = localStorage.getItem("fv-unit"); if (saved === "cm" || saved === "in") state.unit = saved; } catch (e) {}
  if (q.get("unit") === "cm" || q.get("unit") === "in") state.unit = q.get("unit");
  setProductState(PRODUCTS[q.get("product")] ? q.get("product") : "tee");
  if (q.get("size")) { var si = P.sizes.indexOf(q.get("size").toUpperCase()); if (si > -1) state.size = si; }

  function setProductState(key) {
    state.product = key; P = PRODUCTS[key]; state.size = P.defaultSize; state.focus = null;
  }

  /* ---------- formatting ---------- */
  var FR = ["", "⅛", "¼", "⅜", "½", "⅝", "¾", "⅞"];
  function fmtIn(v) {
    var w = Math.floor(v), n = Math.round((v - w) * 8);
    if (n === 8) { w++; n = 0; }
    return w + FR[n];
  }
  function fmtCm(v) { return (Math.round(v * 10) / 10).toString(); }
  function val(dim, i) { return state.unit === "in" ? fmtIn(P.dims[dim].in[i]) : fmtCm(P.dims[dim].cm[i]); }
  function chestRange(i) {
    var r = P.chest[i];
    return state.unit === "in" ? r[0] + "–" + r[1] : Math.round(r[0] * 2.54) + "–" + Math.round(r[1] * 2.54);
  }
  function specVal(s, i) { return s.chest ? chestRange(i) : val(s.dim, i); }
  function emit() { subs.forEach(function (fn) { fn(); }); }

  /* ---------- render ---------- */
  function renderProducts() {
    byId("products").innerHTML = Object.keys(PRODUCTS).map(function (key) {
      return "<button type=\"button\" data-product=\"" + key + "\" aria-pressed=\"" + (key === state.product) + "\">" + PRODUCTS[key].name + "</button>";
    }).join("");
  }
  function renderSizes() {
    byId("sizes").innerHTML = P.sizes.map(function (s, i) {
      return "<button type=\"button\" data-size=\"" + i + "\" aria-pressed=\"" + (i === state.size) + "\">" + s + "</button>";
    }).join("");
  }
  function renderSpecs() {
    var u = state.unit, i = state.size;
    byId("specs").innerHTML = P.specs.map(function (s) {
      var hint = s.chest ? s.hint + ". Tee width laid flat: " + val("width", i) + " " + u : s.hint;
      return "<button type=\"button\" class=\"spec" + (state.focus === s.k ? " on" : "") + "\" data-k=\"" + s.k + "\">" +
        "<span class=\"spec__k\">" + s.k + "</span>" +
        "<span class=\"spec__name\">" + s.name + "<span class=\"spec__hint\">" + hint + "</span></span>" +
        "<span class=\"spec__v\">" + specVal(s, i) + "<small>" + u + "</small></span></button>";
    }).join("");
    var sizeName = P.sizes.length > 1 ? "size " + P.sizes[i] : P.sizes[i].toLowerCase();
    byId("specsLabel").textContent = "Measurements, " + sizeName;
    byId("stageSize").textContent = P.sizes.length > 1 ? "Size " + P.sizes[i] : P.name;
  }
  function renderTable() {
    byId("tableTitle").textContent = P.tableTitle;
    byId("thead").innerHTML = "<tr><th scope=\"col\">Size</th>" + P.columns.map(function (c) { return "<th scope=\"col\">" + c[0] + "</th>"; }).join("") + "</tr>";
    byId("tbody").innerHTML = P.sizes.map(function (s, i) {
      return "<tr data-size=\"" + i + "\"" + (i === state.size ? " class=\"on\"" : "") + "><td>" + s + "</td>" +
        P.columns.map(function (c) { return "<td>" + (c[1] === "chest" ? chestRange(i) : val(c[1], i)) + "</td>"; }).join("") + "</tr>";
    }).join("");
    byId("tblNote").textContent = "All values in " + (state.unit === "in" ? "inches" : "centimeters") + ". " + P.tolerance;
  }
  function renderSteps() {
    byId("steps").innerHTML = P.steps.map(function (s) {
      return "<div><h3>" + s[0] + " · " + s[1] + "</h3><p>" + s[2] + "</p></div>";
    }).join("");
    byId("tip").textContent = P.tip;
    byId("finderBox").hidden = !P.finder;
  }
  function renderUnit() {
    document.querySelectorAll("[data-unit]").forEach(function (b) { b.setAttribute("aria-pressed", b.dataset.unit === state.unit); });
    byId("chestUnit").textContent = state.unit;
  }
  function renderFocus() {
    document.querySelectorAll(".spec").forEach(function (s) { s.classList.toggle("on", s.dataset.k === state.focus); });
  }
  function renderAll() { renderProducts(); renderSizes(); renderSpecs(); renderTable(); renderSteps(); renderUnit(); renderFocus(); }
  function setSize(i) { state.size = i; renderSizes(); renderSpecs(); renderTable(); emit(); }

  /* ---------- fit finder (tees only) ---------- */
  function findSize() {
    var raw = parseFloat(byId("chest").value);
    if (!raw || raw <= 0) { byId("chest").focus(); return; }
    var inches = state.unit === "cm" ? raw / 2.54 : raw;
    var C = P.chest, last = C.length - 1, idx = -1, note = "";
    if (inches < 20 || inches > 90) {
      showResult("?", "That number looks off. Measure around your <b>chest</b>, not across it, and check the unit (" + state.unit + ").");
      return;
    }
    for (var i = 0; i <= last; i++) { if (inches <= C[i][1] + 0.5) { idx = i; break; } }
    if (idx === -1) { idx = last; note = " You are above our largest chest range, so " + P.sizes[last] + " is the roomiest we make."; }
    else if (idx === 0 && inches < C[0][0]) { note = " You are below our smallest range, so " + P.sizes[0] + " will fit loose."; }
    else if (idx > 0 && inches < C[idx][0]) { note = " You are between sizes, so we rounded up to keep it from feeling tight."; }
    var relaxed = byId("relaxed").checked && idx < last;
    if (relaxed) idx++;
    setSize(idx);
    showResult(P.sizes[idx],
      "Your chest: <b>" + raw + " " + state.unit + "</b>. Size <b>" + P.sizes[idx] + "</b> fits " + chestRange(idx) + " " + state.unit +
      (relaxed ? ", sized up for a relaxed fit." : ".") + note);
  }
  function showResult(size, html) {
    var r = byId("result");
    byId("resultSize").textContent = size;
    byId("resultTxt").innerHTML = html;
    r.classList.remove("show"); void r.offsetWidth; r.classList.add("show");
  }

  /* ---------- events ---------- */
  document.addEventListener("click", function (e) {
    var t;
    if ((t = e.target.closest("[data-product]"))) {
      if (t.dataset.product === state.product) return;
      setProductState(t.dataset.product);
      byId("result").classList.remove("show");
      try { history.replaceState(null, "", "?product=" + state.product); } catch (err) {}
      renderAll(); emit();
    } else if ((t = e.target.closest("[data-size]"))) {
      setSize(+t.dataset.size);
    } else if ((t = e.target.closest("[data-unit]"))) {
      if (t.dataset.unit === state.unit) return;
      var c = byId("chest"), v = parseFloat(c.value);
      if (v) c.value = Math.round((t.dataset.unit === "cm" ? v * 2.54 : v / 2.54) * 10) / 10;
      state.unit = t.dataset.unit;
      try { localStorage.setItem("fv-unit", state.unit); } catch (err) {}
      renderUnit(); renderSpecs(); renderTable(); emit();
      if (byId("result").classList.contains("show") && c.value) findSize();
    } else if ((t = e.target.closest("[data-k]"))) {
      window.FV.setFocus(t.dataset.k);
    }
  });
  byId("finder").addEventListener("submit", function (e) { e.preventDefault(); findSize(); });
  byId("relaxed").addEventListener("change", function () { if (byId("chest").value) findSize(); });

  /* ---------- bridge for the 3D viewer ---------- */
  window.FV = {
    get product() { return state.product; },
    get data() { return P; },
    get size() { return state.size; },
    get focus() { return state.focus; },
    label: function (k) {
      var s = P.specs.filter(function (x) { return x.k === k; })[0];
      return s ? specVal(s, state.size) + " " + state.unit : "";
    },
    setFocus: function (k) { state.focus = state.focus === k ? null : k; renderFocus(); emit(); },
    on: function (fn) { subs.push(fn); }
  };

  renderAll();
})();
