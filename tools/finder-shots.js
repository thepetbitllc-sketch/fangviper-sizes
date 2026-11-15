// finder-shots.js - clicks through the question finder like a phone user (Bamboo shirt: cards for the chest,
// cm for the shoulders, skips the rest) and saves a screenshot of every screen.  node tools/finder-shots.js <outDir>
const { spawn } = require("child_process"); const fs = require("fs"), path = require("path");
const [outDir = "tools/shots-finder", base = "http://localhost:5180"] = process.argv.slice(2); fs.mkdirSync(outDir, { recursive: true });
const port = 9342, W = 390, H = 844, profile = path.join(require("os").tmpdir(), "fv-finder-cdp");
const chrome = spawn("C:/Program Files/Google/Chrome/Application/chrome.exe", ["--headless=new", "--hide-scrollbars", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, `--window-size=${W},${H}`, "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  let ws; for (let i = 0; i < 40 && !ws; i++) { try { const l = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); const p = l.find((t) => t.type === "page"); if (p) ws = new WebSocket(p.webSocketDebuggerUrl); } catch {} if (!ws) await sleep(250); }
  await new Promise((r) => (ws.onopen = r)); let id = 0; const pend = {};
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend[d.id]) { pend[d.id](d); delete pend[d.id]; } };
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (e) => { const r = await send("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: true }); return r.result && r.result.result && r.result.result.value; };
  const shot = async (n) => { const h = await ev("document.documentElement.scrollHeight"); const r = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: 0, y: 0, width: W, height: h, scale: 1 } }); fs.writeFileSync(path.join(outDir, n + ".png"), Buffer.from(r.result.data, "base64")); console.log("saved", n); };
  const click = (sel) => ev(`document.querySelector(${JSON.stringify(sel)}).click(); 1`);
  await send("Page.enable"); await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 2, mobile: true });
  const PROD = process.env.FV_P || "shirt-bamboo"; await send("Page.navigate", { url: `${base}/measure/?p=${PROD}` }); await sleep(1800);
  await ev("localStorage.removeItem('fv-measure-unit'); 1");
  await send("Page.navigate", { url: `${base}/measure/?p=${PROD}` }); await sleep(2500);
  await shot("1-intro"); await click("#start"); await sleep(300);
  await shot("2-q1-empty");
  await click('[data-f="0.25"]'); await sleep(200); await shot("3-q1-cards");
  console.log("chest from 6 cards + 1/4:", (await ev("__fvm.S.vals.chest")).toFixed(1), "cm across");
  await click("#next"); await sleep(300); await click('[data-u="cm"]'); await sleep(200);
  await ev(`const e = document.getElementById('num'); e.value = '46.5'; e.dispatchEvent(new Event('input')); 1`); await sleep(200); await shot("4-q2-cm");
  await click("#next"); await sleep(300); await click("#skip"); await sleep(300); await click("#skip"); await sleep(500);
  await shot("5-result");
  console.log("RESULT:", await ev("document.querySelector('.big').textContent"), "| rows:", await ev("[...document.querySelectorAll('.m-cmp tbody tr')].map(r => r.innerText.replace(/\s+/g,' ')).join(' / ')"));
  ws.close(); chrome.kill(); process.exit(0);
})().catch((e) => { console.error(e); chrome.kill(); process.exit(1); });
