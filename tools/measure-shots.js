// measure-shots.js - drives the card measuring page in headless Chrome like a phone user (real pointer presses on the
// photo, a fine drag, button taps) using the known test photo, checks the result and saves a screenshot of every screen.
// usage: node tools/measure-shots.js <outDir> [baseUrl]   (needs the preview server on :5180)
const { spawn } = require("child_process");
const fs = require("fs"), path = require("path");
const [outDir = "tools/shots", base = "http://localhost:5180"] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const port = 9341, W = 390, H = 844;
const profile = path.join(require("os").tmpdir(), "fv-measure-cdp");
const chrome = spawn("C:/Program Files/Google/Chrome/Application/chrome.exe",
  ["--headless=new", "--hide-scrollbars", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, `--window-size=${W},${H}`, "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* the test photo's exact answer (same maths as tools/test-shirt.html) */
const PX = 3.5, a = 8 * Math.PI / 180, L = 85.6, Wc = 53.98;
const rot = (x, y) => ({ x: (400 + x * Math.cos(a) - y * Math.sin(a)) * PX, y: (450 + x * Math.sin(a) + y * Math.cos(a)) * PX });
const TRUTH = { corners: [rot(-L / 2, -Wc / 2), rot(L / 2, -Wc / 2), rot(L / 2, Wc / 2), rot(-L / 2, Wc / 2)],
  chest: [{ x: 130 * PX, y: 330 * PX }, { x: 670 * PX, y: 330 * PX }], shoulder: [{ x: 167.5 * PX, y: 130 * PX }, { x: 632.5 * PX, y: 130 * PX }] };

(async () => {
  let ws;
  for (let i = 0; i < 40 && !ws; i++) {
    try { const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); const pg = list.find((t) => t.type === "page"); if (pg) ws = new WebSocket(pg.webSocketDebuggerUrl); } catch {}
    if (!ws) await sleep(250);
  }
  await new Promise((r) => (ws.onopen = r));
  let id = 0; const pending = {};
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending[d.id]) { pending[d.id](d); delete pending[d.id]; } };
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (expr) => { const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true }); return r.result && r.result.result && r.result.result.value; };
  const shot = async (name, full = true) => {
    const h = full ? await ev("document.documentElement.scrollHeight") : H;
    const r = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: full, clip: full ? { x: 0, y: 0, width: W, height: h, scale: 1 } : undefined });
    fs.writeFileSync(path.join(outDir, name + ".png"), Buffer.from(r.result.data, "base64")); console.log("saved", name);
  };
  const mouse = (type, x, y) => send("Input.dispatchMouseEvent", { type, x, y, button: "left", buttons: type === "mouseReleased" ? 0 : 1, clickCount: 1, pointerType: "mouse" });
  /* photo pixel -> screen point (scrolls the photo into view first) */
  const where = async (p) => ev(`(() => { document.getElementById('cv').scrollIntoView({block:'center'}); return __fvm.toScreen(${JSON.stringify(p)}); })()`);
  const tap = async (p, hold) => { const s = await where(p); await mouse("mousePressed", s.x, s.y); if (hold) await hold(s); await mouse("mouseReleased", s.x, s.y); await sleep(60); return s; };
  const click = (sel) => ev(`document.querySelector(${JSON.stringify(sel)}).click()`);

  await send("Page.enable"); await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 2, mobile: true });
  const go = async (url) => { await send("Page.navigate", { url }); await sleep(1800); };

  await go(`${base}/measure/`); await shot("1-pick");
  await go(`${base}/measure/?p=shirt-bamboo`); await shot("2-ready");
  await go(`${base}/measure/?p=shirt-bamboo&demo=../tools/test-shirt.png`); await sleep(800);

  /* phase 1: tap the card once, the photo zooms in on it */
  await tap(rot(0, 0)); await sleep(300); await shot("3a-zoomed", false);
  /* corners: tap 3, then press the 4th and hold to show the magnifier for the screenshot */
  for (let i = 0; i < 3; i++) await tap(TRUTH.corners[i]);
  await tap(TRUTH.corners[3], async (s) => { await mouse("mouseMoved", s.x + 0.2, s.y); await shot("3-corners-magnifier", false); });
  console.log("corners placed:", await ev("__fvm.S.corners.length"), "plane:", await ev("!!__fvm.S.plane"), "screen:", await ev("__fvm.S.screen"));
  /* fine drag test: grab corner 1 and move the finger 10 screen px right: the dot should move 10 * 0.3 / k photo px */
  const c0 = await ev("JSON.stringify(__fvm.S.corners[0])");
  const s0 = await where(JSON.parse(c0));
  await mouse("mousePressed", s0.x, s0.y); await mouse("mouseMoved", s0.x + 10, s0.y); await mouse("mouseReleased", s0.x + 10, s0.y);
  const c1 = JSON.parse(await ev("JSON.stringify(__fvm.S.corners[0])"));
  const moved = c1.x - JSON.parse(c0).x;
  console.log(`fine drag: finger 10 px -> dot ${moved.toFixed(1)} photo px (expected ${(10 * 0.3 / s0.k).toFixed(1)}; a plain drag would be ${(10 / s0.k).toFixed(1)})`);
  /* put it back */
  await mouse("mousePressed", s0.x, s0.y); await mouse("mouseMoved", s0.x - 0.001, s0.y); await mouse("mouseReleased", s0.x - 0.001, s0.y);
  await ev(`__fvm.S.corners[0] = ${JSON.stringify(TRUTH.corners[0])}; __fvm.S.plane = __fvm.MATH.plane(__fvm.S.corners, 'card'); 1`);
  await shot("4-corners-done");
  const pl = await ev("JSON.stringify({convex: __fvm.S.plane.convex, skew: __fvm.S.plane.skew})"); console.log("card plane", pl);

  await click("#next"); await sleep(400);
  await tap(TRUTH.chest[0]); await tap(TRUTH.chest[1]); await shot("5-chest");
  console.log("chest (around):", (await ev("__fvm.S.values.chest")).toFixed(1), "cm, truth 108");
  await click("#next"); await sleep(400);
  await tap(TRUTH.shoulder[0]); await tap(TRUTH.shoulder[1]);
  console.log("shoulder:", (await ev("__fvm.S.values.shoulder")).toFixed(1), "cm, truth 46.5");
  await click("#next"); await sleep(300); await click("#skip"); await sleep(300); await click("#skip"); await sleep(600);
  await shot("6-result");
  console.log("RESULT SIZE:", await ev("document.querySelector('.big') && document.querySelector('.big').textContent"), "(truth: 40)");
  await go(`${base}/measure/?p=shoe-toecap`); await shot("7-shoe-ready");
  await go(`${base}/measure/?p=pants`); await ev("document.getElementById('manual').click()"); await sleep(300); await shot("8-manual");
  ws.close(); chrome.kill(); process.exit(0);
})().catch((e) => { console.error(e); chrome.kill(); process.exit(1); });
