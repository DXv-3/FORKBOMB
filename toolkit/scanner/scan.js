#!/usr/bin/env node
// FORKBOMB parts scanner: search GitHub for reusable bricks, score them, emit a candidate-list.
// Zero dependencies. Auth: `gh auth token` or GITHUB_TOKEN/GH_TOKEN. Without auth it falls back to repo search.
// Usage: node toolkit/scanner/scan.js "<query>" [--kind any|function|workflow|docker|schema|module]
//        [--lang js] [--limit 20] [--min-stars 0] [--json] [--out file] [--emit-entries dir] [--mode code|repo]
const fs = require("fs");
const path = require("path");
const https = require("https");
const { execFileSync } = require("child_process");

const KINDS = {
  workflow: { q: "path:.github/workflows", category: "ci", re: /\.github\/workflows\/.+\.ya?ml$/i },
  docker: { q: "filename:Dockerfile", category: "infra", re: /(^|\/)Dockerfile[^/]*$|docker-compose\.ya?ml$/i },
  schema: { q: "extension:json \"$schema\"", category: "data", re: /schema.*\.json$|\.schema\.json$|\.proto$|\.graphql$/i },
  function: { q: "", category: "reliability", re: /\.(js|ts|mjs|py|go|rs|rb|java)$/i },
  module: { q: "", category: "other", re: /(^|\/)(lib|src|pkg|packages|utils?|toolkit)\//i },
};
const REPO_HINT = { workflow: "topic:github-actions", docker: "topic:docker", schema: "topic:json-schema", function: "", module: "" };
const LANG = { js: "javascript", ts: "typescript", py: "python", rb: "ruby", rs: "rust" };
const OK_LICENSES = /^(mit|apache-2\.0|bsd-[23]-clause|isc|mpl-2\.0|unlicense|0bsd|cc0-1\.0)$/i;
const CATS = ["reliability", "ci", "data", "ui", "agent", "infra", "auth", "commerce", "other"];

function parseArgs(argv) {
  const o = { query: [], kind: "any", limit: 20, minStars: 0, json: false, mode: "auto" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i], v = () => argv[++i];
    if (a === "--lang") o.lang = v();
    else if (a === "--kind") o.kind = v();
    else if (a === "--limit") o.limit = Math.min(100, +v() || 20);
    else if (a === "--min-stars") o.minStars = +v() || 0;
    else if (a === "--json") o.json = true;
    else if (a === "--out") o.out = v();
    else if (a === "--emit-entries") o.emit = v();
    else if (a === "--mode") o.mode = v();
    else if (a === "-h" || a === "--help") o.help = true;
    else o.query.push(a);
  }
  o.query = o.query.join(" ").trim();
  return o;
}

function token() {
  if (process.env.GITHUB_TOKEN || process.env.GH_TOKEN) return process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  try { return execFileSync("gh", ["auth", "token"], { stdio: ["ignore", "pipe", "ignore"] }).toString().trim() || null; }
  catch { return null; }
}

const cache = new Map();
function api(p, tok) {
  if (cache.has(p)) return cache.get(p);
  const pr = new Promise((resolve, reject) => {
    const headers = { "User-Agent": "forkbomb-scanner", Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
    if (tok) headers.Authorization = `Bearer ${tok}`;
    https.get({ host: "api.github.com", path: p, headers }, (res) => {
      let b = ""; res.on("data", (d) => (b += d));
      res.on("end", () => {
        let j; try { j = JSON.parse(b); } catch { j = {}; }
        if (res.statusCode >= 400) {
          const reset = res.headers["x-ratelimit-reset"];
          const hint = res.statusCode === 403 || res.statusCode === 429 ? ` (rate limit; resets ${reset ? new Date(reset * 1000).toLocaleTimeString() : "soon"})` : "";
          return reject(new Error(`GitHub ${res.statusCode} on ${p.split("?")[0]}: ${j.message || b.slice(0, 120)}${hint}`));
        }
        resolve(j);
      });
    }).on("error", reject);
  });
  cache.set(p, pr);
  return pr;
}

const tty = process.stderr.isTTY;
const c = (n, s) => (process.stdout.isTTY ? `\x1b[${n}m${s}\x1b[0m` : s);
function progress(msg) { if (tty) process.stderr.write(`\r\x1b[K${c(36, "›")} ${msg}`); }
function done() { if (tty) process.stderr.write("\r\x1b[K"); }

function buildQuery(o) {
  const parts = [o.query];
  if (o.kind !== "any" && KINDS[o.kind]) parts.push(o.mode === "repo" ? REPO_HINT[o.kind] : KINDS[o.kind].q);
  if (o.lang) parts.push(`language:${LANG[o.lang] || o.lang}`);
  return parts.filter(Boolean).join(" ");
}

function classify(p) {
  for (const k of ["workflow", "docker", "schema", "module", "function"]) if (KINDS[k].re.test(p)) return k;
  return "other";
}

function scoreCandidate(x) {
  const why = [];
  let s = 0;
  const lic = (x.license || "").toLowerCase();
  if (OK_LICENSES.test(lic)) { s += 30; why.push(`license ${x.license}`); }
  else if (lic && lic !== "noassertion" && lic !== "none") { s += 10; why.push(`license ${x.license} (check terms)`); }
  else why.push("no license (reference only)");
  const st = x.stars || 0;
  const starPts = Math.min(25, Math.round(Math.log10(st + 1) * 8)); s += starPts;
  if (st) why.push(`${st}★`);
  if (x.pushed_at) {
    const days = (Date.now() - Date.parse(x.pushed_at)) / 864e5;
    const r = days < 90 ? 20 : days < 365 ? 14 : days < 730 ? 6 : 0; s += r;
    why.push(`pushed ${Math.round(days)}d ago`);
  }
  if (x.path) {
    if (/(^|\/)(test|tests|__tests__|spec|examples?|fixtures?|vendor|node_modules|dist|build)\//i.test(x.path)) { s -= 15; why.push("test/vendor path"); }
    if (/(^|\/)(lib|src|pkg|packages|utils?|toolkit|\.github\/workflows)\//i.test(x.path)) { s += 8; why.push("reusable path"); }
    if (x.kind !== "other") s += 7;
  }
  if (x.size) {
    if (x.size >= 300 && x.size <= 15000) { s += 10; why.push("brick-sized"); }
    else if (x.size > 60000) { s -= 10; why.push("too large for one brick"); }
  }
  if (x.archived) { s -= 30; why.push("archived"); }
  if (x.fork) { s -= 10; why.push("fork"); }
  return { score: Math.max(0, Math.min(100, s)), why };
}

async function scan(o, tok) {
  const mode = o.mode === "auto" ? (tok ? "code" : "repo") : o.mode;
  if (mode === "code" && !tok) throw new Error("code search needs auth: run `gh auth login` or export GITHUB_TOKEN (or use --mode repo)");
  const q = buildQuery({ ...o, mode });
  const per = Math.min(100, Math.max(o.limit * 2, 10));
  progress(`searching ${mode}: ${q}`);
  const res = await api(`/search/${mode === "code" ? "code" : "repositories"}?q=${encodeURIComponent(q)}&per_page=${per}`, tok);
  const items = res.items || [];
  const out = [];
  let i = 0;
  for (const it of items) {
    i++;
    const repo = mode === "code" ? it.repository : it;
    progress(`enriching ${i}/${items.length} ${repo.full_name}`);
    let meta = repo;
    if (mode === "code") { try { meta = await api(`/repos/${repo.full_name}`, tok); } catch {} }
    const p = mode === "code" ? it.path : undefined;
    let size = mode === "code" ? undefined : undefined, commit = meta.default_branch;
    if (mode === "code") {
      const m = /[?&]ref=([0-9a-f]{40})/.exec(it.url || ""); if (m) commit = m[1];
      try { const f = await api(`/repos/${repo.full_name}/contents/${p.split("/").map(encodeURIComponent).join("/")}?ref=${commit}`, tok); size = f.size; } catch {}
    }
    const x = {
      url: meta.html_url || `https://github.com/${repo.full_name}`,
      repo: repo.full_name,
      path: p,
      commit,
      license: meta.license?.spdx_id || null,
      stars: meta.stargazers_count || 0,
      pushed_at: meta.pushed_at,
      archived: !!meta.archived,
      fork: !!meta.fork,
      size,
      kind: p ? classify(p) : "repo",
      job: (meta.description || it.name || "").slice(0, 160),
      html: it.html_url || meta.html_url,
    };
    if (x.stars < o.minStars) continue;
    Object.assign(x, scoreCandidate(x));
    out.push(x);
  }
  done();
  out.sort((a, b) => b.score - a.score);
  return { mode, q, total: res.total_count || 0, candidates: out.slice(0, o.limit) };
}

function toEntry(x) {
  const base = (x.path ? path.basename(x.path).replace(/\.[^.]+$/, "") : x.repo.split("/")[1]);
  const id = `${x.repo.split("/")[0]}-${base}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
  const category = { workflow: "ci", docker: "infra", schema: "data" }[x.kind] || "other";
  const e = {
    id, name: base, category: CATS.includes(category) ? category : "other",
    license: x.license || "UNKNOWN",
    source: { url: x.url, ...(x.path && { path: x.path }), ...(x.commit && { commit: x.commit }) },
    seams: { inputs: [], outputs: [], events: [] },
    summary: x.job || `Candidate ${x.kind} brick from ${x.repo}`,
    snap: "TODO (tag stage): describe how to wire this piece in.",
    trust: { tests: false, maintained: !!x.pushed_at && Date.now() - Date.parse(x.pushed_at) < 365 * 864e5, security_reviewed: false },
  };
  return e;
}

const HELP = `forkbomb scan — find reusable GitHub bricks

  node toolkit/scanner/scan.js "<query>" [options]

  --kind <k>          any | function | workflow | docker | schema | module
  --lang <lang>       language filter (js, ts, py, go, rust, ...)
  --limit <n>         ranked results to keep (default 20, max 100)
  --min-stars <n>     drop candidates below n stars
  --mode <m>          code | repo  (default: code when authed, else repo)
  --json              print the candidate-list envelope as JSON
  --out <file>        also write the envelope to a file
  --emit-entries <d>  write draft piece entries (pieces/schema.json) into dir

  auth: gh auth login, or export GITHUB_TOKEN. Code search requires auth.
  examples:
    node toolkit/scanner/scan.js "retry backoff" --lang js --kind function
    node toolkit/scanner/scan.js "deploy" --kind workflow --limit 10
    node toolkit/scanner/scan.js "topic:github-actions stars:>500" --mode repo --json`;

async function main() {
  const o = parseArgs(process.argv.slice(2));
  if (o.help || (!o.query && o.kind === "any")) { console.log(HELP); process.exit(o.help ? 0 : 2); }
  if (o.kind !== "any" && !KINDS[o.kind]) { console.error(`unknown --kind ${o.kind}`); process.exit(2); }
  const tok = token();
  const r = await scan(o, tok);
  const env = {
    stage: "discover", piece: "discover-bricks", cycle: new Date().toISOString().slice(0, 10),
    outputs: { "candidate-list": r.candidates.map(({ html, ...x }) => x) },
    next: "tag",
    meta: { query: r.q, mode: r.mode, total_matches: r.total, scanned_at: new Date().toISOString() },
  };
  if (o.out) fs.writeFileSync(o.out, JSON.stringify(env, null, 2) + "\n");
  if (o.emit) {
    fs.mkdirSync(o.emit, { recursive: true });
    for (const x of r.candidates) { const e = toEntry(x); fs.writeFileSync(path.join(o.emit, `${e.id}.json`), JSON.stringify(e, null, 2) + "\n"); }
  }
  if (o.json) return console.log(JSON.stringify(env, null, 2));
  console.log(c(1, `\n FORKBOMB scan`) + c(2, `  ${r.mode} search · "${r.q}" · ${r.total.toLocaleString()} matches · top ${r.candidates.length}\n`));
  r.candidates.forEach((x, i) => {
    const col = x.score >= 70 ? 32 : x.score >= 45 ? 33 : 31;
    const bar = "█".repeat(Math.round(x.score / 10)).padEnd(10, "░");
    console.log(` ${String(i + 1).padStart(2)}. ${c(col, bar)} ${c(1, String(x.score).padStart(3))}  ${c(36, x.kind.padEnd(8))} ${c(1, x.repo)}${x.path ? c(2, " › " + x.path) : ""}`);
    console.log(`     ${c(2, x.why.join(" · "))}`);
    if (x.html) console.log(`     ${c(4, x.html)}`);
  });
  if (!r.candidates.length) console.log("  no bricks found — broaden the query or drop --lang/--min-stars");
  if (!tok) console.log(c(33, "\n tip: gh auth login (or GITHUB_TOKEN) unlocks file-level code search + higher rate limits"));
  if (o.emit) console.log(c(32, `\n wrote ${r.candidates.length} draft entries → ${o.emit}`));
  if (o.out) console.log(c(32, ` candidate-list → ${o.out}`));
  console.log(c(2, `\n next: tag stage → node toolkit/process/cycle.js next discover`));
}

if (require.main === module) main().catch((e) => { done(); console.error(c(31, "scan failed: ") + e.message); process.exit(1); });
module.exports = { parseArgs, buildQuery, classify, scoreCandidate, toEntry };
