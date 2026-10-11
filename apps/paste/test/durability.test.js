"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("fs"), os = require("os"), path = require("path");
const { Store } = require("../lib/store");
const { createApp } = require("../server");
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "dur-"));

test("fsync writes are atomic and leave no temp files", () => {
  const d = tmp(), s = new Store(d, { fsync: true });
  const p = s.create({ content: "durable" });
  assert.equal(s.get(p.id).content, "durable");
  assert.deepEqual(fs.readdirSync(d).filter((f) => f.endsWith(".tmp")), []);
  assert.equal(fs.statSync(path.join(d, p.id + ".json")).mode & 0o777, 0o600);
});

test("storage cap by count and bytes; expired pastes are swept to make room", () => {
  const s = new Store(tmp(), { maxFiles: 2 });
  s.create({ content: "a" }); s.create({ content: "b", expiry: "1w" });
  assert.throws(() => s.create({ content: "c" }), (e) => e.status === 507 && e.code === "storage_full");
  s.sweep(Date.now() + 8 * 86400e3); assert.equal(s.usage.files, 1); // once the 1w paste expires, a sweep frees its slot assert.ok(s.create({ content: "c" }).id);
  const b = new Store(tmp(), { maxBytes: 300 });
  b.create({ content: "x".repeat(100) });
  assert.throws(() => b.create({ content: "y".repeat(200) }), /storage is full/);
});

test("usage is recounted from disk at boot", () => {
  const d = tmp(); new Store(d).create({ content: "1" }); new Store(d).create({ content: "2" });
  assert.equal(new Store(d).usage.files, 2);
});

test("API answers 507 storage_full when the cap is reached", async () => {
  const { server } = createApp({ dataDir: tmp(), maxPastes: 1 });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const u = `http://127.0.0.1:${server.address().port}/api/paste`, post = () => fetch(u, { method: "POST", body: JSON.stringify({ content: "x" }) });
  assert.equal((await post()).status, 201);
  const r = await post(); assert.equal(r.status, 507); assert.equal((await r.json()).error.code, "storage_full");
  server.close();
});

test("readiness probe: writable() reflects the data dir", () => {
  const d = tmp(), s = new Store(d); assert.equal(s.writable(), true);
  fs.chmodSync(d, 0o500); const w = s.writable(); fs.chmodSync(d, 0o700);
  if (process.getuid && process.getuid() !== 0) assert.equal(w, false);
});
