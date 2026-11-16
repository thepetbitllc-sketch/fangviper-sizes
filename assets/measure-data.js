/* Drevaunt card measuring: every product's own maker chart (garment laid flat, cm), only sizes we sell.
   Same numbers as the store's size cards (product-images/shirt-sizes, size-audit, cards). Printed tees: Printful chart.
   measures[].flat2 = the chart is all the way around, so the flat width tapped on the photo is doubled.
   measures[].primary = decides the size. Others are only compared in the result. */
(function (root) {
  var R = function (a, b, s) { var o = []; for (var v = a; v <= b + 1e-9; v += s) o.push(Math.round(v * 10) / 10); return o; };

  /* tap instructions + where the line sits on the drawing (viewBox 400 x 470) */
  var M = {
    chest:    { label: "Chest", ask: "Measure across the chest", say: "Measure straight across, from one armpit to the other.", tape: "Laid flat: armpit to armpit. We double it.", flat2: true, primary: true, line: [120, 188, 280, 188],
                how: "Tap just under the left armpit, then just under the right armpit.", why: "We double it, because the chart measures all the way around." },
    teewidth: { label: "Chest width", ask: "Measure across the chest", say: "Measure straight across, from one armpit to the other.", tape: "Laid flat: armpit to armpit.", primary: true, line: [120, 188, 280, 188],
                how: "Tap just under the left armpit, then just under the right armpit.", why: "Straight across, like the chart." },
    shoulder: { label: "Shoulders", ask: "Measure across the shoulders", say: "Straight across the top, from one shoulder seam to the other.", tape: "Shoulder seam to shoulder seam.", primary: true, tol: 0.5, line: [88, 82, 312, 82],
                how: "Tap the left shoulder seam, then the right shoulder seam.", why: "Shoulders can't be altered, so they help decide." },
    sleeve:   { label: "Sleeve", ask: "Measure the sleeve", say: "Lay the sleeve straight. Measure from the shoulder seam down to the end of the cuff.", tape: "Shoulder seam to the end of the cuff.", line: [332, 68, 384, 338],
                how: "Lay one sleeve straight. Tap the shoulder seam, then the end of the cuff.", why: "Only compared, a tailor can shorten a sleeve." },
    length:   { label: "Length", ask: "Measure the length, top to bottom", say: "Turn it over. Measure straight down from the collar seam at the back of the neck to the bottom of the hem.", tape: "Back of the collar seam down to the hem.", line: [150, 46, 150, 440],
                how: "Tap the top of the collar seam at the back of the neck, then the bottom of the hem.", why: "Only compared." },
    teelength:{ label: "Length", ask: "Measure the length, top to bottom", say: "Measure straight down from the top of the shoulder, right next to the collar, to the bottom hem.", tape: "Top of the shoulder by the collar, down to the hem.", line: [170, 48, 170, 440],
                how: "Tap the top of the shoulder right next to the collar, then straight down to the hem.", why: "Only compared." },
    vlength:  { label: "Length", ask: "Measure the length, top to bottom", say: "Measure straight down from the top of the shoulder strap to the bottom hem.", tape: "Top of the shoulder strap down to the hem.", line: [170, 40, 170, 440],
                how: "Tap the top of the shoulder strap, then straight down to the hem.", why: "Only compared." },
    waist:    { label: "Waist", ask: "Measure across the waist", say: "Do up the button and zip. Measure straight across the top of the waistband, side to side.", tape: "Laid flat, buttoned: across the top of the waistband. We double it.", flat2: true, primary: true, line: [112, 42, 288, 42],
                how: "Do up the button and zip. Tap the left end of the waistband, then the right end.", why: "We double it, because the chart measures all the way around." },
    jwaist:   { label: "Waist (relaxed)", ask: "Measure across the waistband", say: "Don't stretch it. Measure straight across the waistband, side to side.", tape: "Laid flat, not stretched: across the waistband. We double it.", flat2: true, line: [112, 42, 288, 42],
                how: "Don't stretch it. Tap the left end of the waistband, then the right end.", why: "Only compared, the drawcord takes up extra." },
    hip:      { label: "Hip", ask: "Measure across the seat", say: "Measure straight across the widest part of the seat, side to side.", tape: "Laid flat: across the widest part of the seat. We double it.", flat2: true, primary: true, line: [104, 128, 296, 128],
                how: "Tap the left edge, then the right edge, across the widest part of the seat.", why: "We double it, because the chart measures all the way around." },
    thigh:    { label: "Thigh", ask: "Measure across one leg", say: "Just below the crotch, measure straight across one leg, outside edge to inside edge.", tape: "Laid flat: across one leg just below the crotch. We double it.", flat2: true, line: [99, 196, 198, 196],
                how: "Tap the outside edge of one leg just below the crotch, then the inside edge.", why: "Only compared." },
    plength:  { label: "Length", ask: "Measure the length, top to bottom", say: "Measure down the outside of the leg, from the top of the waistband to the bottom of the leg.", tape: "Outside seam: top of the waistband to the bottom of the leg.", line: [326, 30, 336, 450],
                how: "Tap the top of the waistband at the side, then the bottom of that leg.", why: "Only compared, a tailor can shorten the leg." },
    foot:     { label: "Foot length", ask: "Measure your foot", say: "Stand on paper with your heel against a wall. Mark the tip of your longest toe. Measure from the wall to the mark.", tape: "Heel to the tip of your longest toe.", primary: true, tol: 0, loose: 1.5, line: [200, 44, 200, 420],
                how: "Tap the wall edge right behind your heel, then the pen mark in front of your toe.", why: "This is the number the maker sizes by." }
  };
  var mk = function (key, chart, extra) { var o = { key: key, chart: chart }; for (var k in M[key]) o[k] = M[key][k]; for (k in extra || {}) o[k] = extra[k]; return o; };

  var SH = ["38", "39", "40", "41", "42", "43", "44"];
  var P = [
    /* ---------- tees and gym ---------- */
    { id: "tee", group: "T-shirts and gym", name: "Printed T-Shirt", item: "T-shirt", draw: "tee", sizes: ["S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL"],
      source: "Printful size chart", back: "https://drevaunt.com/collections/all",
      measures: [mk("teewidth", [45.7, 50.8, 56, 61, 66, 71, 76.2, 81.3]), mk("teelength", [71, 73.7, 76.2, 78.7, 81.3, 83.8, 86.4, 89])],
      tip: "Want it roomier? Take one size up." },
    { id: "gymtee", group: "T-shirts and gym", name: "Gym Tee", item: "T-shirt", draw: "tee", sizes: ["M", "L", "XL", "XXL"],
      source: "Zendrop maker chart (2769063)", back: "https://drevaunt.com/products/the-black-gym-tee",
      measures: [mk("chest", [96, 102, 108, 114]), mk("shoulder", [42, 43.5, 44.5, 46]), mk("teelength", [71, 73, 75, 77])],
      tip: "The maker says it fits true to size, cut close to the body. Go one size up if you want it looser." },
    { id: "gymvest", group: "T-shirts and gym", name: "Mesh Gym Vest", item: "vest or tank top", draw: "vest", sizes: ["S", "M", "L", "XL", "2XL", "3XL"],
      source: "Zendrop maker chart (2616013)", back: "https://drevaunt.com/products/the-black-mesh-gym-vest",
      measures: [mk("chest", [94, 99, 104, 109, 114, 119]), mk("vlength", [70, 73, 76, 79, 82, 85])],
      tip: "Go up for a looser fit, stay for a closer fit." },
    { id: "joggers", group: "Trousers and joggers", name: "Training Joggers", item: "pair of joggers", draw: "pants", sizes: ["M", "L", "XL", "2XL", "3XL", "4XL"],
      source: "Zendrop maker chart (2822022)", back: "https://drevaunt.com/products/the-black-training-joggers",
      measures: [mk("hip", [104, 108, 112, 116, 120, 124]), mk("jwaist", [68, 71, 74, 77, 80, 83]), mk("plength", [102, 104, 106, 108, 110, 112])],
      tip: "The waist stretches from the relaxed size up to 100–115 cm, and the drawcord takes up any extra." },

    /* ---------- dress shirts (each its own maker chart) ---------- */
    { id: "shirt-bamboo", group: "Dress shirts", name: "Bamboo Fiber Dress Shirt", item: "dress shirt", draw: "shirt", sizes: SH,
      source: "Zendrop maker chart (2826904)", back: "https://drevaunt.com/products/mens-long-sleeve-bamboo-fiber-dress-shirt",
      measures: [mk("chest", R(100, 124, 4)), mk("shoulder", [44.1, 45.3, 46.5, 47.7, 48.9, 50.1, 51.3]),
                 mk("sleeve", [58.5, 60, 61, 62, 63, 64, 64.5]), mk("length", [70, 70, 74, 74, 76, 77, 79])],
      tip: "Slim cut. Your size number is also the collar in centimetres (size 40 = 40 cm collar)." },
    { id: "shirt-oxford", group: "Dress shirts", name: "Oxford Cotton Dress Shirt", item: "dress shirt", draw: "shirt", sizes: ["40", "41", "42", "43", "44", "45", "46"],
      source: "Zendrop maker chart (2699914)", back: "https://drevaunt.com/products/mens-cotton-long-sleeve-slim-fit-dress-shirt",
      measures: [mk("chest", R(104, 128, 4)), mk("shoulder", [45, 46, 47, 48, 49, 50, 51]),
                 mk("sleeve", [60, 61, 62, 63, 64, 65, 66]), mk("length", [74, 76, 77, 78, 79, 80, 81])],
      tip: "Slim fit with Asian sizing (the maker's note): trust the measurements, not the size you usually buy." },
    { id: "shirt-premium", group: "Dress shirts", name: "Premium Contrast Dress Shirt", item: "dress shirt", draw: "shirt", sizes: SH,
      source: "Zendrop maker chart (2767236)", back: "https://drevaunt.com/products/2016-mens-premium-long-sleeve-dress-shirt",
      measures: [mk("chest", R(100, 124, 4)), mk("shoulder", [44.1, 45.3, 46.5, 47.7, 48.9, 50.1, 51.3]),
                 mk("sleeve", [58, 59.5, 61, 61, 62.5, 62.5, 64]), mk("length", [73, 74, 76, 76, 78, 78, 80])],
      tip: "The maker's advice: this is a slim fit. Not used to slim? Choose one size larger." },
    { id: "shirt-workwear", group: "Dress shirts", name: "White Workwear Dress Shirt", item: "dress shirt", draw: "shirt", sizes: SH,
      source: "Zendrop maker chart (2762766)", back: "https://drevaunt.com/products/mens-white-dress-shirt-long-sleeve-workwear",
      measures: [mk("chest", R(96, 120, 4)), mk("shoulder", [43.2, 44.5, 45.8, 47.3, 48.5, 49.5, 51]),
                 mk("sleeve", [59, 59.5, 60.5, 61, 62.5, 63.5, 64]), mk("length", [70, 72, 74, 75, 76, 77, 78])],
      tip: "Chest and shoulders decide the fit. Between two sizes, take the bigger one." },

    /* ---------- trousers ---------- */
    { id: "pants", group: "Trousers and joggers", name: "Formal Suit Pants", item: "pair of trousers", draw: "pants",
      sizes: ["28", "29", "30", "31", "32", "33", "34", "35", "36", "38"],
      source: "Zendrop maker chart", back: "https://drevaunt.com/products/mens-formal-suit-pants",
      measures: [mk("waist", [72, 74, 77, 80.5, 84, 87.5, 90.5, 93.5, 96.6, 100]), mk("hip", [91, 94, 97, 100, 103, 105, 108, 111, 114, 117]),
                 mk("thigh", [54, 55, 55.5, 56, 56.5, 57, 57.5, 58, 58.5, 59]), mk("plength", [102, 102, 102, 104, 104, 104, 106, 106, 106, 106])],
      tip: "Waist and hip decide the fit. A tailor can shorten the length; a tight waist can't be fixed." },

    /* ---------- suits and jackets ---------- */
    { id: "suit", group: "Suits and jackets", name: "Three-Piece Suit", item: "suit jacket or blazer", draw: "shirt",
      sizes: ["S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL", "6XL"],
      source: "Zendrop maker chart (style XF001)", back: "https://drevaunt.com/products/the-black-three-piece-suit",
      measures: [mk("chest", [92, 94, 98, 102, 106, 110, 114, 118, 122]), mk("shoulder", [41, 42, 43, 44, 45, 46, 47, 48, 49]),
                 mk("sleeve", [61, 61, 62, 63, 64, 65, 66, 67, 68]), mk("length", [67, 67, 68, 69, 70, 71, 72, 73, 74])],
      tip: "Button the jacket before you measure. The jacket, vest and trousers come as one size." },
    { id: "jacket-dads", group: "Suits and jackets", name: "Business Suit Jacket", item: "suit jacket or blazer", draw: "shirt", sizes: ["M", "L", "XL", "2XL", "3XL"],
      source: "Zendrop maker chart", back: "https://drevaunt.com/products/mens-business-suit-jacket-for-dads",
      measures: [mk("chest", [104, 108, 112, 116, 120]), mk("shoulder", [44, 45, 46, 47, 48]),
                 mk("sleeve", [60, 61, 62, 63, 64]), mk("length", [72, 73, 74, 75, 76])],
      tip: "Button the jacket before you measure. Chest and shoulders decide the fit." },
    { id: "jacket-winter", group: "Suits and jackets", name: "Winter Suit Jacket", item: "suit jacket or blazer", draw: "shirt", sizes: ["M", "L", "XL", "2XL", "3XL", "4XL"],
      source: "Zendrop maker chart", back: "https://drevaunt.com/products/winter-suit-jacket",
      measures: [mk("chest", [100, 104, 108, 112, 116, 120]), mk("shoulder", [44.3, 45.5, 46.7, 47.9, 49.1, 50.3]),
                 mk("sleeve", [60.8, 62, 63.2, 64.4, 65.6, 65.6]), mk("length", [69, 71, 73, 75, 77, 77])],
      tip: "Button the jacket before you measure. Chest and shoulders decide the fit." },
    { id: "waistcoat", group: "Suits and jackets", name: "Formal Waistcoat", item: "waistcoat", draw: "vest", sizes: ["M", "L", "XL", "XXL"],
      source: "Zendrop maker chart", back: "https://drevaunt.com/products/mens-suit-vest-formal-waistcoat-for-men",
      measures: [mk("chest", [87, 91, 95, 99]), mk("vlength", [63.5, 64.5, 65.5, 66.5], { how: "Tap the top of the shoulder, then the bottom point at the front.", label: "Front length", ask: "Measure the front length", say: "Measure from the top of the shoulder straight down to the bottom point at the front.", tape: "Top of the shoulder down to the front point." })],
      tip: "Button it before you measure. Between two sizes, take the bigger one." },

    /* ---------- shoes (each model its own chart; foot length in cm, the longest foot length each size fits) ---------- */
    { id: "shoe-toecap", group: "Shoes", name: "Leather Toe Cap Shoes", item: "foot", draw: "foot", shoe: true, sizes: ["38", "39", "40", "41", "42", "43", "44", "45", "46"],
      source: "Zendrop maker chart (JPN size = foot length)", back: "https://drevaunt.com/products/mens-leather-toe-cap-british-formal-shoes",
      measures: [mk("foot", [24, 25, 25.5, 26, 26.5, 27, 28, 29, 30])] },
    { id: "shoe-engraved", group: "Shoes", name: "Engraved Brogue Shoes", item: "foot", draw: "foot", shoe: true, sizes: ["38", "39", "40", "41", "42", "43", "44"],
      source: "Zendrop maker chart (foot length ranges)", back: "https://drevaunt.com/products/engraved-mens-formal-leather-brogue-business-shoes",
      measures: [mk("foot", [24.5, 25, 25.5, 26, 26.5, 27, 27.5])] },
    { id: "shoe-loafer", group: "Shoes", name: "Brogue Penny Loafers", item: "foot", draw: "foot", shoe: true, sizes: ["38", "39", "40", "41", "42", "43", "44", "45", "46"],
      source: "Zendrop maker chart (fits foot length)", back: "https://drevaunt.com/products/formal-leather-shoes-for-british-businessmen",
      measures: [mk("foot", [24.5, 25, 25.5, 26, 26.5, 27, 27.5, 28, 28.5])] },
    { id: "shoe-business", group: "Shoes", name: "Business Formal Slip-ons", item: "foot", draw: "foot", shoe: true,
      sizes: ["38", "39", "40", "41", "42", "43", "44", "45", "46", "47", "48"],
      source: "Zendrop maker chart (Japan size = foot length)", back: "https://drevaunt.com/products/mens-leather-shoes-for-business-formal-wear",
      measures: [mk("foot", [23.5, 24.5, 25, 25.5, 26, 27, 28, 29, 30, 31, 32])] },
    { id: "shoe-cowhide", group: "Shoes", name: "Vintage Cowhide Strap Loafers", item: "foot", draw: "foot", shoe: true, sizes: ["39", "40", "41", "42", "43", "44", "45", "46"],
      source: "Zendrop maker chart (foot length)", back: "https://drevaunt.com/products/vintage-british-cowhide-leather-formal-business-shoes",
      measures: [mk("foot", [24.5, 25.5, 26.5, 27, 27.5, 28, 28.5, 29])] },
    { id: "shoe-laceup", group: "Shoes", name: "British Leather Lace-Up Oxfords", item: "foot", draw: "foot", shoe: true, sizes: ["38", "39", "40", "41", "42", "43", "44"],
      source: "Zendrop maker chart (international code = foot length)", back: "https://drevaunt.com/products/mens-british-leather-lace-up-formal-shoes",
      measures: [mk("foot", [24, 24.5, 25, 25.5, 26, 26.5, 27])] }
  ];
  /* store handle -> product, so a product page can link here with ?handle= */
  var HANDLES = {};
  P.forEach(function (p) { var h = p.back.split("/products/")[1]; if (h) HANDLES[h] = p.id; });
  ["khaki", "sky-blue", "light-grey", "burgundy", "grey", "navy", "black"].forEach(function (c) { HANDLES["the-" + c + "-three-piece-suit"] = "suit"; });
  ["blue", "burgundy", "white", "grey", "black"].forEach(function (c) { HANDLES["the-" + c + "-gym-tee"] = "gymtee"; });
  ["brown", "olive", "grey", "ivory", "black"].forEach(function (c) { HANDLES["the-" + c + "-mesh-gym-vest"] = "gymvest"; });
  ["army-green", "khaki", "light-grey", "dark-grey", "black"].forEach(function (c) { HANDLES["the-" + c + "-training-joggers"] = "joggers"; });

  root.FVM_DATA = { products: P, handles: HANDLES };
})(this);
