#!/usr/bin/env node
// FORKBOMB browser e2e: CSP violations, console errors, failed requests, axe-core a11y (zero serious/critical allowed),
// basic performance numbers and optional screenshots, for every page of the unified server.
// Needs: npm i --no-save puppeteer-core axe-core, and Chrome (CHROME_PATH, default /usr/bin/google-chrome).
// Env: BASE_URL (default http://localhost:8080), SCREENSHOT_DIR (optional), REPORT (optional JSON output path).
"use strict";
const puppeteer = require("puppeteer-core");
const axeSource = require("axe-core").source;
const fs = require("fs"), path = require("path");
const BASE = (process.env.BASE_URL || "http://localhost:8080").replace(/\/$/, "");
const CHROME = process.env.CHROME_PATH || "/usr/bin/google-chrome";

(async () => {
  const paste = await (await fetch(BASE + "/paste/api/paste", { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ title: "e2e", language: "javascript", content: "function hi(x) {\n  return 'hello ' + x; // comment\n}\n" }) })).json();
  const PAGES = [
    ["landing", "/"], ["paste", "/paste/"], ["paste-view", paste.url], ["shaders", "/shaders/"],
    ["gradients", "/gradients/"], ["dots", "/dots/"], ["dots-ui", "/gradients/dots/?view=ui"], ["notfound", "/does-not-exist", 404],
  ];
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new",
    args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--window-size=1280,900"] });
  const report = {}; let failures = 0;
  for (const [name, p, expectStatus = 200] of PAGES) {
    const r = { url: BASE + p, status: 0, csp: [], console: [], failed: [], axe: [], perf: {} };
    const page = await browser.newPage(); await page.setViewport({ width: 1280, height: 900 });
    const cdp = await page.target().createCDPSession(); await cdp.send("Network.enable");
    let bytes = 0; cdp.on("Network.loadingFinished", (e) => { bytes += e.encodedDataLength; });
    await page.evaluateOnNewDocument(() => {
      window.__csp = []; document.addEventListener("securitypolicyviolation", (e) => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
      window.__lcp = 0; try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lcp = e.startTime; }).observe({ type: "largest-contentful-paint", buffered: true }); } catch {}
    });
    page.on("console", (m) => { if (m.type() === "error" && !(expectStatus !== 200 && /status of 404/.test(m.text()))) r.console.push(m.text()); });
    page.on("pageerror", (e) => r.console.push("pageerror: " + e.message));
    page.on("response", (s) => { if (s.status() >= 400 && s.url() !== r.url) r.failed.push(`${s.status()} ${s.url()}`); });
    page.on("requestfailed", (q) => r.failed.push(`${q.failure() && q.failure().errorText} ${q.url()}`));
    try {
      const resp = await page.goto(r.url, { waitUntil: "networkidle0", timeout: 45000 });
      r.status = resp.status();
      await new Promise((x) => setTimeout(x, 1000));
      r.perf = await page.evaluate(() => {
        const n = performance.getEntriesByType("navigation")[0], fcp = performance.getEntriesByName("first-contentful-paint")[0];
        return { ttfbMs: Math.round(n.responseStart), domContentLoadedMs: Math.round(n.domContentLoadedEventEnd), loadMs: Math.round(n.loadEventEnd),
          fcpMs: fcp ? Math.round(fcp.startTime) : null, lcpMs: Math.round(window.__lcp) || null, requests: performance.getEntriesByType("resource").length + 1 };
      });
      r.perf.transferKB = Math.round(bytes / 102.4) / 10;
      r.csp = await page.evaluate(() => window.__csp);
      if (name === "paste-view") { const n = await page.$$eval("#code .token", (a) => a.length); if (!n) r.console.push("self-hosted Prism did not highlight (0 tokens)"); r.perf.prismTokens = n; }
      if (name === "dots-ui") { // keyboard path through the accessible Dot UI equivalents
        await page.focus("#a-btn"); await page.keyboard.press("Enter");
        const pressed = await page.$eval("#a-btn", (b) => b.getAttribute("aria-pressed"));
        if (pressed !== "true") r.console.push("Dot UI button not operable by keyboard");
      }
      // Inject axe via DevTools evaluation (not subject to the page CSP, so the strict policy stays untouched).
      const consoleBefore = r.console.length;
      await page.evaluate(axeSource);
      r.console.length = consoleBefore;
      const ax = await page.evaluate(async () => (await window.axe.run(document, { resultTypes: ["violations"] })).violations
        .map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, help: v.help, targets: v.nodes.slice(0, 3).map((n) => n.target.join(" ")) })));
      r.axe = ax;
      if (process.env.SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, `prod-${name}.png`) });
    } catch (e) { r.console.push("ERROR " + e.message); }
    const serious = r.axe.filter((v) => v.impact === "serious" || v.impact === "critical");
    r.ok = r.status === expectStatus && !r.csp.length && !r.console.length && !r.failed.length && !serious.length;
    if (!r.ok) failures++;
    console.log(`${r.ok ? "PASS" : "FAIL"} ${name.padEnd(11)} ${r.status} axe(serious+critical)=${serious.length} axe(all)=${r.axe.length} csp=${r.csp.length} console=${r.console.length} failed=${r.failed.length} ` +
      `FCP=${r.perf.fcpMs}ms LCP=${r.perf.lcpMs}ms load=${r.perf.loadMs}ms ${r.perf.transferKB}KB/${r.perf.requests}req`);
    for (const x of [...r.csp.map((c) => "csp: " + c), ...r.console.map((c) => "console: " + c), ...r.failed.map((c) => "failed: " + c), ...r.axe.map((v) => `axe ${v.impact}: ${v.id} (${v.nodes}) ${v.targets.join(", ")}`)]) console.log("     " + x);
    report[name] = r; await page.close();
  }
  await browser.close();
  if (process.env.REPORT) fs.writeFileSync(process.env.REPORT, JSON.stringify(report, null, 2));
  console.log(failures ? `\n${failures} page(s) failed` : "\nall pages passed");
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
