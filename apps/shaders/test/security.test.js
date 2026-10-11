"use strict";
// GLSL symbol-collision audit across every include combination + hardened server checks.
const { test } = require("node:test");
const assert = require("node:assert");
const { createApp, loadLibrary } = require("../server");
const SI = require("../public/include.js");
const { lib, presets } = loadLibrary();

// Top-level symbols of a GLSL source: functions keyed by name+param types (GLSL overloads are legal), globals, structs,
// and unguarded #defines. #ifndef-guarded defines are override hooks (e.g. RM_STEPS) and are reported separately.
function symbols(src) {
  const s = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  const out = new Map(), guarded = new Set();
  let depth = 0, buf = "";
  for (const ch of s) {
    if (ch === "{") {
      if (depth === 0) {
        const f = buf.match(/(\w+)\s+(\w+)\s*\(([^)]*)\)\s*$/);
        if (f) out.set(`fn ${f[2]}(${f[3].split(",").filter((a) => a.trim()).map((a) => a.replace(/\b(in|out|inout|const|highp|mediump|lowp)\b/g, "").trim().split(/\s+/)[0]).join(",")})`, f[2]);
        const st = buf.match(/struct\s+(\w+)\s*$/); if (st) out.set(`struct ${st[1]}`, st[1]);
        buf = "";
      }
      depth++;
    } else if (ch === "}") { depth--; buf = ""; }
    else if (depth === 0) {
      buf += ch;
      if (ch === ";") {
        const t = buf.replace(/^\s*#.*$/gm, "").trim();
        const v = t.match(/^(?:const\s+)?\w+\s+(\w+)\s*(=|;|\[)/);
        if (v && !/^(return|precision|uniform|out|in)\b/.test(t)) out.set(`var ${v[1]}`, v[1]);
        buf = "";
      }
    }
  }
  const lines = s.split("\n");
  lines.forEach((l, i) => {
    const d = l.match(/^\s*#\s*define\s+(\w+)/); if (!d) return;
    if (i > 0 && new RegExp(`^\\s*#\\s*ifndef\\s+${d[1]}\\b`).test(lines[i - 1])) guarded.add(d[1]); else out.set(`define ${d[1]}`, d[1]);
  });
  return { out, guarded };
}
const filesOf = (src) => [...new Set(SI.resolve(src, lib).map.map((m) => m.file))].filter((f) => f in lib);

test("no duplicate GLSL symbols across any combination of lib includes", () => {
  const names = Object.keys(lib);
  assert.ok(names.length >= 11);
  // Duplicates only arise pairwise (include-once), so checking every pair (with transitive includes) covers every subset.
  for (let i = 0; i < names.length; i++) for (let j = i; j < names.length; j++) {
    const owner = new Map();
    for (const f of filesOf(`#include "${names[i]}"\n#include "${names[j]}"\n`)) for (const k of symbols(lib[f]).out.keys()) {
      assert.ok(!owner.has(k) || owner.get(k) === f, `${k} defined in both ${owner.get(k)} and ${f}`);
      owner.set(k, f);
    }
  }
});

test("presets don't redefine symbols from the libs they include; guarded overrides come before the include", () => {
  for (const p of presets) {
    const mine = symbols(p.source).out;
    const pre = p.source.split("\n");
    for (const f of filesOf(p.source)) {
      const { out, guarded } = symbols(lib[f]);
      for (const k of out.keys()) assert.ok(!mine.has(k), `${p.id} redefines ${k} from ${f}`);
      for (const g of guarded) {
        const defAt = pre.findIndex((l) => new RegExp(`^\\s*#\\s*define\\s+${g}\\b`).test(l));
        const incAt = pre.findIndex((l) => l.includes(`#include "${f}"`));
        if (defAt >= 0 && incAt >= 0) assert.ok(defAt < incAt, `${p.id}: #define ${g} must precede #include "${f}"`);
      }
    }
  }
});

test("include resolver ignores prototype keys", () => {
  for (const n of ["constructor", "__proto__", "toString", "hasOwnProperty"]) assert.throws(() => SI.resolve(`#include "${n}"`, { "a.glsl": "" }), /unknown include/);
});

test("server: headers, methods, traversal, no source leak", async () => {
  const { server } = createApp(); await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const r = await fetch(base + "/");
    assert.match(r.headers.get("content-security-policy"), /default-src 'self'/);
    assert.ok(!/script-src[^;]*unsafe-inline/.test(r.headers.get("content-security-policy")));
    assert.equal(r.headers.get("x-frame-options"), "DENY");
    for (const p of ["/lib/..%2fserver.js", "/presets/../server.js", "/%2e%2e/server.js", "/server.js", "/package.json", "/lib/LICENSE-webgl-noise", "/test/shaders.test.js", "/..%5c..%5cetc%5cpasswd"]) {
      const x = await fetch(base + p); assert.equal(x.status, 404, p);
    }
    for (const m of ["POST", "PUT", "DELETE"]) assert.equal((await fetch(base + "/api/library", { method: m })).status, 405);
    assert.equal((await fetch(base + "/" + "x".repeat(3000))).status, 414);
  } finally { server.close(); }
});
