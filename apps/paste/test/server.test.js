"use strict";
const { test, before, after } = require("node:test");
const assert = require("node:assert");
const fs = require("fs"), os = require("os"), path = require("path");
const { createApp } = require("../server");
const { Store } = require("../lib/store");
const { customAlphabet } = require("../lib/nanoid");

let server, base, dir;
before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "paste-"));
  ({ server } = createApp({ dataDir: dir, maxBytes: 1024 }));
  await new Promise((r) => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => { server.close(); fs.rmSync(dir, { recursive: true, force: true }); });
const post = (body) => fetch(base + "/api/paste", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

test("nanoid-style ids are short, url-safe and unique", () => {
  const gen = customAlphabet("abc123", 10), seen = new Set();
  for (let i = 0; i < 2000; i++) { const id = gen(); assert.match(id, /^[abc123]{10}$/); seen.add(id); }
  assert.ok(seen.size > 1990);
});

test("create via API, then read JSON, view and raw", async () => {
  const r = await post({ content: "const x = 1;\n", language: "javascript", title: "hi" });
  assert.equal(r.status, 201);
  const p = await r.json();
  assert.match(p.id, /^[0-9A-Za-z]{8}$/);
  assert.equal(p.url, `/p/${p.id}`);
  assert.deepEqual((await (await fetch(`${base}/api/paste/${p.id}`)).json()).content, "const x = 1;\n");
  const v = await fetch(base + p.url); assert.equal(v.status, 200);
  const h = await v.text(); assert.ok(h.includes('class="language-javascript"')); assert.ok(h.includes("Copy"));
  const raw = await fetch(base + p.raw);
  assert.equal(raw.headers.get("content-type"), "text/plain; charset=utf-8");
  assert.equal(await raw.text(), "const x = 1;\n");
});

test("HTML is escaped (XSS)", async () => {
  const p = await (await post({ content: "<script>alert(1)</script>", title: "<img src=x onerror=alert(1)>", language: "\"><script>" })).json();
  assert.equal(p.language, "plaintext");
  const h = await (await fetch(base + p.url)).text();
  assert.ok(!h.includes("<script>alert(1)"));
  assert.ok(h.includes("&lt;script&gt;alert(1)&lt;/script&gt;"));
  assert.ok(!h.includes("<img src=x"));
});

test("validation: empty, too large, bad json, bad expiry, missing", async () => {
  assert.equal((await post({ content: "  " })).status, 400);
  assert.equal((await post({ content: "x".repeat(2000) })).status, 413);
  assert.equal((await post({ content: "a", expiry: "forever" })).status, 400);
  assert.equal((await fetch(base + "/api/paste", { method: "POST", body: "{nope" })).status, 400);
  const nf = await fetch(base + "/api/paste/doesnotexist"); assert.equal(nf.status, 404);
  assert.equal((await nf.json()).error.code, "not_found");
  assert.equal((await fetch(base + "/raw/..%2F..%2Fetc")).status, 404);
});

test("form post redirects to short URL", async () => {
  const r = await fetch(base + "/new", { method: "POST", redirect: "manual", body: new URLSearchParams({ content: "hello", language: "plaintext", expiry: "1h" }) });
  assert.equal(r.status, 303); assert.match(r.headers.get("location"), /^\/p\/[0-9A-Za-z]{8}$/);
});

test("expiry removes pastes", () => {
  const s = new Store(fs.mkdtempSync(path.join(os.tmpdir(), "exp-")));
  const p = s.create({ content: "bye", expiry: "10m" }, 0);
  assert.ok(s.get(p.id, 1000));
  assert.equal(s.get(p.id, 601e3), null);
  const q = s.create({ content: "x", expiry: "1h" }, 0);
  assert.equal(s.sweep(4e6), 1); assert.equal(s.get(q.id, 0), null);
});
