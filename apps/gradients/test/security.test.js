"use strict";
// Security regression tests: share-link / scene JSON caps + schema, SVG path-only parsing, prototype-key lookups,
// and the hardened static server (headers, CSP hashes, traversal, methods, no stack traces).
const test = require("node:test"), assert = require("node:assert/strict");
const crypto = require("crypto"), fs = require("fs"), path = require("path");
const Sh = require("../public/dots/shapes.js"), M = require("../public/dots/morph.js"), Sc = require("../public/dots/scene.js"), FD = require("../public/dots/forkbomb-dots.js");
const { createApp } = require("../server.js");
const H = require("../../shared/http.js");

test("share link: malformed, oversized or hostile hashes never throw and fall back to null", () => {
  for (const h of [undefined, null, 42, "", "#scene=", "#scene=!!!", "#scene=" + "A".repeat(Sc.MAX_HASH + 10), "#scene=" + Buffer.from("[1,2]").toString("base64"),
    "#scene=" + Buffer.from("{not json").toString("base64"), "#scene=" + Buffer.from("null").toString("base64")]) {
    assert.doesNotThrow(() => Sc.fromHash(h)); assert.equal(Sc.fromHash(h), null, String(h).slice(0, 40));
  }
  const ok = Sc.fromHash(Sc.toHash(Sc.DEFAULT())); assert.deepEqual(ok, Sc.normalizeScene(Sc.DEFAULT()));
});

test("scene JSON: size cap, must be an object, every field clamped / whitelisted", () => {
  assert.throws(() => Sc.fromJSON("x".repeat(Sc.MAX_JSON + 1)), /under/);
  assert.throws(() => Sc.fromJSON("[]"), /object/); assert.throws(() => Sc.fromJSON("null"), /object/); assert.throws(() => Sc.fromJSON(123), /string/);
  const evil = Sc.fromJSON(JSON.stringify({
    count: 1e9, dotSize: "Infinity", bg: "red;background:url(javascript:alert(1))", renderer: "<script>", colorMode: "__proto__",
    palette: ["#fff", "javascript:alert(1)"], physics: "nope", audio: { gain: 1e9 }, __proto__: { polluted: true },
    timeline: Array.from({ length: 70 }, (_, i) => ({ kind: "svg", value: i ? "M0 0" : "M0 0".repeat(6000), ease: "constructor", order: "__proto__", duration: -5, stagger: 9 })),
  }));
  assert.equal(evil.count, 20000); assert.equal(evil.bg, "#07070c"); assert.equal(evil.renderer, "canvas"); assert.equal(evil.colorMode, "gradient-y");
  assert.deepEqual(evil.palette, Sc.DEFAULT().palette); assert.equal(evil.audio.gain, 10); assert.equal(evil.timeline.length, 64);
  const st = evil.timeline[0];
  assert.equal(st.value.length, 20000, "svg value capped at 20k"); assert.equal(st.order, "index"); assert.equal(st.duration, 0.05); assert.equal(st.stagger, 0.95);
  assert.equal(st.ease, "constructor", "ease is shape-checked here; lookups below are own-property only");
  assert.equal({}.polluted, undefined);
  assert.equal(Sc.fromJSON(JSON.stringify({ timeline: [{ ease: "x<y" }] })).timeline[0].ease, "inOutCubic");
});

test("prototype-named easing / shape keys fall back to safe defaults", () => {
  const a = new Float32Array([0, 0, 1, 1]), b = new Float32Array([1, 1, 0, 0]);
  for (const ease of ["constructor", "__proto__", "toString", "hasOwnProperty"]) {
    const out = M.interpolate(a, b, 0.5, null, { ease, stagger: 0, order: M.staggerOrder(b, "index") });
    assert.ok([...out].every(Number.isFinite), ease);
  }
  for (const name of ["constructor", "__proto__", "toString"]) {
    assert.equal(Sh.shape(name, 10).length, 20); assert.equal(FD.points(name, 10).length, 20);
  }
  assert.equal(Sh.shape("disc", 1e9).length, 40000, "point count capped");
});

test("SVG input: only path data is extracted; markup/scripts are dropped, viewBox sanitised", () => {
  const evil = `<svg viewBox="0 0 -5 NaN" onload="alert(1)"><script>alert(1)</script><path d="M0 0L10 10Z" onclick="x()"/>` +
    `<path d="javascript:alert(1)"/><path d='M1 1h2v2z'/><foreignObject><img src=x onerror=alert(1)></foreignObject></svg>`;
  const r = Sh.svgPathData(evil);
  assert.deepEqual(r.paths, ["M0 0L10 10Z", "M1 1h2v2z"]); assert.equal(r.vw, 24); assert.equal(r.vh, 24);
  assert.deepEqual(Sh.svgPathData("M12 2l3 7h7z").paths, ["M12 2l3 7h7z"]);
  assert.deepEqual(Sh.svgPathData("alert(document.cookie)").paths, []);
  assert.deepEqual(Sh.svgPathData(null).paths, []);
  assert.equal(Sh.svgPathData(`<svg viewBox="0 0 48 32"><path d="M0 0"/></svg>`).vw, 48);
  assert.ok(Sh.svgPathData("<svg>" + '<path d="M0 0"/>'.repeat(5000)).paths.length <= 64, "path count capped");
});

test("studio never puts scene strings into innerHTML unescaped", () => {
  const src = fs.readFileSync(path.join(__dirname, "../public/dots/studio.js"), "utf8");
  assert.match(src, /value="\$\{escAttr\(String\(s\.value\)/);
  assert.match(src, /MAX_IMAGE/); assert.match(src, /f\.size > Sc\.MAX_JSON/);
});

test("server: security headers, CSP hashes inline scripts, traversal, methods, no stack traces", async () => {
  const { server } = createApp(); await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const r = await fetch(base + "/dots");
    const csp = r.headers.get("content-security-policy");
    assert.match(csp, /script-src 'self'(;| )/); assert.ok(!/script-src[^;]*unsafe-inline/.test(csp)); assert.match(csp, /frame-ancestors 'none'/);
    for (const k of ["x-content-type-options", "x-frame-options", "referrer-policy"]) assert.ok(r.headers.get(k), k);
    const ex = await fetch(base + "/dots/example.html"), html = await ex.text();
    const inline = /<script>([\s\S]*?)<\/script>/.exec(html)[1];
    assert.ok(ex.headers.get("content-security-policy").includes(`'sha256-${crypto.createHash("sha256").update(inline).digest("base64")}'`));
    for (const p of ["/../server.js", "/%2e%2e/server.js", "/dots/..%2f..%2fserver.js", "/dots/../../package.json", "/data/gradients.json", "/..%5cserver.js", "/server.js", "/package.json", "/%00.js"]) {
      const x = await fetch(base + p); const t = await x.text();
      assert.ok(!t.includes("require(") && !t.includes('"scripts"'), p);
    }
    for (const m of ["POST", "PUT", "DELETE", "PATCH"]) { const x = await fetch(base + "/api/gradients", { method: m, body: m === "DELETE" ? undefined : "x" }); assert.equal(x.status, 405); assert.equal(x.headers.get("allow"), "GET, HEAD"); }
    assert.equal((await fetch(base + "/" + "a".repeat(3000))).status, 414);
    const q = await fetch(base + "/api/gradients?q=" + encodeURIComponent("<script>")); assert.equal(q.status, 200); assert.deepEqual((await q.json()).gradients, []);
  } finally { server.close(); }
});

test("shared helper: realpath containment blocks symlink escapes; errors are generic", async () => {
  const os = require("os"), d = fs.mkdtempSync(path.join(os.tmpdir(), "fb-h-")), pub = path.join(d, "pub"); fs.mkdirSync(pub);
  fs.writeFileSync(path.join(d, "secret.txt"), "SECRET"); fs.symlinkSync(path.join(d, "secret.txt"), path.join(pub, "link.txt"));
  fs.writeFileSync(path.join(pub, "ok.txt"), "fine");
  const http = require("http");
  const s = H.harden(http.createServer(H.staticHandler((req, res, url) => {
    if (url.pathname === "/boom") throw new Error("kaboom /etc/secret.js:1");
    return H.sendFile(res, path.join(pub, url.pathname.slice(1)), [pub]);
  })));
  await new Promise((r) => s.listen(0, "127.0.0.1", r)); const b = `http://127.0.0.1:${s.address().port}`;
  const err = console.error; console.error = () => {};
  try {
    assert.equal(await (await fetch(b + "/ok.txt")).text(), "fine");
    const l = await fetch(b + "/link.txt"); assert.equal(l.status, 404); assert.ok(!(await l.text()).includes("SECRET"));
    const e = await fetch(b + "/boom"); assert.equal(e.status, 500); assert.equal(await e.text(), "internal error\n");
  } finally { console.error = err; s.close(); fs.rmSync(d, { recursive: true, force: true }); }
});
