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

// ---- security / resilience ----
const fs = require("fs"), os = require("os"), path = require("path");
// 1. emitted entries can't escape the output dir, whatever the repo/path names look like
const evil = [
  { repo: "../../etc/passwd", url: "https://github.com/../../x", path: "../../../root/.ssh/authorized_keys", kind: "function" },
  { repo: "..\\..\\win/x", path: "C:\\Windows\\evil.json", kind: "function" },
  { repo: "a/b", path: "/abs/../../x.js", kind: "function" },
  { repo: "a/b", path: "src/x.js", kind: "function" }, { repo: "a/b", path: "lib/x.js", kind: "function" }, // duplicate ids
  { repo: "---/---", path: "...", kind: "function" }, { repo: "\u0000/\u202e", kind: "repo" },
];
const out = fs.mkdtempSync(path.join(os.tmpdir(), "fb-emit-"));
const files = s.writeEntries(path.join(out, "drafts"), evil.map(s.toEntry));
assert.equal(files.length, evil.length);
for (const f of files) { assert.equal(path.dirname(f), fs.realpathSync(path.join(out, "drafts"))); const j = JSON.parse(fs.readFileSync(f, "utf8")); assert.match(j.id, /^[a-z0-9][a-z0-9-]*$/); assert.match(j.source.url, /^https:\/\/github\.com\//); }
assert.equal(new Set(files).size, files.length, "duplicate ids get suffixes, never overwrite");
assert.deepEqual(fs.readdirSync(out), ["drafts"]);
assert.throws(() => s.writeEntries(out, [{ id: "../x" }]), /unsafe entry id/);
fs.rmSync(out, { recursive: true, force: true });

// 2. rate-limit / backoff decisions
const T0 = 1_700_000_000_000;
assert.ok(s.retryDelay({ status: 403, headers: { "x-ratelimit-remaining": "0", "x-ratelimit-reset": String(T0 / 1000 + 10) }, attempt: 0, now: T0 }) >= 10e3, "primary limit waits for reset");
assert.equal(s.retryDelay({ status: 403, headers: { "x-ratelimit-remaining": "0", "x-ratelimit-reset": String(T0 / 1000 + 3600) }, attempt: 0, now: T0 }), -1, "long resets fail fast");
assert.equal(s.retryDelay({ status: 403, headers: { "retry-after": "7" }, attempt: 0 }), 7000, "secondary limit honours retry-after");
assert.ok(s.retryDelay({ status: 403, message: "You have exceeded a secondary rate limit", attempt: 0 }) >= 5000);
assert.ok(s.retryDelay({ status: 502, attempt: 1 }) >= 2000); assert.ok(s.retryDelay({ status: undefined, attempt: 0 }) >= 1000);
assert.equal(s.retryDelay({ status: 403, message: "Resource not accessible", attempt: 0 }), -1, "permission 403 is final");
assert.equal(s.retryDelay({ status: 404, attempt: 0 }), -1); assert.equal(s.retryDelay({ status: 500, attempt: 4 }), -1, "bounded retries");

// 3. token never leaks
const TOK = "ghp_" + "A".repeat(36);
s._setToken(TOK);
assert.ok(!s.redact(`Bad credentials for ${TOK}`).includes(TOK));
assert.ok(!s.redact("Authorization: Bearer github_pat_" + "x".repeat(40)).includes("github_pat_"));
s._setToken(null);

(async () => {
  // api(): retries a secondary limit then succeeds; failures are not cached; error messages are scrubbed
  let calls = 0, waits = [];
  const seq = [{ status: 403, headers: { "retry-after": "1" }, body: '{"message":"secondary rate limit"}' }, { status: 200, headers: {}, body: '{"ok":1}' }];
  const r = await s.api("/t1", TOK, { send: async () => seq[calls++], wait: async (ms) => waits.push(ms) });
  assert.deepEqual(r, { ok: 1 }); assert.equal(calls, 2); assert.deepEqual(waits, [1000]);
  s._setToken(TOK);
  await assert.rejects(s.api("/t2", TOK, { send: async () => ({ status: 401, headers: {}, body: JSON.stringify({ message: "bad token " + TOK }) }), wait: async () => {} }), (e) => !e.message.includes(TOK) && /401/.test(e.message));
  let n = 0; const flaky = async () => (n++ ? { status: 200, headers: {}, body: "{}" } : Promise.reject(new Error("ECONNRESET")));
  assert.deepEqual(await s.api("/t3", TOK, { send: flaky, wait: async () => {} }), {});
  const src = fs.readFileSync(path.join(__dirname, "scan.js"), "utf8");
  assert.ok(!/console\.(log|error)\([^)]*\btok\b/.test(src), "token variable never logged");
  console.log("scanner tests: OK");
})().catch((e) => { console.error(e); process.exit(1); });
