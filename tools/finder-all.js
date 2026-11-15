// finder-all.js - clicks through the size finder for EVERY product like a phone user: answers each question with the
// middle size's own numbers, flips between bank cards and cm to see both pictures, and checks that every picture
// loads and that the result is that middle size.  node tools/finder-all.js [outDir]
const { spawn } = require("child_process"); const fs = require("fs"), path = require("path");
const D = require("../assets/measure-data.js").FVM_DATA;
const [outDir = "tools/shots-all", base = "http://localhost:5180"] = process.argv.slice(2); fs.mkdirSync(outDir, { recursive: true });
const port = 9343, W = 390, H = 844, profile = path.join(require("os").tmpdir(), "fv-finder-all");
const chrome = spawn("C:/Program Files/Google/Chrome/Application/chrome.exe", ["--headless=new", "--hide-scrollbars", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, `--window-size=${W},${H}`, "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  let ws; for (let i = 0; i < 40 && !ws; i++) { try { const l = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); const p = l.find((t) => t.type === "page"); if (p) ws = new WebSocket(p.webSocketDebuggerUrl); } catch {} if (!ws) await sleep(250); }
  await new Promise((r) => (ws.onopen = r)); let id = 0; const pend = {};
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend[d.id]) { pend[d.id](d); delete pend[d.id]; } };
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (e) => { const r = await send("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: true }); return r.result && r.result.result && r.result.result.value; };
  const shot = async (n) => { const r = await send("Page.captureScreenshot", { format: "jpeg", quality: 70 }); fs.writeFileSync(path.join(outDir, n + ".jpg"), Buffer.from(r.result.data, "base64")); };
  const click = (sel) => ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return false; e.click(); return true; })()`);
  const imgOk = () => ev(`(async () => { const i = document.querySelector('.m-pic img'); if (!i) return 'drawing'; if (!i.complete) await new Promise(r => { i.onload = r; i.onerror = r; }); return i.naturalWidth > 0 ? i.getAttribute('src').split('/').pop() : 'BROKEN ' + i.getAttribute('src'); })()`);
  await send("Page.enable"); await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 1, mobile: true });
  let fails = 0;
  for (const p of D.products) {
    await send("Page.navigate", { url: `${base}/measure/?p=${p.id}` }); await sleep(1200);
    await ev("localStorage.setItem('fv-measure-unit','card'); 1");
    await send("Page.navigate", { url: `${base}/measure/?p=${p.id}` }); await sleep(1200);
    const pics = ["intro:" + await imgOk()]; await shot(`${p.id}-0-intro`);
    await click("#start"); await sleep(400);
    const mi = Math.floor(p.sizes.length / 2);
    for (let q = 0; q < p.measures.length; q++) {
      const m = p.measures[q], v = m.flat2 ? m.chart[mi] / 2 : m.chart[mi];
      if (!p.shoe) { await click('[data-u="card"]'); await sleep(350); pics.push(m.key + "/card:" + await imgOk()); await ev("window.scrollTo(0, 120); 1"); await shot(`${p.id}-${q + 1}-card`); }
      await click('[data-u="cm"]'); await sleep(350); pics.push(m.key + "/cm:" + await imgOk()); await ev("window.scrollTo(0, 120); 1"); await shot(`${p.id}-${q + 1}-tape`);
      await ev(`(() => { const e = document.getElementById('num'); e.value = '${v}'; e.dispatchEvent(new Event('input')); return 1; })()`);
      await click("#next"); await sleep(400);
    }
    const got = await ev("(document.querySelector('.big') || {}).textContent");
    const ok = got === p.sizes[mi], broken = pics.filter((x) => /BROKEN|drawing/.test(x));
    if (!ok || broken.length) fails++;
    console.log(`${ok && !broken.length ? "ok  " : "FAIL"} ${p.id.padEnd(15)} size ${got} (want ${p.sizes[mi]})  ${broken.length ? "pictures: " + broken.join(", ") : pics.length + " pictures ok"}`);
  }
  console.log(fails ? `${fails} FAILED` : "all products passed"); ws.close(); chrome.kill(); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); chrome.kill(); process.exit(1); });
