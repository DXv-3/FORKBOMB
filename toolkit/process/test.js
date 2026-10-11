#!/usr/bin/env node
// Offline tests for cycle.js: copies the repo's pieces/packs into a temp tree, breaks them on purpose and
// asserts the validator fails loud. Run: node toolkit/process/test.js
"use strict";
const assert = require("assert"), fs = require("fs"), os = require("os"), path = require("path");
const { spawnSync } = require("child_process");
const repo = path.resolve(__dirname, "..", "..");

function sandbox() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "fb-cycle-"));
  for (const p of ["pieces", "packs", "connectors", "toolkit/process", "apps", "toolkit/scanner", "toolkit/reliability", "toolkit/ci", ".github"])
    fs.cpSync(path.join(repo, p), path.join(d, p), { recursive: true, filter: (s) => !s.includes("node_modules") && !s.endsWith(path.join("paste", "data")) });
  return d;
}
const run = (d, ...args) => spawnSync(process.execPath, [path.join(d, "toolkit/process/cycle.js"), ...args], { encoding: "utf8" });
const entry = (d, id) => path.join(d, "pieces/entries", id + ".json");
const edit = (f, fn) => { const j = JSON.parse(fs.readFileSync(f, "utf8")); fn(j); fs.writeFileSync(f, JSON.stringify(j)); };

const cases = [
  ["counts every entry file", (d) => {}, (r) => { assert.equal(r.status, 0, r.stderr); const n = fs.readdirSync(path.join(repo, "pieces/entries")).filter((f) => f.endsWith(".json")).length; assert.match(r.stdout, new RegExp(`OK: ${n} pieces \\(${n} entry files\\)`)); }],
  ["new entry raises the count", (d) => { edit(entry(d, "paste-app"), () => {}); fs.copyFileSync(entry(d, "paste-app"), entry(d, "paste-app-2")); edit(entry(d, "paste-app-2"), (j) => (j.id = "paste-app-2")); fs.appendFileSync(path.join(d, "pieces/CATALOG.md"), "\n| `paste-app-2` | x | ui | MIT | app |\n"); },
    (r) => { assert.equal(r.status, 0, r.stderr); const n = fs.readdirSync(path.join(repo, "pieces/entries")).filter((f) => f.endsWith(".json")).length + 1; assert.match(r.stdout, new RegExp(`OK: ${n} pieces`)); }],
  ["invalid JSON entry", (d) => fs.writeFileSync(entry(d, "paste-app"), "{"), /invalid JSON/],
  ["entry is an array", (d) => fs.writeFileSync(entry(d, "paste-app"), "[]"), /must be a JSON object/],
  ["non-json file in entries", (d) => fs.writeFileSync(path.join(d, "pieces/entries/oops.yml"), "id: x"), /not a \.json entry/],
  ["missing CATALOG row", (d) => { const c = path.join(d, "pieces/CATALOG.md"); fs.writeFileSync(c, fs.readFileSync(c, "utf8").replace(/^\| `paste-app` \|.*$/m, "")); }, /missing row for paste-app/],
  ["CATALOG row for unknown piece", (d) => fs.appendFileSync(path.join(d, "pieces/CATALOG.md"), "\n| `ghost-piece` | x | ui | MIT | x |\n"), /unknown piece ghost-piece/],
  ["source.path traversal", (d) => edit(entry(d, "paste-app"), (j) => (j.source.path = "../../etc/passwd")), /repo-relative/],
  ["self source.path missing (tree URL form)", (d) => edit(entry(d, "paste-app"), (j) => { j.source.url = "https://github.com/DXv-3/FORKBOMB/tree/main"; j.source.path = "apps/nope.js"; }), /does not exist/],
  ["bad url", (d) => edit(entry(d, "paste-app"), (j) => (j.source.url = "javascript:alert(1)")), /http\(s\) URI/],
  ["source not an object", (d) => edit(entry(d, "paste-app"), (j) => (j.source = "https://x.y")), /source must be an object/],
  ["seams wrong type", (d) => edit(entry(d, "paste-app"), (j) => (j.seams = { inputs: [1] })), /seams.inputs/],
  ["trust non-boolean", (d) => edit(entry(d, "paste-app"), (j) => (j.trust = { tests: "yes" })), /trust.tests/],
  ["bad category", (d) => edit(entry(d, "paste-app"), (j) => (j.category = "weapons")), /category/],
  ["filename/id mismatch", (d) => edit(entry(d, "paste-app"), (j) => (j.id = "other")), /filename must match id/],
  ["broken pack JSON", (d) => fs.writeFileSync(path.join(d, "packs/paste/pack.json"), "{"), /packs\/paste\/pack.json: invalid JSON/],
  ["pack references unknown piece", (d) => edit(path.join(d, "packs/paste/pack.json"), (j) => j.pieces.push("constructor")), /unknown piece "constructor"/],
  ["duplicate pack id", (d) => edit(path.join(d, "packs/paste/pack.json"), (j) => (j.id = "forkbomb-core")), /duplicate pack id/],
  ["stage next dangling", (d) => edit(path.join(d, "packs/forkbomb-core/pack.json"), (j) => (j.stages[0].next = "nowhere")), /not a stage/],
];
for (const [name, mutate, expect] of cases) {
  const d = sandbox();
  try {
    mutate(d);
    const r = run(d, "validate");
    if (typeof expect === "function") expect(r);
    else { assert.equal(r.status, 1, `${name}: expected failure\n${r.stdout}`); assert.match(r.stderr, expect, name); assert.ok(!/at .*\.js:\d+/.test(r.stderr), `${name}: crashed instead of reporting\n${r.stderr}`); }
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
}
// check mode
{
  const d = sandbox(), drafts = path.join(d, "drafts"); fs.mkdirSync(drafts);
  try {
    assert.equal(run(d, "check", path.join(d, "missing")).status, 2);
    fs.copyFileSync(entry(d, "paste-app"), path.join(drafts, "paste-app.json"));
    assert.equal(run(d, "check", drafts).status, 0);
    fs.writeFileSync(path.join(drafts, "bad.json"), '{"id":"bad"}');
    const r = run(d, "check", drafts); assert.equal(r.status, 1); assert.match(r.stderr, /missing "name"/);
    assert.equal(run(d, "bogus").status, 2);
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
}
console.log(`cycle tests: OK (${cases.length + 1} cases)`);
