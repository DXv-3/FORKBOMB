"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const Sh = require("../public/dots/shapes.js"), M = require("../public/dots/morph.js"), { Swarm } = require("../public/dots/physics.js");
const Sc = require("../public/dots/scene.js"), U = require("../public/dots/ui.js"), R = require("../public/dots/render.js"), FD = require("../public/dots/forkbomb-dots.js");
const { createApp } = require("../server.js");
const close = (x, y) => { assert.equal(x.length, y.length); for (let i = 0; i < x.length; i++) assert.ok(Math.abs(x[i] - y[i]) < 1e-6, `${i}: ${x[i]} vs ${y[i]}`); };

test("shapes: 50+ generators, exact point counts, finite, inside [-1,1]", () => {
  assert.ok(Sh.NAMES.length >= 50, `${Sh.NAMES.length}`);
  assert.equal(new Set(Sh.NAMES).size, Sh.NAMES.length);
  for (const name of Sh.NAMES) for (const n of [1, 7, 300]) {
    const p = Sh.shape(name, n); assert.ok(p instanceof Float32Array); assert.equal(p.length, n * 2, name);
    for (const v of p) assert.ok(Number.isFinite(v) && Math.abs(v) <= 1, `${name} ${v}`);
  }
  const p = Sh.shape("ring", 400); let mx = 0; for (const v of p) mx = Math.max(mx, Math.abs(v)); assert.ok(mx > 0.85, "normalised to fill");
  assert.ok(Object.keys(Sh.categories()).length >= 8);
});

test("shapes: pixel-mask sampling (text/SVG/image backend)", () => {
  const w = 40, h = 20, m = new Uint8Array(w * h); for (let y = 5; y < 15; y++) for (let x = 10; x < 30; x++) m[y * w + x] = 255;
  const { points, src } = Sh.maskPoints(m, w, h, 123); assert.equal(points.length, 246); assert.equal(src.length, 123);
  for (const i of src) assert.equal(m[i], 255); for (const v of points) assert.ok(Math.abs(v) <= 1);
  assert.equal(Sh.maskPoints(new Uint8Array(4), 2, 2, 10).points.length, 20, "empty mask falls back");
});

test("morph: easing endpoints, interpolation, stagger, match permutation", () => {
  for (const [k, e] of Object.entries(M.EASE)) { assert.ok(Math.abs(e(0)) < 1e-9, k); assert.ok(Math.abs(e(1) - 1) < 1e-6, k); }
  const a = Sh.shape("disc", 200), b = Sh.shape("heart", 200);
  close(M.interpolate(a, b, 0), a); close(M.interpolate(a, b, 1), b);
  const mid = M.interpolate(a, b, 0.5, null, { ease: "linear" }); assert.ok(Math.abs(mid[0] - (a[0] + b[0]) / 2) < 1e-6);
  const ord = M.staggerOrder(b, "radial"), st = M.interpolate(a, b, 0.3, null, { ease: "linear", stagger: 0.8, order: ord });
  let lagging = 0; for (let i = 0; i < 200; i++) if (ord[i] > 0.5 && st[2 * i] === a[2 * i]) lagging++; assert.ok(lagging > 0, "outer particles start later");
  close(M.interpolate(a, b, 1, null, { stagger: 0.8, order: ord }), b);
  const mb = M.match(a, b), s1 = [...b].sort().join(), s2 = [...mb].sort().join(); assert.equal(s1, s2, "match is a permutation");
  assert.equal(M.resample(a, 50).length, 100);
});

test("physics: spring converges, explode adds energy, rain falls to floor, collisions separate", () => {
  const sw = new Swarm(300); sw.setTargets(Sh.shape("star", 300));
  for (let i = 0; i < 600; i++) sw.step(1 / 60); assert.ok(sw.maxError() < 0.01, `${sw.maxError()}`);
  sw.explode(0, 0, 3); assert.ok(sw.energy() > 0.1);
  sw.release(); for (let i = 0; i < 600; i++) sw.step(1 / 60, { gravity: 3, floor: 1, wall: 2 }); for (const y of sw.y) assert.ok(y <= 1.0001);
  const c = new Swarm(2); c.x[0] = 0; c.y[0] = 0; c.x[1] = 0.005; c.y[1] = 0; c.collide(0.01); assert.ok(c.x[1] - c.x[0] > 0.005);
  sw.resize(500); assert.equal(sw.x.length, 500);
});

test("scene: defaults, JSON + share-hash roundtrip, sanitising, timeline eval, snippet", () => {
  const s = Sc.DEFAULT(); s.timeline.push({ kind: "svg", value: "M0 0L10 10", duration: 2, hold: 0.5, ease: "outBack", stagger: 0.2, order: "x" });
  const j = Sc.toJSON(s); assert.deepEqual(Sc.fromJSON(j), Sc.normalizeScene(s)); assert.deepEqual(Sc.fromJSON(Sc.toJSON(Sc.fromJSON(j))), Sc.fromJSON(j));
  const h = Sc.toHash(s); assert.match(h, /^#scene=[A-Za-z0-9_-]+$/); assert.deepEqual(Sc.fromHash(h), Sc.normalizeScene(s));
  const bad = Sc.normalizeScene({ count: 1e9, bg: "red;", palette: ["javascript:"], timeline: [{ kind: "evil", duration: -5 }], physics: { pointer: "x" } });
  assert.equal(bad.count, 20000); assert.equal(bad.bg, "#07070c"); assert.equal(bad.timeline[0].kind, "shape"); assert.equal(bad.timeline[0].duration, 0.05); assert.equal(bad.physics.pointer, "repel");
  const tl = [{ duration: 1, hold: 1 }, { duration: 2, hold: 0 }];
  assert.deepEqual(Sc.evalTimeline(tl, 0.5), { index: 0, phase: "morph", progress: 0.5 }); assert.equal(Sc.evalTimeline(tl, 1.5).phase, "hold");
  assert.equal(Sc.evalTimeline(tl, 3).index, 1); assert.equal(Sc.evalTimeline(tl, 4.5).index, 0, "loops"); assert.ok(Sc.evalTimeline(tl, 9, false).done);
  assert.match(Sc.snippet(s), /ForkbombDots\.create/);
});

test("dot UI controls: every type builds exact count; hit testing; colours", () => {
  for (const t of U.TYPES) { const r = U.build([{ type: t, x: 0, y: 0, value: 0.5 }], 200); assert.equal(r.points.length, 400, t); for (const v of r.points) assert.ok(Number.isFinite(v) && Math.abs(v) < 1, t); }
  const L = [{ type: "button", x: 0, y: 0 }, { type: "toggle", x: 0.8, y: 0.8 }]; assert.equal(U.hitTest(L, 0.1, 0), 0); assert.equal(U.hitTest(L, 0.8, 0.8), 1); assert.equal(U.hitTest(L, -0.9, 0.9), -1);
  const sw = new Swarm(10), rgb = new Uint8Array(30); for (const m of ["gradient-y", "gradient-x", "radial", "index", "speed", "solid"]) R.colorize(rgb, sw, m, ["#000000", "#ffffff"]);
  R.colorize(rgb, sw, "image", ["#000000"], new Uint8Array(30).fill(7)); assert.equal(rgb[0], 7);
});

test("forkbomb-dots.js standalone: loads without DOM, exposes shapes + points", () => {
  assert.ok(FD.shapes.length >= 15 && typeof FD.create === "function");
  for (const s of FD.shapes) { const p = FD.points(s, 64); assert.equal(p.length, 128); for (const v of p) assert.ok(Math.abs(v) <= 1, s); }
});

test("server: dots studio + modules served, traversal blocked", async () => {
  const { server } = createApp(); await new Promise((r) => server.listen(0, r)); const base = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.match(await (await fetch(base + "/dots")).text(), /Dots Studio/);
    for (const f of ["shapes", "morph", "physics", "scene", "ui", "render", "studio", "forkbomb-dots"]) assert.equal((await fetch(`${base}/dots/${f}.js`)).status, 200, f);
    assert.equal((await fetch(base + "/dots/example.html")).status, 200); assert.equal((await fetch(base + "/dots/studio.css")).status, 200);
    assert.equal((await fetch(base + "/dots/../server.js")).status, 404); assert.equal((await fetch(base + "/dots/x/y.js")).status, 404);
  } finally { server.close(); }
});
