#!/usr/bin/env node
// Offline tests for the scanner (no network). Run: node toolkit/scanner/test.js
const assert = require("assert");
const s = require("./scan.js");
assert.equal(s.classify(".github/workflows/ci.yml"), "workflow");
assert.equal(s.classify("docker/Dockerfile"), "docker");
assert.equal(s.classify("schemas/user.schema.json"), "schema");
assert.equal(s.classify("src/retry.js"), "module");
assert.equal(s.classify("retry.py"), "function");
assert.equal(s.buildQuery({ query: "deploy", kind: "workflow", mode: "code" }), "deploy path:.github/workflows");
assert.equal(s.buildQuery({ query: "deploy", kind: "workflow", mode: "repo" }), "deploy topic:github-actions");
assert.equal(s.buildQuery({ query: "retry", kind: "function", lang: "js", mode: "repo" }), "retry language:javascript");
const o = s.parseArgs(["retry", "backoff", "--lang", "ts", "--limit", "5", "--json"]);
assert.deepEqual([o.query, o.lang, o.limit, o.json], ["retry backoff", "ts", 5, true]);
const now = new Date().toISOString();
const good = s.scoreCandidate({ license: "MIT", stars: 5000, pushed_at: now, path: "src/retry.js", kind: "module", size: 2000 });
const bad = s.scoreCandidate({ license: null, stars: 0, pushed_at: "2015-01-01T00:00:00Z", path: "test/x.js", kind: "function", archived: true });
assert.ok(good.score > 80 && bad.score < 20, `scores ${good.score} / ${bad.score}`);
const e = s.toEntry({ repo: "Acme/Kit", url: "https://github.com/Acme/Kit", path: ".github/workflows/Release.yml", commit: "abc", license: "MIT", kind: "workflow", job: "Release", pushed_at: now });
assert.equal(e.id, "acme-release");
assert.equal(e.category, "ci");
for (const k of ["id", "name", "category", "license", "source", "seams", "summary"]) assert.ok(k in e, k);
console.log("scanner tests: OK");
