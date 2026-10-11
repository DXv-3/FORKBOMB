"use strict";
const { test, before, after } = require("node:test");
const assert = require("node:assert");
const fs = require("fs"), path = require("path");
const { createApp, loadLibrary } = require("../server");
const SI = require("../public/include.js");
const ROOT = path.join(__dirname, "..");
const { lib, presets } = loadLibrary();
const LIBS = ["noise.glsl", "fbm.glsl", "sdf.glsl", "palette.glsl", "hash.glsl", "raymarch.glsl", "camera.glsl", "lighting.glsl", "post.glsl", "gradient.glsl", "mesh.glsl"];

test("library files exist and are non-empty", () => {
  for (const f of LIBS) assert.ok(lib[f] && lib[f].length > 100, `${f} missing`);
  assert.ok(fs.existsSync(path.join(ROOT, "lib/LICENSE-webgl-noise")), "upstream MIT license shipped with vendored noise");
});

test("include resolver: recursive, include-once, line map, errors", () => {
  const L = { "a.glsl": "float a(){return 1.0;}", "b.glsl": '#include "a.glsl"\nfloat b(){return a();}' };
  const r = SI.resolve('#include "b.glsl"\n#include "a.glsl"\nvoid x(){}', L);
  assert.equal(r.code, "float a(){return 1.0;}\nfloat b(){return a();}\nvoid x(){}");
  assert.deepEqual(r.map[1], { file: "b.glsl", line: 2 });
  assert.deepEqual(r.map[2], { file: "main", line: 3 });
  assert.throws(() => SI.resolve('#include "nope.glsl"', L), /unknown include "nope.glsl"/);
  assert.throws(() => SI.resolve('#include "c.glsl"', { "c.glsl": '#include "d.glsl"', "d.glsl": '#include "c.glsl"' }), /cycle/);
});

test("build wraps prelude + epilogue and keeps the line map aligned", () => {
  const b = SI.build("// hi\nvoid mainImage(out vec4 c, in vec2 f){ c = vec4(1); }", lib);
  assert.match(b.code, /^#version 300 es/);
  assert.match(b.code, /void main\(\) \{ mainImage/);
  const lines = b.code.split("\n");
  const i = lines.findIndex((l) => l.startsWith("void mainImage"));
  assert.deepEqual(b.map[i], { file: "main", line: 2 });
});

test("6+ presets, each references only valid includes and passes syntax sanity", () => {
  assert.ok(presets.length >= 6, `only ${presets.length} presets`);
  for (const p of presets) {
    const inc = SI.includesOf(p.source);
    assert.ok(inc.length > 0, `${p.id} should be built from the library`);
    for (const n of inc) assert.ok(n in lib, `${p.id}: unknown include ${n}`);
    const { code } = SI.build(p.source, lib);
    assert.deepEqual(SI.lint(code), [], `${p.id} lint`);
    assert.equal((code.match(/void\s+main\s*\(/g) || []).length, 1, `${p.id} has exactly one main`);
    assert.ok(!/#include/.test(code), `${p.id} fully resolved`);
  }
});

test("library files are individually balanced", () => {
  for (const [n, s] of Object.entries(lib)) assert.deepEqual(SI.lint(s + "\nvoid mainImage(){}"), [], n);
  assert.deepEqual(SI.lint("void mainImage(){ if (x) { }"), ['unclosed "{"']);
});

let server, base;
before(async () => { ({ server } = createApp()); await new Promise((r) => server.listen(0, r)); base = `http://127.0.0.1:${server.address().port}`; });
after(() => server.close());

test("server serves playground, assets, library and presets", async () => {
  const idx = await fetch(base + "/");
  assert.equal(idx.status, 200); assert.match(await idx.text(), /FORKBOMB/);
  for (const p of ["/app.js", "/include.js", "/style.css", "/lib/noise.glsl", "/presets/plasma.glsl"]) assert.equal((await fetch(base + p)).status, 200, p);
  const api = await (await fetch(base + "/api/library")).json();
  assert.ok(api.presets.length >= 6 && api.lib["sdf.glsl"]);
  assert.equal((await fetch(base + "/lib/../server.js")).status, 404);
  assert.equal((await fetch(base + "/nope")).status, 404);
  assert.equal((await fetch(base + "/", { method: "POST" })).status, 405);
});

const CUSTOM = ["liquid-chrome", "nebula-volume", "synthwave-grid", "turing-bloom", "kaleido-tunnel", "soap-film", "prism-glass", "ocean-dusk", "ink-bloom", "galaxy-spiral"];
test("custom showcase presets exist, resolve includes, lint clean, use post/camera helpers", () => {
  for (const id of CUSTOM) {
    const p = presets.find((x) => x.id === id);
    assert.ok(p, `${id} preset missing`);
    assert.ok(p.title && p.title.length > 10, `${id} needs a description comment`);
    const { code } = SI.build(p.source, lib);
    assert.deepEqual(SI.lint(code), [], `${id} lint`);
    assert.ok(!/#include/.test(code), `${id} fully resolved`);
    assert.ok(/mainImage\s*\(/.test(code), `${id} defines mainImage`);
    assert.ok(SI.includesOf(p.source).includes("post.glsl"), `${id} uses post.glsl finishing`);
  }
});
test("new helper libs expose their API", () => {
  assert.match(lib["post.glsl"], /vec3 tonemapACES\(/); assert.match(lib["post.glsl"], /float vignette\(/); assert.match(lib["post.glsl"], /float grain\(/);
  assert.match(lib["camera.glsl"], /mat3 lookAt\(/); assert.match(lib["camera.glsl"], /vec3 orbitCam\(/);
  assert.match(lib["lighting.glsl"], /float fresnelSchlick\(/); assert.match(lib["lighting.glsl"], /vec3 thinFilm\(/);
});
test("gradient + mesh libs: API, coexist with post.glsl, presets build", () => {
  assert.match(lib["gradient.glsl"], /vec3 mixOklab\(/); assert.match(lib["mesh.glsl"], /vec3 mesh4\(/); assert.match(lib["mesh.glsl"], /vec3 aurora\(/);
  const { code } = SI.build('#include "mesh.glsl"\n#include "post.glsl"\nvoid mainImage(out vec4 c, in vec2 f){ c = vec4(1); }', lib);
  const names = (code.match(/^\s*(?:float|vec[234]|mat3)\s+(\w+)\s*\(/gm) || []).map((s) => s.trim());
  assert.equal(new Set(names).size, names.length, "no duplicate function definitions when mixing libs");
  for (const id of ["mesh-gradient", "aurora-grain"]) { const p = presets.find((x) => x.id === id); assert.ok(p, id); assert.deepEqual(SI.lint(SI.build(p.source, lib).code), [], id); }
});
