"use strict";
// Security regression tests for FORKBOMB Paste: headers/CSP, traversal, size caps, methods, rate limiting, expiry sweep.
const { test, before, after } = require("node:test");
const assert = require("node:assert");
const fs = require("fs"), os = require("os"), path = require("path"), net = require("net"), crypto = require("crypto");
const { createApp } = require("../server");
const { Store } = require("../lib/store");
const { RateLimiter } = require("../lib/ratelimit");
const R = require("../lib/render");

let server, base, dir;
before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "paste-sec-"));
  ({ server } = createApp({ dataDir: dir, maxBytes: 1024, rateLimit: 1000, readRateLimit: 10000 }));
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => { server.close(); fs.rmSync(dir, { recursive: true, force: true }); });
const post = (body, extra = {}) => fetch(base + "/api/paste", { method: "POST", headers: { "content-type": "application/json" }, body: typeof body === "string" ? body : JSON.stringify(body), ...extra });
const raw = (payload) => new Promise((ok) => { const s = net.connect(server.address().port, "127.0.0.1", () => s.end(payload)); let b = ""; s.on("data", (d) => (b += d)); s.on("close", () => ok(b)); s.on("error", () => ok(b)); });

test("CSP has no unsafe-inline scripts and hashes the inline view script + style", async () => {
  const r = await fetch(base + "/");
  const csp = r.headers.get("content-security-policy");
  assert.ok(csp && !/script-src[^;]*'unsafe-inline'/.test(csp), csp);
  const h = (s) => `'sha256-${crypto.createHash("sha256").update(s).digest("base64")}'`;
  assert.ok(csp.includes(h(R.VIEW_SCRIPT)) && csp.includes(h(R.CSS)));
  assert.match(csp, /frame-ancestors 'none'/); assert.match(csp, /default-src 'none'/);
  for (const k of ["x-content-type-options", "x-frame-options", "referrer-policy"]) assert.ok(r.headers.get(k), k);
});

test("XSS: title/content/language escaped in HTML; raw is sandboxed text/plain", async () => {
  const x = `</code></pre><script>alert(1)</script><svg onload=alert(2)>"'&`;
  const p = await (await post({ content: x, title: x, language: x })).json();
  const html = await (await fetch(base + p.url)).text();
  assert.ok(!html.includes("<script>alert(1)") && !html.includes("<svg onload"));
  assert.ok(html.includes("&lt;/code&gt;&lt;/pre&gt;&lt;script&gt;") && html.includes("&quot;&#39;&amp;"));
  const r = await fetch(base + p.raw);
  assert.equal(r.headers.get("content-type"), "text/plain; charset=utf-8");
  assert.match(r.headers.get("content-security-policy"), /sandbox/);
  assert.equal(r.headers.get("x-content-type-options"), "nosniff");
});

test("path traversal / bogus ids never touch the filesystem", async () => {
  fs.writeFileSync(path.join(dir, "..", "paste-sec-secret.json"), JSON.stringify({ id: "x", content: "SECRET" }));
  for (const id of ["..%2F..%2Fetc%2Fpasswd", "..%2Fpaste-sec-secret", "%2e%2e", "a", "....", "abc%00def", "x".repeat(40), "AAAA.json"]) {
    for (const pre of ["/p/", "/raw/", "/api/paste/"]) {
      const r = await fetch(base + pre + id), body = await r.text();
      assert.ok(!body.includes("SECRET"), pre + id);
      if (id !== "%2e%2e") assert.equal(r.status, 404, pre + id); // %2e%2e is normalised to ".." by URL parsing -> parent route, still no file read
    }
  }
  fs.rmSync(path.join(dir, "..", "paste-sec-secret.json"));
  assert.throws(() => new Store(dir).file("../x"), /invalid id/);
});

test("size limits: oversized JSON content, oversized body, lying content-length", async () => {
  assert.equal((await post({ content: "x".repeat(1025) })).status, 413);
  assert.equal((await post({ content: "x", pad: "y".repeat(10000) })).status, 413);
  const resp = await raw(`POST /api/paste HTTP/1.1\r\nHost: x\r\nContent-Type: application/json\r\nContent-Length: 99999999\r\n\r\n{}`);
  assert.match(resp, /^HTTP\/1\.1 413/);
  assert.match(resp, /"too_large"/);
});

test("bad JSON / wrong shapes / prototype keys are 400, never 500", async () => {
  for (const b of ["{nope", "", "null", "[]", "42", '"s"', JSON.stringify({ content: ["a"] }), JSON.stringify({ content: "a", title: { x: 1 } }),
    JSON.stringify({ content: "a", expiry: "toString" }), JSON.stringify({ content: "a", expiry: "__proto__" }), JSON.stringify({ content: "a", expiry: "constructor" })]) {
    const r = await post(b); assert.equal(r.status, 400, b);
    const j = await r.json(); assert.ok(j.error && j.error.code && !/at .*\.js:\d+/.test(j.error.message), b);
  }
});

test("method checks: wrong methods get 405 with Allow", async () => {
  for (const [m, p] of [["GET", "/api/paste"], ["DELETE", "/api/paste"], ["PUT", "/new"], ["POST", "/"], ["POST", "/raw/abcd1234"], ["DELETE", "/p/abcd1234"]]) {
    const r = await fetch(base + p, { method: m }); assert.equal(r.status, 405, `${m} ${p}`); assert.ok(r.headers.get("allow"));
  }
  assert.equal((await fetch(base + "/", { method: "HEAD" })).status, 200);
});

test("rate limiter: per-IP writes are capped with 429 + Retry-After", async () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "paste-rl-"));
  const { server: s } = createApp({ dataDir: d, rateLimit: 3 });
  await new Promise((r) => s.listen(0, "127.0.0.1", r));
  const u = `http://127.0.0.1:${s.address().port}/api/paste`;
  const codes = [];
  for (let i = 0; i < 5; i++) codes.push((await fetch(u, { method: "POST", body: JSON.stringify({ content: "hi" }) })).status);
  assert.deepEqual(codes, [201, 201, 201, 429, 429]);
  const r = await fetch(u, { method: "POST", body: "{}" }); assert.ok(Number(r.headers.get("retry-after")) >= 1);
  s.close(); fs.rmSync(d, { recursive: true, force: true });
  const L = new RateLimiter({ limit: 2, windowMs: 1000, maxKeys: 2 });
  assert.ok(L.take("a", 0).ok && L.take("a", 0).ok && !L.take("a", 0).ok && L.take("a", 1000).ok, "window resets");
  L.take("b", 1000); assert.equal(L.take("c", 1000).ok, false, "bounded key table fails closed");
  assert.ok(L.take("c", 5000).ok, "stale keys are pruned");
});

test("expiry sweep removes expired pastes and stale temp files only", () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "paste-sw-")), s = new Store(d);
  const keep = s.create({ content: "k" }, 0), gone = s.create({ content: "g", expiry: "10m" }, 0);
  fs.writeFileSync(path.join(d, "ABCDEFGH.json.tmp"), "{"); fs.utimesSync(path.join(d, "ABCDEFGH.json.tmp"), 0, 0);
  fs.writeFileSync(path.join(d, "notes.txt"), "leave me");
  assert.equal(s.sweep(Date.now()), 2);
  assert.ok(s.get(keep.id)); assert.equal(s.get(gone.id), null);
  assert.deepEqual(fs.readdirSync(d).sort(), [keep.id + ".json", "notes.txt"].sort());
  fs.rmSync(d, { recursive: true, force: true });
});

test("internal errors are generic (no stack traces)", async () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "paste-err-"));
  const { server: s, store } = createApp({ dataDir: d });
  store.create = () => { throw new Error("boom at /secret/path.js:1:2"); };
  await new Promise((r) => s.listen(0, "127.0.0.1", r));
  const origErr = console.error; console.error = () => {};
  const r = await fetch(`http://127.0.0.1:${s.address().port}/api/paste`, { method: "POST", body: JSON.stringify({ content: "x" }) });
  console.error = origErr;
  assert.equal(r.status, 500); assert.deepEqual(await r.json(), { error: { code: "internal", message: "internal error" } });
  s.close(); fs.rmSync(d, { recursive: true, force: true });
});
