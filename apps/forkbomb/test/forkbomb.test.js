"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("fs"), os = require("os"), path = require("path"), zlib = require("zlib"), { spawn } = require("child_process");
const { createServer, loadConfig } = require("../server");

const quiet = { debug() {}, info() {}, warn() {}, error() {}, log() {} };
let srv, base, dataDir;
test.before(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "fb-"));
  const cfg = loadConfig({ DATA_DIR: dataDir, GLOBAL_RATE_LIMIT: "100000", TRUST_PROXY: "1", FSYNC: "1" });
  srv = createServer(cfg, quiet).server;
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${srv.address().port}`;
});
test.after(() => srv.close());

test("config: defaults and fail-fast validation", () => {
  const c = loadConfig({});
  assert.equal(c.port, 8080); assert.equal(c.host, "0.0.0.0"); assert.equal(c.logLevel, "info"); assert.equal(c.trustProxy, false); assert.equal(c.maxBytes, 524288);
  for (const env of [{ PORT: "abc" }, { PORT: "70000" }, { PORT: "-1" }, { LOG_LEVEL: "loud" }, { MAX_BYTES: "10" }, { TRUST_PROXY: "maybe" }, { HOST: "bad host!" }, { MAX_BYTES: "1e6" }])
    assert.throws(() => loadConfig(env), /invalid configuration/, JSON.stringify(env));
  try { loadConfig({ PORT: "x", LOG_LEVEL: "y" }); } catch (e) { assert.equal(e.errors.length, 2); }
});

test("boot fails fast with exit code 78 on bad config", async () => {
  const p = spawn(process.execPath, [path.join(__dirname, "..", "server.js")], { env: { ...process.env, PORT: "nope" } });
  let err = ""; p.stderr.on("data", (d) => (err += d));
  const code = await new Promise((r) => p.on("exit", r));
  assert.equal(code, 78); assert.match(err, /PORT must be an integer/); assert.doesNotThrow(() => JSON.parse(err.trim()));
});

test("health and readiness", async () => {
  const h = await fetch(base + "/healthz"); assert.equal(h.status, 200); assert.equal((await h.json()).ok, true);
  const r = await fetch(base + "/readyz"); assert.equal(r.status, 200); assert.equal((await r.json()).dataDirWritable, true);
});

test("every app is mounted under one origin", async () => {
  for (const [p, re] of [["/", /FORKBOMB/], ["/paste/", /New paste/], ["/shaders/", /Shaders/], ["/gradients/", /Gradients/], ["/gradients/dots/", /Dots Studio/]]) {
    const r = await fetch(base + p); assert.equal(r.status, 200, p); assert.match(await r.text(), re);
  }
  for (const [p, loc] of [["/paste", "/paste/"], ["/dots", "/gradients/dots/"], ["/shaders?x=1", "/shaders/?x=1"]]) {
    const r = await fetch(base + p, { redirect: "manual" }); assert.equal(r.status, 301, p); assert.equal(r.headers.get("location"), loc);
  }
  for (const p of ["/favicon.ico", "/favicon.svg", "/robots.txt", "/shaders/api/library", "/gradients/api/gradients", "/paste/vendor/prism-1.29.0/components/prism-core.min.js"])
    assert.equal((await fetch(base + p)).status, 200, p);
  assert.equal((await fetch(base + "/favicon.ico")).headers.get("content-type"), "image/x-icon");
});

test("paste works through the mount with prefixed URLs", async () => {
  const r = await fetch(base + "/paste/api/paste", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ content: "hi", language: "python" }) });
  assert.equal(r.status, 201); const p = await r.json(); assert.match(p.url, /^\/paste\/p\//);
  const v = await (await fetch(base + p.url)).text(); assert.match(v, /\/paste\/vendor\/prism-1\.29\.0\/components\/prism-core\.min\.js/); assert.doesNotMatch(v, /cdn\.jsdelivr|https:\/\/[^"]*\.js/);
  const f = await fetch(base + "/paste/new", { method: "POST", redirect: "manual", body: new URLSearchParams({ content: "x" }) });
  assert.equal(f.status, 303); assert.match(f.headers.get("location"), /^\/paste\/p\//);
  assert.ok(fs.readdirSync(dataDir).some((x) => x.endsWith(".json")));
});

test("strict CSP without third-party origins, request ids, HSTS behind https proxy", async () => {
  const r = await fetch(base + "/paste/"); const csp = r.headers.get("content-security-policy");
  assert.doesNotMatch(csp, /https?:|unsafe-inline'[^;]*script|\*/); assert.match(csp, /script-src 'self'/);
  assert.match(r.headers.get("x-request-id"), /^[0-9a-f-]{36}$/);
  assert.equal((await fetch(base + "/", { headers: { "x-request-id": "abc-123" } })).headers.get("x-request-id"), "abc-123");
  assert.notEqual((await fetch(base + "/", { headers: { "x-request-id": "bad id!" } })).headers.get("x-request-id"), "bad id");
  assert.equal(r.headers.get("strict-transport-security"), null);
  assert.match((await fetch(base + "/", { headers: { "x-forwarded-proto": "https" } })).headers.get("strict-transport-security"), /max-age=31536000/);
});

test("caching: ETag/Last-Modified/Cache-Control, 304s and compression", async () => {
  const r = await fetch(base + "/gradients/app.js", { headers: { "accept-encoding": "identity" } });
  const etag = r.headers.get("etag"); assert.ok(etag); assert.ok(r.headers.get("last-modified")); assert.match(r.headers.get("cache-control"), /max-age=/);
  assert.equal((await fetch(base + "/gradients/app.js", { headers: { "if-none-match": etag } })).status, 304);
  assert.equal((await fetch(base + "/gradients/app.js", { headers: { "if-modified-since": r.headers.get("last-modified") } })).status, 304);
  const http = require("http");
  const raw = (p, enc) => new Promise((ok) => http.get(base + p, { headers: { "accept-encoding": enc } }, (res) => { const c = []; res.on("data", (d) => c.push(d)); res.on("end", () => ok({ res, body: Buffer.concat(c) })); }));
  const br = await raw("/gradients/app.js", "br"); assert.equal(br.res.headers["content-encoding"], "br");
  assert.equal(zlib.brotliDecompressSync(br.body).toString(), await r.text());
  const gz = await raw("/shaders/api/library", "gzip"); assert.equal(gz.res.headers["content-encoding"], "gzip"); JSON.parse(zlib.gunzipSync(gz.body));
  const v = await raw("/paste/vendor/prism-1.29.0/themes/prism-tomorrow.min.css", "gzip"); assert.equal(v.res.headers["content-encoding"], "gzip"); assert.match(v.res.headers["cache-control"], /immutable/);
  assert.equal((await fetch(base + "/")).headers.get("cache-control"), "no-cache");
});

test("traversal, methods, 404 page and oversized requests", async () => {
  const http = require("http");
  const rawReq = (line) => new Promise((ok) => { const s = require("net").connect(srv.address().port, "127.0.0.1", () => s.end(line)); let d = ""; s.on("data", (x) => (d += x)); s.on("close", () => ok(d)); });
  for (const p of ["/shaders/../../etc/passwd", "/gradients/%2e%2e/%2e%2e/package.json", "/paste/vendor/prism-1.29.0/../../server.js", "/gradients/dots/..%2f..%2fserver.js"]) {
    const res = await rawReq(`GET ${p} HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n`); assert.match(res, /^HTTP\/1\.1 (404|400)/, p); assert.doesNotMatch(res, /root:|"use strict"/, p);
  }
  assert.equal((await fetch(base + "/", { method: "POST", body: "x" })).status, 405);
  const nf = await fetch(base + "/nope", { headers: { accept: "text/html" } }); assert.equal(nf.status, 404); assert.match(await nf.text(), /<h1>404<\/h1>/);
  assert.equal((await fetch(base + "/" + "a".repeat(3000))).status, 414);
  const big = await fetch(base + "/paste/api/paste", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ content: "x".repeat(600 * 1024) }) });
  assert.equal(big.status, 413);
});

test("global rate limit returns 429 with Retry-After", async () => {
  const s = createServer(loadConfig({ DATA_DIR: dataDir, GLOBAL_RATE_LIMIT: "3" }), quiet).server;
  await new Promise((r) => s.listen(0, "127.0.0.1", r)); const b = `http://127.0.0.1:${s.address().port}`;
  const codes = []; for (let i = 0; i < 5; i++) codes.push((await fetch(b + "/")).status);
  assert.deepEqual(codes, [200, 200, 200, 429, 429]);
  assert.equal((await fetch(b + "/healthz")).status, 200, "probes are never rate limited");
  s.close();
});

test("SIGTERM drains and exits 0; logs are JSON lines with request fields", async () => {
  const p = spawn(process.execPath, [path.join(__dirname, "..", "server.js")], { env: { ...process.env, PORT: "0", HOST: "127.0.0.1", DATA_DIR: dataDir } });
  let out = ""; p.stdout.on("data", (d) => (out += d));
  await new Promise((r) => { const t = setInterval(() => { if (/listening/.test(out)) { clearInterval(t); r(); } }, 20); });
  const port = JSON.parse(out.trim().split("\n")[0]).port;
  await fetch(`http://127.0.0.1:${port}/paste/?secret=hunter2`);
  p.kill("SIGTERM");
  const code = await new Promise((r) => p.on("exit", r));
  assert.equal(code, 0);
  const lines = out.trim().split("\n").map((l) => JSON.parse(l));
  const req = lines.find((l) => l.msg === "request");
  for (const k of ["ts", "level", "id", "method", "path", "status", "ms"]) assert.ok(k in req, k);
  assert.equal(req.path, "/paste/"); assert.doesNotMatch(out, /hunter2/);
  assert.ok(lines.some((l) => l.msg === "stopped"));
});
