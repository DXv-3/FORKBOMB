"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs"), path = require("path");
const C = require("../public/core.js"), SI = require("../../shaders/public/include.js");
const { createApp, loadDataset, loadGlsl } = require("../server.js");
const ROOT = path.join(__dirname, "..");

test("dataset: 500+ gradients, valid stops, provenance + shipped licenses", () => {
  const d = loadDataset();
  assert.ok(d.gradients.length >= 500, `${d.gradients.length}`);
  const ids = new Set();
  for (const g of d.gradients) {
    assert.ok(!ids.has(g.id), `dup ${g.id}`); ids.add(g.id);
    assert.ok(g.name && g.stops.length >= 2 && g.source in d.sources, g.id);
    for (const s of g.stops) { assert.match(s.color, C.HEX); assert.ok(s.pos >= 0 && s.pos <= 100); }
    for (let i = 1; i < g.stops.length; i++) assert.ok(g.stops[i].pos >= g.stops[i - 1].pos, `${g.id} stops sorted`);
  }
  for (const [k, s] of Object.entries(d.sources)) { assert.equal(s.license, "MIT"); assert.match(s.commit, /^[0-9a-f]{40}$/); assert.ok(fs.existsSync(path.join(ROOT, "data", `LICENSE-${k}`))); }
});

test("core: css strings, sampling, halftone, shapes", () => {
  const g = { stops: [{ color: "#000000", pos: 0 }, { color: "#ffffff", pos: 100 }], angle: 45 };
  assert.equal(C.toCss(g), "linear-gradient(45deg, #000000 0%, #ffffff 100%)");
  assert.match(C.toCss(g, { type: "radial" }), /^radial-gradient\(circle at 50% 50%, /);
  assert.match(C.toCss(g, { type: "conic" }), /conic-gradient\(from 45deg .* #ffffff 360deg, #000000 360deg\)/);
  assert.deepEqual(C.sample(g.stops, 0.5).map(Math.round), [128, 128, 128]);
  assert.equal(C.rgbToHex(255, 0, 300), "#ff00ff");
  assert.ok(C.halftoneRadius(0, 10) > C.halftoneRadius(1, 10));
  assert.match(C.dotGridCss({ gap: 12 }), /background-size: 12px 12px/);
  for (const s of C.SHAPES) { const p = C.shapePoints(s, 200); assert.equal(p.length, 200); assert.ok(p.every(([x, y]) => Math.abs(x) <= 1 && Math.abs(y) <= 1), s); }
});

test("glsl: gradient.glsl + mesh.glsl resolve and lint; app shader templates build", () => {
  const { lib } = loadGlsl();
  for (const f of ["gradient.glsl", "mesh.glsl"]) { assert.ok(lib[f]); assert.deepEqual(SI.lint(lib[f] + "\nvoid mainImage(){}"), [], f); }
  const app = fs.readFileSync(path.join(ROOT, "public/app.js"), "utf8");
  assert.ok(/mesh4\(/.test(app) && /aurora\(/.test(app));
  const code = SI.build('#include "mesh.glsl"\nvoid mainImage(out vec4 c, in vec2 f){ c = vec4(mesh4(f, 0.0, vec3(1), vec3(0), vec3(1), vec3(0), 3.0), 1); }', lib).code;
  assert.equal((code.match(/vec3 linToOklab\(/g) || []).length, 1, "include-once");
});

test("server: gallery, assets, api, filter, traversal", async () => {
  const { server } = createApp(); await new Promise((r) => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.match(await (await fetch(base + "/")).text(), /FORKBOMB <b>Gradients/);
    for (const p of ["/app.js", "/core.js", "/style.css", "/include.js"]) assert.equal((await fetch(base + p)).status, 200, p);
    const all = await (await fetch(base + "/api/gradients")).json(); assert.ok(all.gradients.length >= 500 && all.sources.uigradients);
    const f = await (await fetch(base + "/api/gradients?q=flame")).json(); assert.ok(f.gradients.length >= 1 && f.gradients.every((g) => /flame/i.test(g.name)));
    assert.ok((await (await fetch(base + "/api/glsl")).json()).lib["mesh.glsl"]);
    assert.equal((await fetch(base + "/../server.js")).status, 404);
    assert.equal((await fetch(base + "/x", { method: "POST" })).status, 405);
  } finally { server.close(); }
});
